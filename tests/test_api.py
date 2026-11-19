import asyncio
import io
from pathlib import Path
from datetime import date
from starlette.datastructures import UploadFile
import app as vani


def setup_test_db(tmp_path, monkeypatch):
    test_db = tmp_path / "test.db"
    monkeypatch.setattr(vani, "DB_PATH", test_db)
    vani.init_db()
    return test_db


def test_demo_seed_forecast_and_simulator(tmp_path, monkeypatch):
    setup_test_db(tmp_path, monkeypatch)
    with vani.db_conn() as conn:
        seed = vani.seed_demo_data(conn, reset=True)
        assert seed['ok'] is True
        assert seed['seeded'] is True

    with vani.db_conn() as conn:
        products = vani.list_products(conn)
        assert len(products) == 6
        forecasts = vani.all_forecasts(conn)
        assert len(forecasts) == 6
        assert all('drivers' in f and 'recommended_qty' in f for f in forecasts)
        first_product_id = products[0]['id']

    sim = vani.simulate(vani.SimulateIn(product_id=first_product_id, quantity=1))
    assert sim['order_cost'] >= 0
    assert 'exposure_note' in sim


def test_product_sale_purchase_and_voice_parse(tmp_path, monkeypatch):
    setup_test_db(tmp_path, monkeypatch)
    p = vani.create_product(vani.ProductIn(
        sku='MILK-TEST', name='Milk 1L', category='Dairy', unit='packets',
        current_stock=10, incoming_stock=0, cost_price=40, selling_price=50,
        lead_time_days=1, shelf_life_days=3
    ))
    assert p['id'] > 0
    product_id = p['id']

    with vani.db_conn() as conn:
        prods = vani.list_products(conn)
        voice = vani.parse_voice_text('Aaj 12 crate doodh bika', prods)
        assert voice['ok'] is True and voice['intent'] == 'sale' and voice['quantity'] == 12
        ambiguous = vani.parse_voice_text('12 milk packets', prods)
        assert ambiguous['ok'] is True and ambiguous['intent'] == 'unknown'

    sale = vani.add_sale(vani.SaleIn(product_id=product_id, quantity=2, sale_date=date(2026, 11, 16)))
    assert sale['ok'] is True
    with vani.db_conn() as conn:
        prod = dict(vani.get_product(conn, product_id))
        assert prod['current_stock'] == 8

    purchase = vani.add_purchase(vani.PurchaseIn(product_id=product_id, quantity=5, purchase_date=date(2026, 11, 16)))
    assert purchase['ok'] is True
    with vani.db_conn() as conn:
        prod = dict(vani.get_product(conn, product_id))
        assert prod['current_stock'] == 13


def test_csv_import_validates_rows(tmp_path, monkeypatch):
    setup_test_db(tmp_path, monkeypatch)
    with vani.db_conn() as conn:
        vani.seed_demo_data(conn, reset=True)

    csv_text = "product,date,quantity\nMustard Oil,2026-11-01,4\nNot A SKU,2026-11-01,2\n"
    result = vani.process_sales_csv_text(csv_text, source_label="test_upload.csv")
    assert result['imported'] == 1
    assert result['skipped'] == 1


def test_event_and_budget_update(tmp_path, monkeypatch):
    setup_test_db(tmp_path, monkeypatch)
    event = vani.create_event(vani.EventIn(
        name='Test Festival', start_date=date(2026, 11, 20), end_date=date(2026, 11, 22),
        uplift_pct=25, category='Staples'
    ))
    assert event['id'] > 0

    budget = vani.update_settings(vani.SettingsIn(weekly_budget=42000))
    assert budget['ok'] is True
    assert budget['weekly_budget'] == 42000


def test_rolling_validation_endpoint(tmp_path, monkeypatch):
    setup_test_db(tmp_path, monkeypatch)
    with vani.db_conn() as conn:
        vani.seed_demo_data(conn, reset=True)
    data = vani.forecast_validation()
    assert data['training_days'] == 56
    assert data['evaluation_days'] == 14
    assert data['is_demo_data'] is True
    assert data['products_evaluated'] > 0

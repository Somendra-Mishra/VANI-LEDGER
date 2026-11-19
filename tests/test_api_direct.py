from pathlib import Path
from datetime import date
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

    # Test What-If Simulator
    sim = vani.simulate(vani.SimulateIn(product_id=first_product_id, quantity=1))
    assert sim['order_cost'] >= 0
    assert 'exposure_note' in sim
    assert sim['remaining_budget'] > 0

def test_product_sale_purchase_and_voice(tmp_path, monkeypatch):
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
        # Test Single-Item Voice parsing
        v1 = vani.parse_voice_text('Aaj 12 crate doodh bika', prods)
        assert v1['ok'] is True
        assert v1['intent'] == 'sale'
        assert v1['quantity'] == 12

        # Test Multi-Item Compound Voice parsing with Hindi numbers
        v2 = vani.parse_voice_text('5 packet doodh aur do packet milk becha', prods)
        assert v2['ok'] is True
        assert len(v2.get('items', [])) >= 1

    # Record sale
    sale = vani.add_sale(vani.SaleIn(product_id=product_id, quantity=2, sale_date=date(2026, 11, 16)))
    assert sale['ok'] is True
    with vani.db_conn() as conn:
        prod = dict(vani.get_product(conn, product_id))
        assert prod['current_stock'] == 8

    # Record purchase
    purch = vani.add_purchase(vani.PurchaseIn(product_id=product_id, quantity=5, purchase_date=date(2026, 11, 16)))
    assert purch['ok'] is True
    with vani.db_conn() as conn:
        prod = dict(vani.get_product(conn, product_id))
        assert prod['current_stock'] == 13

def test_purchase_orders_workflow(tmp_path, monkeypatch):
    setup_test_db(tmp_path, monkeypatch)
    p = vani.create_product(vani.ProductIn(
        sku='OIL-TEST', name='Mustard Oil', category='Staples', unit='bottles',
        current_stock=5, incoming_stock=0, cost_price=135, selling_price=165,
        lead_time_days=3, shelf_life_days=180
    ))
    product_id = p['id']

    # Place purchase order
    po = vani.create_purchase_order(vani.PurchaseOrderIn(product_id=product_id, quantity=15, unit_cost=135))
    assert po['ok'] is True
    assert po['id'] > 0
    order_id = po['id']

    # Verify incoming_stock incremented
    with vani.db_conn() as conn:
        prod = dict(vani.get_product(conn, product_id))
        assert prod['incoming_stock'] == 15
        assert prod['current_stock'] == 5

    # Retrieve purchase orders list
    pos = vani.get_purchase_orders()
    assert len(pos) >= 1
    assert pos[0]['id'] == order_id
    assert pos[0]['status'] == 'ordered'

    # Mark purchase order received
    rec = vani.receive_purchase_order(order_id)
    assert rec['ok'] is True

    # Verify stock moved from incoming to current_stock
    with vani.db_conn() as conn:
        prod = dict(vani.get_product(conn, product_id))
        assert prod['incoming_stock'] == 0
        assert prod['current_stock'] == 20
        # Check purchase ledger
        purchases = conn.execute("SELECT * FROM purchases WHERE source='po_receipt'").fetchall()
        assert len(purchases) == 1

def test_event_and_settings(tmp_path, monkeypatch):
    setup_test_db(tmp_path, monkeypatch)
    ev = vani.create_event(vani.EventIn(
        name='Diwali Rush', start_date=date(2026, 11, 20), end_date=date(2026, 11, 25),
        uplift_pct=30, category='Staples'
    ))
    assert ev['id'] > 0
    assert ev['uplift_pct'] == 30

    budget = vani.update_settings(vani.SettingsIn(weekly_budget=60000))
    assert budget['ok'] is True
    assert budget['weekly_budget'] == 60000

    stored = vani.get_settings()
    assert stored['weekly_budget'] == 60000

def test_rolling_holdout_validation(tmp_path, monkeypatch):
    setup_test_db(tmp_path, monkeypatch)
    with vani.db_conn() as conn:
        vani.seed_demo_data(conn, reset=True)
    
    val = vani.forecast_validation()
    assert val['training_days'] == 56
    assert val['evaluation_days'] == 14
    assert val['is_demo_data'] is True
    assert val['products_evaluated'] > 0
    assert 'wape_pct' in val

def test_ml_model_train_and_forecast(tmp_path, monkeypatch):
    setup_test_db(tmp_path, monkeypatch)
    with vani.db_conn() as conn:
        vani.seed_demo_data(conn, reset=True)
        products = vani.list_products(conn)
        pid = products[0]['id']
    
    # Train single SKU model
    train_res = vani.ml_train_one(pid)
    assert train_res['trained'] is True
    assert 'wape_pct' in train_res
    assert 'mae_units_per_day' in train_res

    # Forecast with trained model
    pred_res = vani.ml_forecast_one(pid, horizon_days=7)
    assert pred_res['available'] is True
    assert len(pred_res['forecast']) == 7
    assert pred_res['daily_average'] >= 0



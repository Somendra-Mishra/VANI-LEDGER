"""patch_final.py — Apply all remaining feature patches to app.js and app.py"""
import re, sys, pathlib

BASE = pathlib.Path(__file__).parent

# ─────────────────────────────────────────────────────────────────────────────
# 1. PATCH app.js
# ─────────────────────────────────────────────────────────────────────────────
js_path = BASE / "static" / "app.js"
js = js_path.read_text(encoding="utf-8")

# ── 1a. Add 5th metric card: Recommended Spend ──────────────────────────────
OLD_METRICS_END = """    <div class="metric-card"><div class="metric-top">REORDER ALERTS / नया माल मंगाना है <span class="metric-icon">⌁</span></div><div class="metric-value">${num(s.reorder_alerts)}</div><div class="metric-foot ${s.reorder_alerts?'warn':'good'}">${s.reorder_alerts?'Products at or below reorder threshold':'Stock levels are optimal'}</div></div>
  </div>`"""

NEW_METRICS_END = """    <div class="metric-card"><div class="metric-top">REORDER ALERTS / नया माल मंगाना है <span class="metric-icon">⌁</span></div><div class="metric-value">${num(s.reorder_alerts)}</div><div class="metric-foot ${s.reorder_alerts?'warn':'good'}">${s.reorder_alerts?'Products at or below reorder threshold':'Stock levels are optimal'}</div></div>
    <div class="metric-card"><div class="metric-top">RECOMMENDED SPEND / सुझावित खर्च <span class="metric-icon">↯</span></div><div class="metric-value">${inr(s.recommended_spend)}</div><div class="metric-foot ${s.recommended_spend>s.weekly_budget?'warn':'good'}">Budget: ${inr(s.weekly_budget)} · ${s.recommended_spend>s.weekly_budget?'Over budget':'Within budget'}</div></div>
  </div>`"""

if OLD_METRICS_END in js:
    js = js.replace(OLD_METRICS_END, NEW_METRICS_END)
    print("✓ Added 5th metric card (Recommended Spend)")
else:
    print("⚠ Metric card target not found — skipping")

# ── 1b. Enhance runMlTraining: show feature importances after training ───────
OLD_TRAIN = """async function runMlTraining() {
  toast('Training per-SKU Random Forest models…');
  try {
    const trained = await api('/ml/train-all', {method: 'POST'});
    toast(`Trained ${trained.trained} of ${trained.total} SKU models.`, 'success');
    await renderPage();
  } catch(e) { toast(e.message, 'error'); }
}"""

NEW_TRAIN = """async function runMlTraining() {
  toast('Training per-SKU Random Forest models\u2026');
  const btn = $('#trainMl') || $('#triggerMlTrain');
  if (btn) { btn.disabled = true; btn.textContent = 'Training\u2026'; }
  try {
    const trained = await api('/ml/train-all', {method: 'POST'});
    toast(`Trained ${trained.trained} of ${trained.total} SKU models.`, 'success');
    await renderPage();
    // After re-render, load feature importances for selected product
    if (state.selectedForecastId) {
      await loadMlFeatureImportances(state.selectedForecastId);
    }
  } catch(e) { toast(e.message, 'error'); }
  finally {
    const b2 = $('#trainMl') || $('#triggerMlTrain');
    if (b2) { b2.disabled = false; b2.textContent = '\u2756 Train ML models'; }
  }
}

async function loadMlFeatureImportances(productId) {
  const panel = $('#mlForecastPanel');
  if (!panel) return;
  try {
    const r = await api(`/ml/forecast/${productId}?horizon_days=14`);
    const fi = r.feature_importances || {};
    const entries = Object.entries(fi).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (!entries.length) return;
    const maxV = Math.max(...entries.map(e => e[1]));
    const bars = entries.map(([k, v]) => {
      const pct = Math.round(v / maxV * 100);
      return `<div style="margin:4px 0">
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px">
          <span>${esc(k.replace(/_/g,' '))}</span><span style="color:var(--muted)">${(v*100).toFixed(1)}%</span>
        </div>
        <div style="background:var(--border);border-radius:3px;height:6px">
          <div style="background:var(--accent);width:${pct}%;height:6px;border-radius:3px;transition:width 0.5s"></div>
        </div>
      </div>`;
    }).join('');
    panel.querySelector('.panel-body').innerHTML = `
      <strong>ML Feature Importances (Random Forest)</strong>
      <p class="helper-text" style="margin:4px 0 10px">Which signals drive this SKU\u2019s demand prediction.</p>
      ${bars}
      <p class="helper-text" style="margin-top:8px;font-size:10px">MAE: ${r.mae !== undefined ? num(r.mae) + ' units/day' : '\u2014'} \u00b7 Model trained locally</p>
      <button class="btn btn-secondary btn-small" id="triggerMlTrain" style="margin-top:8px">Re-train models \u2192</button>`;
    $('#triggerMlTrain')?.addEventListener('click', runMlTraining);
  } catch(e) {
    // Model not yet trained — keep the original button
  }
}"""

if OLD_TRAIN in js:
    js = js.replace(OLD_TRAIN, NEW_TRAIN)
    print("✓ Enhanced runMlTraining with feature importance chart")
else:
    print("⚠ runMlTraining target not found — skipping")

# ── 1c. Wire feature importances in renderForecasts after select ─────────────
OLD_SELECT_WIRE = """  $$('[data-select-forecast]').forEach(b => b.addEventListener('click', () => {
    state.selectedForecastId = Number(b.dataset.selectForecast);
    renderForecasts();
  }));"""

NEW_SELECT_WIRE = """  $$('[data-select-forecast]').forEach(b => b.addEventListener('click', () => {
    state.selectedForecastId = Number(b.dataset.selectForecast);
    renderForecasts();
    // After render, attempt to load ML feature importances if model is trained
    setTimeout(() => loadMlFeatureImportances(Number(b.dataset.selectForecast)), 200);
  }));
  // Also try to load on initial render
  setTimeout(() => { if (state.selectedForecastId) loadMlFeatureImportances(state.selectedForecastId); }, 300);"""

if OLD_SELECT_WIRE in js:
    js = js.replace(OLD_SELECT_WIRE, NEW_SELECT_WIRE)
    print("✓ Wired ML feature importances on forecast selection")
else:
    print("⚠ Forecast select wire target not found — skipping")

# ── 1d. Add MARGIN column to inventory table ─────────────────────────────────
OLD_INV_ROW = """  const rows = state.products.map(p => `
    <tr>
      <td><strong>${esc(p.name)}</strong><div class="table-muted">${esc(p.sku)} · ${esc(p.category)}</div></td>
      <td>${num(p.current_stock)} ${esc(p.unit)}</td>
      <td>${num(p.incoming_stock)}</td>
      <td>${inr(p.cost_price)}</td>
      <td>${p.lead_time_days} days</td>
      <td>${p.shelf_life_days ? `${p.shelf_life_days} days` : '—'}</td>
      <td>
        <div class="table-actions">
          <button class="text-link" data-open-drawer="${p.id}">Advice / सलाह</button>
          <button class="text-link" data-edit-product="${p.id}">Edit</button>
          <button class="text-link" style="color:var(--red)" data-delete-product="${p.id}">Delete</button>
        </div>
      </td>
    </tr>`).join('');"""

NEW_INV_ROW = """  const rows = state.products.map(p => {
    const fc = state.forecasts.find(f => f.product_id === p.id);
    const margin = fc?.gross_margin_pct != null ? `${num(fc.gross_margin_pct)}%` : '—';
    const marginColor = fc?.gross_margin_pct > 20 ? 'var(--green)' : fc?.gross_margin_pct > 0 ? 'var(--amber)' : 'var(--red)';
    return `
    <tr>
      <td><strong>${esc(p.name)}</strong><div class="table-muted">${esc(p.sku)} · ${esc(p.category)}</div></td>
      <td>${num(p.current_stock)} ${esc(p.unit)}</td>
      <td>${num(p.incoming_stock)}</td>
      <td>${inr(p.cost_price)}</td>
      <td style="color:${marginColor};font-weight:600">${margin}</td>
      <td>${p.lead_time_days} days</td>
      <td>${p.shelf_life_days ? `${p.shelf_life_days} days` : '—'}</td>
      <td>
        <div class="table-actions">
          <button class="text-link" data-open-drawer="${p.id}">Advice / \u0938\u0932\u093e\u0939</button>
          <button class="text-link" data-edit-product="${p.id}">Edit</button>
          <button class="text-link" style="color:var(--red)" data-delete-product="${p.id}">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');"""

if OLD_INV_ROW in js:
    js = js.replace(OLD_INV_ROW, NEW_INV_ROW)
    print("✓ Added Margin % column to inventory table")
else:
    print("⚠ Inventory row target not found — skipping")

# ── 1e. Update inventory table header to include MARGIN column ───────────────
OLD_INV_HEAD = "`<div class=\"table-wrap\"><table><thead><tr><th>PRODUCT</th><th>ON HAND</th><th>INCOMING</th><th>UNIT COST</th><th>LEAD TIME</th><th>SHELF LIFE</th><th>ACTIONS</th></tr></thead><tbody>${rows}</tbody></table></div>`"
NEW_INV_HEAD = "`<div class=\"table-wrap\"><table><thead><tr><th>PRODUCT</th><th>ON HAND</th><th>INCOMING</th><th>UNIT COST</th><th>MARGIN</th><th>LEAD TIME</th><th>SHELF LIFE</th><th>ACTIONS</th></tr></thead><tbody>${rows}</tbody></table></div>`"

if OLD_INV_HEAD in js:
    js = js.replace(OLD_INV_HEAD, NEW_INV_HEAD)
    print("✓ Updated inventory table header to include MARGIN")
else:
    print("⚠ Inventory table header not found — skipping")

js_path.write_text(js, encoding="utf-8")
print(f"\napp.js updated ({len(js)} chars)")

# ─────────────────────────────────────────────────────────────────────────────
# 2. PATCH app.py — add estimated_revenue_30d to /api/summary
# ─────────────────────────────────────────────────────────────────────────────
py_path = BASE / "app.py"
py = py_path.read_text(encoding="utf-8")

OLD_SUMMARY = '''@app.get("/api/summary")
def summary():
    with db_conn() as conn:
        products = list_products(conn)
        sales_count = conn.execute("SELECT COUNT(*) FROM sales").fetchone()[0]
        sales_units = conn.execute("SELECT COALESCE(SUM(quantity),0) FROM sales WHERE sale_date>=?", ((iso_today() - timedelta(days=30)).isoformat(),)).fetchone()[0]
        stock_value = sum(float(p["current_stock"]) * float(p["cost_price"]) for p in products)
        fs = [compute_forecast(conn, p) for p in products]
        low_stock = [f for f in fs if f["recommended_qty"] > 0]
        budget = safe_float(conn.execute("SELECT value FROM settings WHERE key='weekly_budget'").fetchone()[0], 50000)
        return {
            "product_count": len(products),
            "sales_records": sales_count,
            "units_sold_30d": round(float(sales_units), 1),
            "inventory_cost_value": round(stock_value, 2),
            "reorder_alerts": len(low_stock),
            "recommended_spend": round(sum(f["recommended_cost"] for f in fs), 2),
            "weekly_budget": budget,
            "low_stock_items": low_stock[:6],
        }'''

NEW_SUMMARY = '''@app.get("/api/summary")
def summary():
    with db_conn() as conn:
        products = list_products(conn)
        sales_count = conn.execute("SELECT COUNT(*) FROM sales").fetchone()[0]
        sales_units = conn.execute("SELECT COALESCE(SUM(quantity),0) FROM sales WHERE sale_date>=?", ((iso_today() - timedelta(days=30)).isoformat(),)).fetchone()[0]
        stock_value = sum(float(p["current_stock"]) * float(p["cost_price"]) for p in products)
        fs = [compute_forecast(conn, p) for p in products]
        low_stock = [f for f in fs if f["recommended_qty"] > 0]
        budget = safe_float(conn.execute("SELECT value FROM settings WHERE key='weekly_budget'").fetchone()[0], 50000)
        # Estimated revenue: sum of (qty × selling_price) for sales in last 30 days
        price_map = {p["id"]: float(p["selling_price"]) for p in products}
        rev_rows = conn.execute(
            "SELECT product_id, SUM(quantity) qty FROM sales WHERE sale_date>=? GROUP BY product_id",
            ((iso_today() - timedelta(days=30)).isoformat(),)
        ).fetchall()
        est_revenue_30d = round(sum(float(r["qty"]) * price_map.get(r["product_id"], 0.0) for r in rev_rows), 2)
        return {
            "product_count": len(products),
            "sales_records": sales_count,
            "units_sold_30d": round(float(sales_units), 1),
            "inventory_cost_value": round(stock_value, 2),
            "reorder_alerts": len(low_stock),
            "recommended_spend": round(sum(f["recommended_cost"] for f in fs), 2),
            "weekly_budget": budget,
            "estimated_revenue_30d": est_revenue_30d,
            "low_stock_items": low_stock[:6],
        }'''

if OLD_SUMMARY in py:
    py = py.replace(OLD_SUMMARY, NEW_SUMMARY)
    print("✓ Added estimated_revenue_30d to /api/summary")
else:
    print("⚠ Summary endpoint target not found — skipping")

py_path.write_text(py, encoding="utf-8")
print(f"app.py updated ({len(py)} chars)")

print("\nAll patches applied.")

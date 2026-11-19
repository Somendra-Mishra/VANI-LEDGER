"""Patch app.js: replace forecastDetail function and inject drawForecastSparkline."""
import re

with open('static/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Find and replace forecastDetail function
def find_function(src, name):
    """Find function start and end (balanced braces)."""
    marker = f'\nfunction {name}('
    start = src.find(marker)
    if start == -1:
        return -1, -1
    depth = 0
    end = start
    for i, ch in enumerate(src[start:], start):
        if ch == '{': depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    return start, end

NEW_SPARKLINE = '''
function drawForecastSparkline(days) {
  if (!days || !days.length) return '';
  const w = 580, h = 90, left = 24, right = 8, top = 8, bottom = 22;
  const max = Math.max(1, ...days.map(d => d.demand)) * 1.25;
  const xs = i => left + i * (w - left - right) / Math.max(1, days.length - 1);
  const ys = v => top + (h - top - bottom) * (1 - v / max);
  const path = days.map((d, i) => `${i ? 'L' : 'M'} ${xs(i).toFixed(1)} ${ys(d.demand).toFixed(1)}`).join(' ');
  const area = `${path} L ${xs(days.length-1)} ${h-bottom} L ${xs(0)} ${h-bottom} Z`;
  const labels = days.map((d, i) => i % 3 === 0 || i === days.length - 1
    ? `<text class="axis-label" x="${xs(i)}" y="${h-5}" text-anchor="middle">${new Date(d.date+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</text>` : '').join('');
  const dots = days.map((d, i) => `<circle cx="${xs(i)}" cy="${ys(d.demand)}" r="${d.events && d.events.length ? 5 : 3}" fill="${d.events && d.events.length ? 'var(--amber)' : 'var(--accent)'}" opacity="0.9"><title>${d.date}: ${num(d.demand)} units${d.events && d.events.length ? ' — '+d.events.join(', ') : ''}</title></circle>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="14-day demand forecast" style="width:100%;height:90px">
    <defs><linearGradient id="fcastFill" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#fcastFill)"/>
    <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="1.8"/>
    ${dots}${labels}
  </svg>`;
}
'''

NEW_FORECAST_DETAIL = '''
function forecastDetail(f) {
  const max = Math.max(1, ...f.drivers.map(x => Math.abs(x.value)));
  const driverHTML = f.drivers.map(d => `
    <div class="driver-item">
      <div class="driver-top">
        <span>${esc(d.label)}</span>
        <strong>${d.value >= 0 ? '+' : ''}${num(d.value)} ${esc(f.unit)}</strong>
      </div>
      <div class="driver-track">
        <span style="width:${Math.min(100, Math.max(3, Math.abs(d.value) / max * 100))}%"></span>
      </div>
      <div class="helper-text">${esc(d.detail)}</div>
    </div>`).join('');

  const narrativeText = ((state.lang === 'hi' && f.reasons_hi && f.reasons_hi.length) ? f.reasons_hi : f.reasons).map(esc).join(' ');

  return `<section class="panel">
    <div class="panel-head">
      <div>
        <div class="panel-title">${esc(f.name)} · Demand Drivers / \u0915\u093e\u0930\u0923 \u0935\u093f\u0936\u094d\u0932\u0947\u0937\u0923</div>
        <div class="panel-subtitle">${esc(f.sku)} \u00b7 Lead time: ${f.lead_time_days} days \u00b7 Margin: ${num(f.gross_margin_pct)}%</div>
      </div>
      ${pill(f.data_readiness, f.data_readiness_level === 'strong' ? 'green' : f.data_readiness_level === 'none' ? 'red' : 'amber')}
    </div>
    <div class="panel-body">
      <div class="sim-kpis" style="margin:0 0 16px">
        <div class="sim-result">
          <small>RECOMMENDED ORDER</small>
          <strong>${num(f.recommended_qty)} ${esc(f.unit)}</strong>
          <p>${inr(f.recommended_cost)} order value</p>
        </div>
        <div class="sim-result">
          <small>REORDER THRESHOLD</small>
          <strong>${num(f.reorder_point)} ${esc(f.unit)}</strong>
          <p>Lead demand + safety buffer</p>
        </div>
        <div class="sim-result">
          <small>BASE DAILY DEMAND</small>
          <strong>${num(f.base_daily_demand)}</strong>
          <p>28-day daily average</p>
        </div>
        <div class="sim-result">
          <small>SAFETY BUFFER</small>
          <strong>${num(f.safety_stock)}</strong>
          <p>90% service level buffer</p>
        </div>
      </div>

      <div class="panel-title" style="margin-bottom:10px">Driver breakdown / \u092a\u094d\u0930\u092d\u093e\u0935 \u0918\u091f\u0915</div>
      <div class="driver-list">${driverHTML}</div>

      <div class="why-callout" style="margin:14px 0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <strong>Plain-Language Explanation / \u0906\u0938\u093e\u0928 \u0935\u094d\u092f\u093e\u0916\u094d\u092f\u093e:</strong>
          <div style="display:inline-flex;gap:4px">
            <button class="btn btn-small ${state.lang==='en'?'btn-primary':'btn-secondary'}" style="padding:2px 8px;font-size:11px" id="detailLangEn">EN</button>
            <button class="btn btn-small ${state.lang==='hi'?'btn-primary':'btn-secondary'}" style="padding:2px 8px;font-size:11px" id="detailLangHi">HI</button>
          </div>
        </div>
        <p id="detailNarrativeText" style="margin:4px 0 0">${narrativeText}</p>
      </div>

      ${f.daily_forecast && f.daily_forecast.length ? `
      <div class="panel-title" style="margin:14px 0 6px">14-day demand forecast / \u0905\u0917\u0932\u0947 14 \u0926\u093f\u0928 <span class="helper-text" style="font-size:10px;font-weight:400">\u26a1 = festival day</span></div>
      <div class="chart-wrap" style="overflow:hidden;border-radius:8px">${drawForecastSparkline(f.daily_forecast)}</div>` : ''}

      <div class="form-actions" style="margin-top:16px">
        <button class="btn btn-secondary" id="openDrawerBtn">Open Order Drawer / \u0911\u0930\u094d\u0921\u0930 \u0935\u093f\u0935\u0930\u0923 \u2192</button>
      </div>
    </div>
  </section>`;
}
'''

# Find and replace forecastDetail
start, end = find_function(content, 'forecastDetail')
if start != -1:
    content = content[:start] + NEW_FORECAST_DETAIL + content[end:]
    print(f"Replaced forecastDetail (chars {start}-{end})")
else:
    print("ERROR: Could not find forecastDetail")

# Insert drawForecastSparkline before forecastDetail
start2, _ = find_function(content, 'forecastDetail')
content = content[:start2] + NEW_SPARKLINE + content[start2:]
print(f"Inserted drawForecastSparkline before forecastDetail")

# 2. Wire detailLangEn/Hi buttons in renderForecasts event listeners
old_wiring = "  $('#openDrawerBtn')?.addEventListener('click', () => openRecommendationDrawer(chosen.product_id));\n  loadValidation();"
new_wiring = """  $('#openDrawerBtn')?.addEventListener('click', () => openRecommendationDrawer(chosen.product_id));
  $('#detailLangEn')?.addEventListener('click', () => setLang('en', chosen));
  $('#detailLangHi')?.addEventListener('click', () => setLang('hi', chosen));
  loadValidation();"""
if old_wiring in content:
    content = content.replace(old_wiring, new_wiring)
    print("Wired detailLangEn/Hi buttons")
else:
    print("WARNING: Could not find detailLang wiring target — checking...")
    idx = content.find("openDrawerBtn")
    print(f"openDrawerBtn found at: {idx}")
    print(repr(content[idx-50:idx+200]))

# 3. Add auto-seed on startup in renderPage
old_render = """  const renders = {
    dashboard: renderDashboard,
    inventory: renderInventory,
    inputs: renderInputs,
    forecasts: renderForecasts,
    simulator: renderSimulator,
    settings: renderSettings
  };
  (renders[state.page] || renderDashboard)();"""
new_render = """  // Auto-seed demo if workspace is empty (first launch experience)
  if (!state.products.length && state.page === 'dashboard') {
    try {
      const hdr = await api('/summary');
      if (!hdr.product_count) {
        const seed = await api('/demo/seed', {method: 'POST'});
        if (seed.seeded) { toast('Demo workspace loaded. Replace with your real data!', 'success'); await refreshData(); }
      }
    } catch(e) {}
  }
  const renders = {
    dashboard: renderDashboard,
    inventory: renderInventory,
    inputs: renderInputs,
    forecasts: renderForecasts,
    simulator: renderSimulator,
    settings: renderSettings
  };
  (renders[state.page] || renderDashboard)();"""
if old_render in content:
    content = content.replace(old_render, new_render)
    print("Added auto-seed on first launch")
else:
    print("WARNING: Could not find auto-seed injection target")

with open('static/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done! app.js written successfully.")

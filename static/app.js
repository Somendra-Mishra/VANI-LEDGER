const API = '/api';
const state = {
  page: 'dashboard',
  products: [],
  summary: null,
  forecasts: [],
  purchaseOrders: [],
  selectedForecastId: null,
  simulationProductId: null,
  drawerForecastId: null,
  voiceDraft: null,
  ocrDraft: null,
  editingProductId: null,
  lang: localStorage.getItem('vani_lang') || 'en'
};

function setLang(lang, f) {
  state.lang = lang;
  localStorage.setItem('vani_lang', lang);
  const curF = f || state.forecasts.find(x => x.product_id === state.drawerForecastId) || state.forecasts.find(x => x.product_id === state.selectedForecastId);
  const narrative = (lang === 'hi' && curF?.reasons_hi && curF.reasons_hi.length) ? curF.reasons_hi : (curF?.reasons || []);
  const text = narrative.join(' ');
  if ($('#drawerNarrativeText')) $('#drawerNarrativeText').textContent = text || (lang==='hi'?'व्याख्या उपलब्ध नहीं है।':'No explanation available.');
  if ($('#detailNarrativeText')) $('#detailNarrativeText').textContent = text || (lang==='hi'?'व्याख्या उपलब्ध नहीं है।':'No explanation available.');
  
  $$('#drawerLangEn, #detailLangEn').forEach(b => b.className = `btn btn-small ${lang==='en'?'btn-primary':'btn-secondary'}`);
  $$('#drawerLangHi, #detailLangHi').forEach(b => b.className = `btn btn-small ${lang==='hi'?'btn-primary':'btn-secondary'}`);
}

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const esc = (v='') => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inr = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(n||0));
const num = n => new Intl.NumberFormat('en-IN',{maximumFractionDigits:1}).format(Number(n||0));
const today = () => new Date().toISOString().slice(0,10);
const fmtDate = s => { if(!s) return '—'; const d=new Date(`${s}T00:00:00`); return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); };
const initials = name => String(name||'').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();

// Theme Management
function initTheme() {
  const saved = localStorage.getItem('vani_theme') || 'light';
  applyTheme(saved);
  $('#themeToggle')?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('vani_theme', theme);
  const btn = $('#themeToggle');
  if (btn) {
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  }
}

async function api(path, options={}) {
  const opts = {...options, headers:{...(options.headers||{})}};
  if (opts.body && !(opts.body instanceof FormData) && typeof opts.body !== 'string') {
    opts.headers['Content-Type']='application/json'; opts.body=JSON.stringify(opts.body);
  }
  const res = await fetch(API+path, opts);
  const ct = res.headers.get('content-type')||'';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if(!res.ok) throw new Error(data?.detail || data?.message || `Request failed (${res.status})`);
  return data;
}

function toast(message, type='success') {
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  $('#toastRegion').append(node);
  setTimeout(() => node.remove(), 4000);
}

function loading(message='Loading…') {
  $('#pageContent').innerHTML = `<div class="loading-state"><div class="spinner"></div><span>${esc(message)}</span></div>`;
}

function heading(title, subtitle, actions='') {
  return `<div class="page-heading">
    <div>
      <div class="eyebrow">SELLER INTELLIGENCE / ${esc(state.page.toUpperCase())}</div>
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </div>
    <div class="heading-actions">${actions}</div>
  </div>`;
}

function panel(title, subtitle, body, extra='') {
  return `<section class="panel ${extra}">
    <div class="panel-head">
      <div>
        <div class="panel-title">${title}</div>
        ${subtitle ? `<div class="panel-subtitle">${subtitle}</div>` : ''}
      </div>
    </div>
    <div class="panel-body">${body}</div>
  </section>`;
}

function pill(text, kind='gray') {
  return `<span class="status-pill pill-${kind}"><span class="tiny-dot"></span>${esc(text)}</span>`;
}

function productMark(name) {
  return `<div class="alert-product-mark">${esc(initials(name))}</div>`;
}

function productOptions(selected='') {
  return state.products.map(p => `<option value="${p.id}" ${String(p.id)===String(selected)?'selected':''}>${esc(p.name)} · ${esc(p.sku)}</option>`).join('');
}

function empty(message, detail='') {
  return `<div class="empty-state"><strong>${esc(message)}</strong>${esc(detail)}</div>`;
}

async function refreshData() {
  const [products, summary, forecasts, pos] = await Promise.all([
    api('/products'),
    api('/summary'),
    api('/forecasts'),
    api('/purchase-orders').catch(() => [])
  ]);
  state.products = products;
  state.summary = summary;
  state.forecasts = forecasts.items;
  state.purchaseOrders = pos;
  if (!state.selectedForecastId && state.forecasts.length) state.selectedForecastId = state.forecasts[0].product_id;
  if (!state.simulationProductId && state.forecasts.length) state.simulationProductId = state.forecasts[0].product_id;
  $('#navProductCount').textContent = products.length;
}

function setPage(page) {
  state.page = page;
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  $('#pageName').textContent = ({
    dashboard: 'Overview',
    inventory: 'Inventory',
    inputs: 'Sales & inputs',
    forecasts: 'Forecast & why',
    simulator: 'What-if simulator',
    settings: 'Events & settings'
  })[page] || 'Overview';
  renderPage();
  $('#sidebar').classList.remove('open');
}

async function renderPage() {
  loading();
  try {
    await refreshData();
  } catch (e) {
    $('#pageContent').innerHTML = `<div class="notice danger">Unable to connect to the local VANI-LEDGER API: ${esc(e.message)}. Restart the server.</div>`;
    return;
  }
  // Auto-seed demo if workspace is empty (first launch experience)
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
  (renders[state.page] || renderDashboard)();
}

// -------------------------------------------------------------
// 1. DASHBOARD / OVERVIEW
// -------------------------------------------------------------
function renderDashboard() {
  const s = state.summary || {};
  const low = s.low_stock_items || [];
  const act = `<button class="btn btn-secondary" id="loadDemo">↻ Load demo workspace</button><button class="btn btn-primary" data-goto="inputs">＋ Add business data</button>`;
  const metrics = `<div class="metric-grid">
    <div class="metric-card"><div class="metric-top">ACTIVE PRODUCTS / कुल सामान <span class="metric-icon">▤</span></div><div class="metric-value">${num(s.product_count)}</div><div class="metric-foot">Items tracked in this store</div></div>
    <div class="metric-card"><div class="metric-top">UNITS SOLD · 30 DAYS / 30 दिन की बिक्री <span class="metric-icon">↗</span></div><div class="metric-value">${num(s.units_sold_30d)}</div><div class="metric-foot">From recorded sales ledger</div></div>
    <div class="metric-card"><div class="metric-top">INVENTORY COST VALUE / माल की कीमत <span class="metric-icon">₹</span></div><div class="metric-value">${inr(s.inventory_cost_value)}</div><div class="metric-foot">Current stock × unit cost</div></div>
    <div class="metric-card"><div class="metric-top">REORDER ALERTS / नया माल मंगाना है <span class="metric-icon">⌁</span></div><div class="metric-value">${num(s.reorder_alerts)}</div><div class="metric-foot ${s.reorder_alerts?'warn':'good'}">${s.reorder_alerts?'Products at or below reorder threshold':'Stock levels are optimal'}</div></div>
    <div class="metric-card"><div class="metric-top">RECOMMENDED SPEND / सुझावित खर्च <span class="metric-icon">↯</span></div><div class="metric-value">${inr(s.recommended_spend)}</div><div class="metric-foot ${s.recommended_spend>s.weekly_budget?'warn':'good'}">Budget: ${inr(s.weekly_budget)} · ${s.recommended_spend>s.weekly_budget?'Over budget':'Within budget'}</div></div>
    <div class="metric-card"><div class="metric-top">EST. REVENUE · 30 DAYS / 30 दिन की आमदनी <span class="metric-icon">₹</span></div><div class="metric-value">${inr(s.estimated_revenue_30d)}</div><div class="metric-foot good">Based on recorded sales × selling price</div></div>
  </div>`;

  $('#pageContent').innerHTML = heading('Good day, seller.','A clear view of stock, demand and working capital.', act) + metrics + `
    <div class="dashboard-grid">
      ${panel('Sales pulse / बिक्री का ट्रेंड', 'Daily units sold · last 14 days', `<div class="chart-wrap" id="salesChart"><div class="empty-state">Loading trend…</div></div><div class="helper-text"><span class="legend-dot"></span> Recorded sales across all products. Click recommendations on the right to see why they are suggested.</div>`)}
      ${panel('Decision queue / तुरंत ऑर्डर करने की सूची', 'Click any product to inspect full explanation & order', low.length ? `<div class="alert-list">${low.map(x=>`
        <div class="alert-row clickable" data-open-drawer="${x.product_id}" title="Click to view why this order is recommended">
          ${productMark(x.name)}
          <div class="alert-info">
            <strong>${esc(x.name)}</strong>
            <small>${esc(x.sku)} · ${x.lead_time_days} day lead time · <b>Click for advice →</b></small>
          </div>
          <div class="alert-qty">
            <strong>${num(x.recommended_qty)} ${esc(x.unit)}</strong>
            <small>${inr(x.recommended_cost)} value</small>
          </div>
        </div>`).join('')}</div><button class="btn btn-secondary btn-small" style="width:100%;margin-top:10px" data-goto="forecasts">View all SKU forecasts →</button>` : empty('No urgent reorder alerts', 'Add products and sales history to activate forecasting.'))}
    </div>
    <div class="two-panel-grid">
      <div class="insight-card">
        <div class="insight-symbol">◈</div>
        <div>
          <strong>Transparent Decision Advice / पारदर्शी सलाह</strong>
          <p>Click any item above to open the Slide-Over explanation drawer. It shows baseline demand, 14-day trend, festival uplifts, and safety buffer without any AI hallucination.</p>
        </div>
      </div>
      <div class="insight-card">
        <div class="insight-symbol">⌘</div>
        <div>
          <strong>Human Agency & Instant Order / दुकानदार का नियंत्रण</strong>
          <p>Adjust suggested quantities with a live slider to see cash freed and shortfall risk, then approve and send an instant WhatsApp order slip to your supplier.</p>
        </div>
      </div>
    </div>`;

  $('#loadDemo').addEventListener('click', async () => {
    try {
      const r = await api('/demo/seed', {method:'POST'});
      toast(r.message, r.seeded ? 'success' : '');
      await renderPage();
    } catch(e) { toast(e.message, 'error'); }
  });
  $$('[data-goto]').forEach(b => b.addEventListener('click', () => setPage(b.dataset.goto)));
  $$('[data-open-drawer]').forEach(el => el.addEventListener('click', () => openRecommendationDrawer(Number(el.dataset.openDrawer))));
  loadTrend();
}

async function loadTrend() {
  try {
    const data = await api('/trends?days=14');
    const box = $('#salesChart');
    if (!box) return;
    box.innerHTML = drawChart(data);
  } catch(e) {}
}

function drawChart(data) {
  if (!data.length || data.every(x => x.quantity === 0)) {
    return `<div class="empty-state">No sales history yet.<br/>Import a CSV or load the demo workspace.</div>`;
  }
  const w = 640, h = 190, left = 26, right = 10, top = 12, bottom = 26;
  const max = Math.max(1, ...data.map(x => x.quantity)) * 1.2;
  const x = i => left + i * (w - left - right) / Math.max(1, data.length - 1);
  const y = v => top + (h - top - bottom) * (1 - v / max);
  const path = data.map((d, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(d.quantity).toFixed(1)}`).join(' ');
  const area = `${path} L ${x(data.length - 1)} ${h - bottom} L ${x(0)} ${h - bottom} Z`;
  const labels = data.map((d, i) => i % 3 === 0 || i === data.length - 1 ? `<text class="axis-label" x="${x(i)}" y="${h - 7}" text-anchor="middle">${new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', {day: '2-digit', month: 'short'})}</text>` : '').join('');
  const grids = [0.25, 0.5, 0.75, 1].map(t => `<line class="chart-grid" x1="${left}" x2="${w - right}" y1="${y(max * t)}" y2="${y(max * t)}"/>`).join('');
  const dots = data.map((d, i) => `<circle class="chart-dot" cx="${x(i)}" cy="${y(d.quantity)}" r="3"><title>${d.date}: ${num(d.quantity)} units</title></circle>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Daily sales trend">
    <defs>
      <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${grids}<path class="chart-fill" d="${area}"/><path class="chart-line" d="${path}"/>${dots}${labels}
  </svg>`;
}

// -------------------------------------------------------------
// 2. SLIDE-OVER DRAWER (RECOMMENDATION & EXPLANATION)
// -------------------------------------------------------------
function openRecommendationDrawer(productId) {
  const f = state.forecasts.find(x => x.product_id === productId) || state.forecasts[0];
  if (!f) return;
  state.drawerForecastId = f.product_id;

  $('#drawerTitle').textContent = `${f.name} (${f.sku})`;
  const drawerBody = $('#drawerBody');
  if (!drawerBody) return;

  const max = Math.max(1, ...f.drivers.map(x => Math.abs(x.value)));
  const driverHTML = f.drivers.map(d => `
    <div class="driver-item">
      <div class="driver-top">
        <span>${esc(d.label)}</span>
        <strong>${d.value >= 0 ? '+' : ''}${num(d.value)} ${esc(f.unit)}</strong>
      </div>
      <div class="driver-track">
        <span style="width: ${Math.min(100, Math.max(4, Math.abs(d.value) / max * 100))}%"></span>
      </div>
      <div class="helper-text" style="font-size:10px">${esc(d.detail)}</div>
    </div>`).join('');

  drawerBody.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>
        <span class="tag">${esc(f.category)}</span>
        <span style="font-size:11px;color:var(--muted);margin-left:6px">Supplier lead time: <b>${f.lead_time_days} days</b></span>
      </div>
      ${pill(f.data_readiness, f.data_readiness_level === 'strong' ? 'green' : f.data_readiness_level === 'none' ? 'red' : 'amber')}
    </div>

    <!-- Recommendation Summary Banner -->
    <div class="notice ${f.recommended_qty ? 'warn' : 'success'}" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <strong style="font-size:14px">${f.recommended_qty ? `Suggested Order: ${num(f.recommended_qty)} ${esc(f.unit)}` : 'Stock is sufficient — No order needed'}</strong>
        <span style="font-weight:700">${f.recommended_qty ? inr(f.recommended_cost) : '₹0'}</span>
      </div>
      <div style="font-size:10px;margin-top:4px">
        Available: <b>${num(f.current_stock + f.incoming_stock)} ${esc(f.unit)}</b> (On-hand: ${num(f.current_stock)}, Incoming: ${num(f.incoming_stock)}) · Reorder threshold: <b>${num(f.reorder_point)} ${esc(f.unit)}</b>
      </div>
    </div>

    <!-- 4 Drivers Breakdown -->
    <div class="panel-title" style="margin-bottom:10px">Why this order? / यह ऑर्डर क्यों जरूरी है?</div>
    <div class="driver-list" style="margin-bottom:16px">${driverHTML}</div>

    <!-- Plain Language Explanation -->
    <div class="why-callout" style="margin-bottom:18px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <strong>Plain-Language Explanation / आसान भाषा में:</strong>
        <div style="display:inline-flex;gap:4px">
          <button class="btn btn-small ${state.lang==='en'?'btn-primary':'btn-secondary'}" style="padding:2px 8px;font-size:11px" id="drawerLangEn">EN</button>
          <button class="btn btn-small ${state.lang==='hi'?'btn-primary':'btn-secondary'}" style="padding:2px 8px;font-size:11px" id="drawerLangHi">HI</button>
        </div>
      </div>
      <p id="drawerNarrativeText" style="margin:5px 0 0">${((state.lang === 'hi' && f.reasons_hi && f.reasons_hi.length) ? f.reasons_hi : f.reasons).map(esc).join(' ')}</p>
    </div>

    <!-- Instant Mini-Simulator -->
    <div class="panel form-panel" style="padding:15px;margin-bottom:16px">
      <div class="panel-title" style="margin-bottom:4px">Manual Quantity Override / ऑर्डर संख्या बदलें</div>
      <div class="panel-subtitle">Adjust slider to see instant cash and stockout impact.</div>
      
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:12px">
        <div class="quantity-display" id="drawerSimQtyDisplay">${f.recommended_qty}</div>
        <span class="helper-text">${esc(f.unit)} override</span>
      </div>
      
      <input id="drawerSimRange" class="range-control" type="range" min="0" max="${Math.max(25, f.recommended_qty * 2 + 10)}" step="1" value="${f.recommended_qty}"/>
      <div class="range-values"><span>0 units</span><span>${Math.max(25, f.recommended_qty * 2 + 10)} units</span></div>
      
      <div id="drawerSimResults" style="margin-top:12px">
        <div class="empty-state" style="padding:15px">Calculating financial impact…</div>
      </div>
    </div>

    <!-- Actions -->
    <div style="display:grid;gap:8px">
      <button class="btn btn-primary" id="drawerPlaceOrderBtn" style="padding:12px;font-size:13px">
        ✓ Approve & Place Order / ऑर्डर दर्ज करें
      </button>
      <button class="btn btn-secondary" id="drawerWhatsAppBtn" style="padding:10px;font-size:12px">
        💬 Share to WhatsApp / सप्लायर को व्हाट्सएप भेजें
      </button>
    </div>`;

  $('#recommendationDrawer').classList.add('open');
  $('#drawerBackdrop').classList.add('active');

  const range = $('#drawerSimRange');
  range.addEventListener('input', () => updateDrawerSim(f.product_id, range.value));
  updateDrawerSim(f.product_id, f.recommended_qty);

  $('#drawerPlaceOrderBtn').addEventListener('click', () => placeOrderFromDrawer(f));
  $('#drawerWhatsAppBtn').addEventListener('click', () => shareWhatsAppFromDrawer(f));
  $('#drawerLangEn')?.addEventListener('click', () => setLang('en', f));
  $('#drawerLangHi')?.addEventListener('click', () => setLang('hi', f));
}

function closeRecommendationDrawer() {
  $('#recommendationDrawer')?.classList.remove('open');
  $('#drawerBackdrop')?.classList.remove('active');
}

async function updateDrawerSim(productId, quantity) {
  const q = Math.max(0, Number(quantity) || 0);
  $('#drawerSimQtyDisplay').textContent = num(q);
  try {
    const r = await api('/simulate', {method:'POST', body:{product_id: productId, quantity: q}});
    const box = $('#drawerSimResults');
    if (!box) return;
    box.innerHTML = `
      <div class="sim-kpis" style="margin:0">
        <div class="sim-result">
          <small>CASH COMMITTED</small>
          <strong>${inr(r.order_cost)}</strong>
        </div>
        <div class="sim-result">
          <small>CASH FREED</small>
          <strong style="color:${r.cash_saved_vs_recommendation?'var(--teal)':'var(--ink-heading)'}">${inr(r.cash_saved_vs_recommendation)}</strong>
        </div>
        <div class="sim-result">
          <small>SHORTFALL EXPOSURE</small>
          <strong style="color:${r.stockout_exposure_index>40?'var(--red)':'var(--ink-heading)'}">${num(r.stockout_exposure_index)}%</strong>
        </div>
        <div class="sim-result">
          <small>DAYS OF COVER</small>
          <strong>${num(r.estimated_days_of_cover)} d</strong>
        </div>
      </div>
      ${r.shelf_life_warning ? `<div class="notice warn" style="margin-top:8px">Shelf-life alert: ${num(r.estimated_days_of_cover)} days exceeds ${r.shelf_life_days} day expiry!</div>` : ''}
      ${r.budget_exceeded ? `<div class="notice danger" style="margin-top:8px">Total orders exceed your ₹${num(r.budget)} weekly budget limit.</div>` : ''}`;
  } catch(e) {}
}

async function placeOrderFromDrawer(f) {
  const qty = Number($('#drawerSimRange').value);
  if (qty <= 0) { toast('Please choose an order quantity greater than 0.', 'error'); return; }
  try {
    const r = await api('/purchase-orders', {
      method: 'POST',
      body: {
        product_id: f.product_id,
        quantity: qty,
        unit_cost: f.cost_price,
        notes: 'Placed from VANI-LEDGER Recommendation Drawer'
      }
    });
    toast(r.message, 'success');
    closeRecommendationDrawer();
    await renderPage();
  } catch(e) { toast(e.message, 'error'); }
}

function shareWhatsAppFromDrawer(f) {
  const qty = Number($('#drawerSimRange').value);
  const total = qty * f.cost_price;
  const msg = `*VANI-LEDGER Purchase Order*\n------------------------\n*Product:* ${f.name} (${f.sku})\n*Quantity:* ${qty} ${f.unit}\n*Est. Value:* ${inr(total)}\n*Lead Time Requested:* ${f.lead_time_days} days\n\nPlease confirm availability and delivery date. Thank you!`;
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

// -------------------------------------------------------------
// 3. INVENTORY REGISTER
// -------------------------------------------------------------
function renderInventory() {
  const editing = state.editingProductId ? state.products.find(p => p.id === state.editingProductId) : null;
  const form = `<form id="productForm">
    <div class="form-grid">
      <div class="field"><label>PRODUCT NAME / सामान का नाम</label><input name="name" required placeholder="e.g. Mustard Oil" value="${esc(editing?.name||'')}"/></div>
      <div class="field"><label>SKU / CODE</label><input name="sku" required placeholder="e.g. OIL-1L" value="${esc(editing?.sku||'')}"/></div>
      <div class="field"><label>CATEGORY / श्रेणी</label><select name="category">
        <option ${editing?.category==='Staples'?'selected':''}>Staples</option>
        <option ${editing?.category==='Dairy'?'selected':''}>Dairy</option>
        <option ${editing?.category==='Snacks'?'selected':''}>Snacks</option>
        <option ${editing?.category==='Beverages'?'selected':''}>Beverages</option>
        <option ${editing?.category==='General'?'selected':''}>General</option>
      </select></div>
      <div class="field"><label>UNIT / इकाई</label><input name="unit" value="${esc(editing?.unit||'units')}" placeholder="packets / bottles / kg"/></div>
      <div class="field"><label>CURRENT STOCK / दुकान में माल</label><input name="current_stock" type="number" min="0" step="0.1" value="${editing?.current_stock??0}" required/></div>
      <div class="field"><label>INCOMING STOCK / आ रहा माल</label><input name="incoming_stock" type="number" min="0" step="0.1" value="${editing?.incoming_stock??0}"/></div>
      <div class="field"><label>UNIT COST (₹) / खरीद भाव</label><input name="cost_price" type="number" min="0" step="0.01" value="${editing?.cost_price??0}" required/></div>
      <div class="field"><label>SELLING PRICE (₹) / बिक्री भाव</label><input name="selling_price" type="number" min="0" step="0.01" value="${editing?.selling_price??0}" required/></div>
      <div class="field"><label>SUPPLIER LEAD TIME (DAYS) / डिलीवरी के दिन</label><input name="lead_time_days" type="number" min="1" max="90" value="${editing?.lead_time_days??3}" required/></div>
      <div class="field"><label>SHELF LIFE (DAYS) / एक्सपायरी के दिन</label><input name="shelf_life_days" type="number" min="1" max="3650" value="${editing?.shelf_life_days??''}" placeholder="Optional"/></div>
    </div>
    <div class="form-actions">
      ${editing ? '<button type="button" class="btn btn-secondary" id="cancelEdit">Cancel edit</button>' : ''}
      <button class="btn btn-primary" type="submit">${editing ? 'Save changes' : '＋ Add product'}</button>
    </div>
  </form>`;

  const rows = state.products.map(p => {
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
          <button class="text-link" data-open-drawer="${p.id}">Advice / सलाह</button>
          <button class="text-link" data-edit-product="${p.id}">Edit</button>
          <button class="text-link" style="color:var(--red)" data-delete-product="${p.id}">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  $('#pageContent').innerHTML = heading('Inventory register / स्टॉक रजिस्टर', 'Maintain the SKU catalog, stock levels and supplier lead times.', '<button class="btn btn-secondary" id="refreshInventory">↻ Refresh</button>') + `
    <div class="section-grid">
      <section class="panel form-panel">
        <div class="panel-title">${editing ? 'Edit product' : 'Add product / नया सामान जोड़ें'}</div>
        <div class="panel-subtitle">Product setup · prices · stock · supplier turnaround</div>
        <div class="form-separator"></div>
        ${form}
      </section>
      <div class="section-stack">
        ${panel('Inventory valuation', 'Current stock at cost', `
          <div class="metric-grid" style="grid-template-columns:1fr 1fr;margin:0">
            <div class="metric-card" style="box-shadow:none">
              <div class="metric-top">TOTAL SKUs</div>
              <div class="metric-value">${state.products.length}</div>
            </div>
            <div class="metric-card" style="box-shadow:none">
              <div class="metric-top">STOCK VALUE</div>
              <div class="metric-value" style="font-size:20px">${inr(state.summary?.inventory_cost_value)}</div>
            </div>
          </div>`)}
        ${panel('Stock hygiene', 'Key checks for accurate forecasting', `
          <div class="alert-list">
            <div class="alert-row"><span class="metric-icon">✓</span><div class="alert-info"><strong>Supplier lead time matters</strong><small>Accurate delivery days protect against stockouts.</small></div></div>
            <div class="alert-row"><span class="metric-icon">◷</span><div class="alert-info"><strong>Perishable items</strong><small>Set shelf life for dairy and bakery to trigger spoilage alerts.</small></div></div>
          </div>`)}
      </div>
    </div>
    <div style="height:16px"></div>
    ${panel('Product catalogue', `${state.products.length} tracked items`, state.products.length ? `<div class="table-wrap"><table><thead><tr><th>PRODUCT</th><th>ON HAND</th><th>INCOMING</th><th>UNIT COST</th><th>MARGIN</th><th>LEAD TIME</th><th>SHELF LIFE</th><th>ACTIONS</th></tr></thead><tbody>${rows}</tbody></table></div>` : empty('No products added yet', 'Create your first SKU using the form above.'))}`;

  $('#productForm').addEventListener('submit', submitProduct);
  $('#cancelEdit')?.addEventListener('click', () => { state.editingProductId = null; renderInventory(); });
  $('#refreshInventory').addEventListener('click', renderPage);
  $$('[data-open-drawer]').forEach(b => b.addEventListener('click', () => openRecommendationDrawer(Number(b.dataset.openDrawer))));
  $$('[data-edit-product]').forEach(b => b.addEventListener('click', () => { state.editingProductId = Number(b.dataset.editProduct); renderInventory(); window.scrollTo({top: 0, behavior: 'smooth'}); }));
  $$('[data-delete-product]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this product and its attached sales/orders?')) return;
    try {
      await api(`/products/${b.dataset.deleteProduct}`, {method: 'DELETE'});
      toast('Product deleted.');
      await renderPage();
    } catch(e) { toast(e.message, 'error'); }
  }));
}

async function submitProduct(e) {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const data = Object.fromEntries(fd.entries());
  for (const k of ['current_stock', 'incoming_stock', 'cost_price', 'selling_price', 'lead_time_days']) {
    data[k] = Number(data[k] || 0);
  }
  data.shelf_life_days = data.shelf_life_days ? Number(data.shelf_life_days) : null;
  try {
    await api(state.editingProductId ? `/products/${state.editingProductId}` : '/products', {
      method: state.editingProductId ? 'PUT' : 'POST',
      body: data
    });
    toast(state.editingProductId ? 'Product updated.' : 'Product added.');
    state.editingProductId = null;
    await renderPage();
  } catch(e) { toast(e.message, 'error'); }
}

// -------------------------------------------------------------
// 4. SALES & MULTIMODAL INPUTS
// -------------------------------------------------------------
function renderInputs() {
  const options = productOptions();
  $('#pageContent').innerHTML = heading('Sales & business inputs / बिक्री और माल आवक', 'Fast counter sales, voice capture, and bill scanning without manual friction.', `<button class="btn btn-secondary" id="downloadCsv">↓ Export sales CSV</button>`) + `
    <div class="section-grid">
      <div class="section-stack">
        <section class="panel form-panel">
          <div class="panel-title">Record a counter sale / बिक्री दर्ज करें</div>
          <div class="panel-subtitle">Decrements current physical stock and updates demand history.</div>
          <div class="form-separator"></div>
          <form id="saleForm">
            <div class="form-grid">
              <div class="field"><label>PRODUCT / सामान</label><select name="product_id" required>${options||'<option value="">Add a product first</option>'}</select></div>
              <div class="field"><label>QUANTITY SOLD / संख्या</label><input name="quantity" type="number" min="0.01" step="0.1" required placeholder="e.g. 12"/></div>
              <div class="field"><label>DATE</label><input name="sale_date" type="date" value="${today()}" required/></div>
              <div class="field"><label>NOTES (OPTIONAL)</label><input name="notes" placeholder="Counter sale / voice entry"/></div>
            </div>
            <div class="form-actions"><button class="btn btn-primary" ${state.products.length?'':'disabled'}>＋ Save sale / बिक्री सुरक्षित करें</button></div>
          </form>
        </section>

        <section class="panel form-panel">
          <div class="panel-title">Record a purchase receipt / माल आवक दर्ज करें</div>
          <div class="panel-subtitle">Increments on-hand stock from supplier delivery.</div>
          <div class="form-separator"></div>
          <form id="purchaseForm">
            <div class="form-grid">
              <div class="field"><label>PRODUCT / सामान</label><select name="product_id" required>${options||'<option value="">Add a product first</option>'}</select></div>
              <div class="field"><label>QUANTITY RECEIVED / संख्या</label><input name="quantity" type="number" min="0.01" step="0.1" required placeholder="e.g. 24"/></div>
              <div class="field"><label>DATE</label><input name="purchase_date" type="date" value="${today()}" required/></div>
              <div class="field"><label>UNIT COST (₹)</label><input name="unit_cost" type="number" min="0" step="0.01" placeholder="Optional"/></div>
            </div>
            <div class="form-actions"><button class="btn btn-primary" ${state.products.length?'':'disabled'}>＋ Add received stock</button></div>
          </form>
        </section>

        <section class="panel form-panel">
          <div class="panel-title">Import sales CSV / पुरानी बिक्री फाइल अपलोड करें</div>
          <div class="panel-subtitle">Columns required: product, date, quantity. Matches name or SKU.</div>
          <div class="form-separator"></div>
          <label class="upload-zone" for="salesCsv">
            <div class="upload-icon">⇧</div>
            <strong>Choose sales CSV file</strong>
            <small>Updates historical demand without changing today's physical stock</small>
          </label>
          <input class="file-input" type="file" accept=".csv,text/csv" id="salesCsv"/>
          <div id="csvResult"></div>
          <div style="margin-top:10px"><a class="text-link" href="/static/sample_sales.csv" download>Download sample CSV template →</a></div>
        </section>
      </div>

      <div class="section-stack">
        <!-- Voice Input -->
        <section class="panel form-panel">
          <div class="panel-title">VANI voice capture / बोलकर दर्ज करें</div>
          <div class="panel-subtitle">Speak in Hindi, Hinglish or English. Multi-item compound sentences supported!</div>
          <div class="form-separator"></div>
          <div class="voice-box">
            <div class="voice-visual" id="voiceVisual"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
            <div class="field"><label>VOICE TRANSCRIPT / TEXT</label><textarea id="voiceText" placeholder="Example: 5 packet doodh aur 2 kilo chini bechi (Or: Aaj 12 crate doodh bika)"></textarea></div>
            <div class="voice-actions">
              <button type="button" class="btn btn-primary" id="startVoice">● Speak now / बोलें</button>
              <button type="button" class="btn btn-secondary" id="parseVoice">Understand text</button>
            </div>
            <div class="helper-text" style="margin-top:8px">Uses browser Web Speech API. Multi-item splitting handles "aur", "and", and Hindi numbers. No unreviewed speech is committed.</div>
          </div>
          <div id="voiceResult"></div>
        </section>

        <!-- Bill Scan -->
        <section class="panel form-panel">
          <div class="panel-title">Scan handwritten bill / पर्ची या बिल स्कैन करें</div>
          <div class="panel-subtitle">OCR drafts product lines; the seller confirms each quantity.</div>
          <div class="form-separator"></div>
          <label class="upload-zone" for="billImage">
            <div class="upload-icon">▧</div>
            <strong>Upload bill photo / फोटो अपलोड करें</strong>
            <small>PNG, JPG or WEBP · clear photo works best</small>
          </label>
          <input class="file-input" id="billImage" type="file" accept="image/png,image/jpeg,image/webp"/>
          <div id="ocrResult"></div>
          <div class="notice info" style="margin-top:12px">Bill OCR is assistive. Always review matched quantities before confirming stock.</div>
          <div style="margin-top:8px"><a class="text-link" href="/static/sample_bill.png" download>Download sample bill image →</a></div>
        </section>
      </div>
    </div>
    <div style="height:16px"></div>
    ${panel('Recent transactions / हाल की बिक्री रिकॉर्ड', 'Latest counter transactions', `<div class="empty-state">Loading…</div>`)}`;

  $('#saleForm').addEventListener('submit', submitSale);
  $('#purchaseForm').addEventListener('submit', submitPurchase);
  $('#downloadCsv').addEventListener('click', () => window.location.href = '/api/export/sales.csv');
  $('#salesCsv').addEventListener('change', importCsv);
  $('#parseVoice').addEventListener('click', parseVoice);
  $('#startVoice').addEventListener('click', startVoiceRecognition);
  $('#billImage').addEventListener('change', scanBill);
  loadRecentSales();
}

async function submitSale(e) {
  e.preventDefault();
  const x = Object.fromEntries(new FormData(e.currentTarget).entries());
  x.product_id = Number(x.product_id);
  x.quantity = Number(x.quantity);
  try {
    await api('/sales', {method: 'POST', body: x});
    toast('Sale recorded; stock and demand history updated.');
    await renderPage();
  } catch(e) { toast(e.message, 'error'); }
}

async function submitPurchase(e) {
  e.preventDefault();
  const x = Object.fromEntries(new FormData(e.currentTarget).entries());
  x.product_id = Number(x.product_id);
  x.quantity = Number(x.quantity);
  x.unit_cost = Number(x.unit_cost || 0);
  try {
    await api('/purchases', {method: 'POST', body: x});
    toast('Purchase recorded; stock updated.');
    await renderPage();
  } catch(e) { toast(e.message, 'error'); }
}

async function loadRecentSales() {
  try {
    const sales = await api('/sales?limit=10');
    const target = $('#pageContent .panel:last-child .panel-body');
    if (!target) return;
    target.innerHTML = sales.length ? `<div class="table-wrap"><table><thead><tr><th>DATE</th><th>PRODUCT</th><th>QUANTITY</th><th>SOURCE</th><th>NOTES</th></tr></thead><tbody>${sales.map(s => `<tr><td>${fmtDate(s.sale_date)}</td><td><strong>${esc(s.product_name)}</strong><div class="table-muted">${esc(s.sku)}</div></td><td>${num(s.quantity)} ${esc(s.unit)}</td><td><span class="status-pill pill-blue">${esc(s.source)}</span></td><td>${esc(s.notes||'—')}</td></tr>`).join('')}</tbody></table></div>` : empty('No sales recorded', 'Add a sale or load demo data.');
  } catch(e) {}
}

async function importCsv(e) {
  const file = e.target.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  $('#csvResult').innerHTML = '<div class="notice info">Validating and importing CSV rows…</div>';
  try {
    const r = await api('/sales/import', {method: 'POST', body: fd});
    $('#csvResult').innerHTML = `<div class="result-box"><div class="notice ${r.skipped?'warn':'success'}">${esc(r.message)} Skipped: ${r.skipped}.</div>${r.errors?.length?`<pre>${esc(r.errors.join('\n'))}</pre>`:''}</div>`;
    toast(r.message, r.skipped ? '' : 'success');
    await refreshData();
  } catch(e) {
    $('#csvResult').innerHTML = `<div class="notice danger">${esc(e.message)}</div>`;
  }
  e.target.value = '';
}

async function parseVoice() {
  const text = $('#voiceText').value.trim();
  if (!text) { toast('Type or speak a sentence first.', 'error'); return; }
  try {
    const r = await api('/voice/parse', {method: 'POST', body: {text}});
    state.voiceDraft = r;
    renderVoiceDraft(r);
  } catch(e) { toast(e.message, 'error'); }
}

function renderVoiceDraft(r) {
  const box = $('#voiceResult');
  if (!box) return;
  if (!r.ok) {
    box.innerHTML = `<div class="result-box" style="margin-top:12px"><div class="notice warn">${esc(r.message)}</div></div>`;
    return;
  }

  // Multi-item draft review
  if (r.items && r.items.length > 1) {
    const rows = r.items.map((it, idx) => `
      <div class="result-row" style="gap:10px" data-voice-row="${idx}">
        <select class="input voice-item-product" data-idx="${idx}" style="flex:1">
          ${productOptions(it.product_id)}
        </select>
        <input class="input voice-item-qty" data-idx="${idx}" type="number" min="0.1" step="0.1" value="${it.quantity}" style="max-width:90px"/>
        <span style="font-size:11px;color:var(--muted)">${esc(it.unit)}</span>
      </div>`).join('');

    box.innerHTML = `
      <div class="result-box" style="margin-top:12px">
        <div class="notice success">${esc(r.message)}</div>
        <div class="panel-title" style="margin:12px 0 8px">${r.items.length} items detected / पाए गए सामान</div>
        <div style="display:grid;gap:8px">${rows}</div>
        <div class="field" style="margin-top:12px">
          <label>TRANSACTION TYPE / प्रकार</label>
          <select id="voiceMultiIntent">
            <option value="sale" ${r.intent==='sale'?'selected':''}>Sale (decrease stock) / बिक्री</option>
            <option value="purchase" ${r.intent==='purchase'?'selected':''}>Purchase (increase stock) / खरीद</option>
          </select>
        </div>
        <div class="form-actions"><button class="btn btn-primary" id="confirmMultiVoice">Confirm All Items / सभी सुरक्षित करें</button></div>
      </div>`;
    $('#confirmMultiVoice').addEventListener('click', confirmMultiVoiceDraft);
    return;
  }

  // Single-item draft review
  box.innerHTML = `
    <div class="result-box" style="margin-top:12px">
      <div class="notice success">${esc(r.message)}</div>
      <div class="form-grid" style="margin-top:12px">
        <div class="field"><label>DETECTED PRODUCT</label><select id="voiceProduct">${productOptions(r.product?.id)}</select></div>
        <div class="field"><label>QUANTITY</label><input id="voiceQuantity" type="number" min="0.1" step="0.1" value="${r.quantity}"/></div>
        <div class="field"><label>TRANSACTION TYPE</label><select id="voiceIntent">
          <option value="sale" ${r.intent==='sale'?'selected':''}>Sale (decrease stock) / बिक्री</option>
          <option value="purchase" ${r.intent==='purchase'?'selected':''}>Purchase (increase stock) / खरीद</option>
        </select></div>
      </div>
      <div class="form-actions"><button class="btn btn-primary" id="confirmVoice">Confirm & save / सुरक्षित करें</button></div>
    </div>`;
  $('#confirmVoice').addEventListener('click', confirmVoiceDraft);
}

async function confirmMultiVoiceDraft() {
  const intent = $('#voiceMultiIntent').value;
  const prodSelects = $$('.voice-item-product');
  const qtyInputs = $$('.voice-item-qty');
  try {
    for (let i = 0; i < prodSelects.length; i++) {
      const pid = Number(prodSelects[i].value);
      const q = Number(qtyInputs[i].value);
      if (q > 0) {
        if (intent === 'sale') {
          await api('/sales', {method: 'POST', body: {product_id: pid, quantity: q, sale_date: today(), source: 'voice_multi', notes: 'Confirmed multi-item voice sale'}});
        } else {
          await api('/purchases', {method: 'POST', body: {product_id: pid, quantity: q, purchase_date: today(), unit_cost: 0, source: 'voice_multi', notes: 'Confirmed multi-item voice purchase'}});
        }
      }
    }
    toast('All voice transaction lines confirmed and saved.');
    state.voiceDraft = null;
    await renderPage();
  } catch(e) { toast(e.message, 'error'); }
}

async function confirmVoiceDraft() {
  const product_id = Number($('#voiceProduct').value);
  const quantity = Number($('#voiceQuantity').value);
  const intent = $('#voiceIntent').value;
  if (!quantity || quantity <= 0) { toast('Enter a valid quantity.', 'error'); return; }
  try {
    if (intent === 'sale') {
      await api('/sales', {method: 'POST', body: {product_id, quantity, sale_date: today(), source: 'voice', notes: 'Seller-confirmed voice entry'}});
    } else {
      await api('/purchases', {method: 'POST', body: {product_id, quantity, purchase_date: today(), unit_cost: 0, source: 'voice', notes: 'Seller-confirmed voice entry'}});
    }
    toast('Confirmed voice entry saved.');
    state.voiceDraft = null;
    await renderPage();
  } catch(e) { toast(e.message, 'error'); }
}

function startVoiceRecognition() {
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Speech) { toast('Speech recognition is not supported in this browser. Type the sentence instead.', 'error'); return; }
  const rec = new Speech();
  rec.lang = 'hi-IN';
  rec.interimResults = true;
  rec.continuous = false;
  const btn = $('#startVoice'), visual = $('#voiceVisual');
  visual.classList.add('listening');
  btn.textContent = 'Listening…';
  rec.onresult = e => {
    let t = '';
    for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
    $('#voiceText').value = t;
  };
  rec.onerror = e => toast(`Speech error: ${e.error}. Type the sentence instead.`, 'error');
  rec.onend = () => {
    visual.classList.remove('listening');
    btn.textContent = '● Speak now / बोलें';
    if ($('#voiceText').value.trim()) parseVoice();
  };
  rec.start();
}

async function scanBill(e) {
  const file = e.target.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('file', file);
  $('#ocrResult').innerHTML = '<div class="notice info">Reading image and matching product catalog…</div>';
  try {
    const r = await api('/bills/scan', {method: 'POST', body: fd});
    state.ocrDraft = r;
    renderOcrDraft(r);
  } catch(e) {
    $('#ocrResult').innerHTML = `<div class="notice danger">${esc(e.message)}</div>`;
  }
  e.target.value = '';
}

function renderOcrDraft(r) {
  const box = $('#ocrResult');
  if (!box) return;
  const candidates = r.candidates || [];
  box.innerHTML = `
    <div class="result-box" style="margin-top:12px">
      <div class="notice info">${esc(r.notice)}</div>
      <div class="panel-title" style="margin:12px 0 6px">${candidates.length} candidate lines matched</div>
      ${candidates.length ? candidates.map((c, i) => `
        <div class="result-row" style="gap:10px">
          <div style="flex:1">
            <strong>${esc(c.product_name)}</strong>
            <div class="table-muted">${esc(c.raw_line)}</div>
          </div>
          <input class="inline-input ocr-qty" data-index="${i}" type="number" min="0.1" step="0.1" value="${c.quantity}" style="max-width:85px"/>
        </div>`).join('') : '<div class="helper-text">No confident product match found. Add stock manually.</div>'}
      <details style="margin-top:10px">
        <summary class="text-link">View extracted bill text</summary>
        <pre style="max-height:120px;overflow:auto;margin-top:6px">${esc(r.text||'No text detected')}</pre>
      </details>
      ${candidates.length ? '<div class="form-actions"><button class="btn btn-primary" id="applyOcr">Confirm lines & add stock</button></div>' : ''}
    </div>`;
  $('#applyOcr')?.addEventListener('click', applyOcrDraft);
}

async function applyOcrDraft() {
  const r = state.ocrDraft;
  if (!r) return;
  const inputs = $$('.ocr-qty');
  try {
    for (const input of inputs) {
      const c = r.candidates[Number(input.dataset.index)];
      const q = Number(input.value);
      if (q > 0) {
        await api('/purchases', {method: 'POST', body: {
          product_id: c.product_id,
          quantity: q,
          purchase_date: today(),
          unit_cost: 0,
          source: 'bill_ocr_reviewed',
          notes: `Reviewed from ${r.filename}`
        }});
      }
    }
    toast('Reviewed bill lines added to stock.');
    state.ocrDraft = null;
    await renderPage();
  } catch(e) { toast(e.message, 'error'); }
}

// -------------------------------------------------------------
// 5. FORECASTS & EXPLAINABILITY
// -------------------------------------------------------------
function renderForecasts() {
  const items = state.forecasts;
  const chosen = items.find(x => x.product_id === state.selectedForecastId) || items[0];
  if (chosen) state.selectedForecastId = chosen.product_id;

  const cards = items.map(f => `
    <div class="forecast-card ${chosen?.product_id === f.product_id ? 'selected' : ''}" data-select-forecast="${f.product_id}">
      <div class="forecast-card-top">
        <div class="forecast-product">
          ${productMark(f.name)}
          <div>
            <strong>${esc(f.name)}</strong>
            <small>${esc(f.sku)} · ${esc(f.category)}</small>
          </div>
        </div>
        <div class="forecast-number">
          <strong>${f.recommended_qty ? num(f.recommended_qty) : '—'}</strong>
          <small>${f.recommended_qty ? `${esc(f.unit)} to order` : 'No order now'}</small>
        </div>
      </div>
      <div class="forecast-meta">
        <span>Stock: ${num(f.current_stock)}</span>
        <span>Lead: ${f.lead_time_days}d</span>
        <span>${esc(f.data_readiness)}</span>
      </div>
    </div>`).join('');

  const detail = chosen ? forecastDetail(chosen) : empty('No products available', 'Add a product and record sales.');
  const budget = state.forecasts.reduce((a, x) => a + x.recommended_cost, 0);
  const cap = Number(state.summary?.weekly_budget || 50000);

  $('#pageContent').innerHTML = heading('Forecast & explainability / मांग का अनुमान और कारण', 'A transparent reorder plan with visible business drivers.', `
    <span class="status-pill ${budget>cap?'pill-amber':'pill-green'}">${inr(budget)} planned · ${inr(cap)} budget</span>
    <button class="btn btn-secondary" id="trainMl">✦ Train ML models</button>
    <button class="btn btn-secondary" id="refreshForecast">↻ Recalculate</button>`) + `
    <div class="forecast-layout">
      <section>${items.length ? cards : empty('No products in catalog', 'Add products first.')}</section>
      <section id="forecastDetail">
        ${detail}
        <div id="mlForecastPanel" class="panel" style="margin-top:14px">
          <div class="panel-body">
            <strong>Trainable ML demand signal (Random Forest)</strong>
            <p class="helper-text" style="margin:4px 0 10px">Train per-SKU supervised models using lag & rolling features.</p>
            <button class="btn btn-secondary btn-small" id="triggerMlTrain">Train models now →</button>
          </div>
        </div>
      </section>
    </div>
    <div style="height:18px"></div>
    <section class="panel" id="validationPanel"><div class="panel-body"><div class="empty-state">Loading holdout backtesting metrics…</div></div></section>`;

  $('#refreshForecast').addEventListener('click', renderPage);
  $('#trainMl')?.addEventListener('click', runMlTraining);
  $('#triggerMlTrain')?.addEventListener('click', runMlTraining);
  $$('[data-select-forecast]').forEach(b => b.addEventListener('click', () => {
    state.selectedForecastId = Number(b.dataset.selectForecast);
    renderForecasts();
    // After render, attempt to load ML feature importances if model is trained
    setTimeout(() => loadMlFeatureImportances(Number(b.dataset.selectForecast)), 200);
  }));
  // Also try to load on initial render
  setTimeout(() => { if (state.selectedForecastId) loadMlFeatureImportances(state.selectedForecastId); }, 300);
  $('#openDrawerBtn')?.addEventListener('click', () => openRecommendationDrawer(chosen.product_id));
  $('#detailLangEn')?.addEventListener('click', () => setLang('en', chosen));
  $('#detailLangHi')?.addEventListener('click', () => setLang('hi', chosen));
  loadValidation();
}

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
        <div class="panel-title">${esc(f.name)} · Demand Drivers / कारण विश्लेषण</div>
        <div class="panel-subtitle">${esc(f.sku)} · Lead time: ${f.lead_time_days} days · Margin: ${num(f.gross_margin_pct)}%</div>
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

      <div class="panel-title" style="margin-bottom:10px">Driver breakdown / प्रभाव घटक</div>
      <div class="driver-list">${driverHTML}</div>

      <div class="why-callout" style="margin:14px 0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <strong>Plain-Language Explanation / आसान व्याख्या:</strong>
          <div style="display:inline-flex;gap:4px">
            <button class="btn btn-small ${state.lang==='en'?'btn-primary':'btn-secondary'}" style="padding:2px 8px;font-size:11px" id="detailLangEn">EN</button>
            <button class="btn btn-small ${state.lang==='hi'?'btn-primary':'btn-secondary'}" style="padding:2px 8px;font-size:11px" id="detailLangHi">HI</button>
          </div>
        </div>
        <p id="detailNarrativeText" style="margin:4px 0 0">${narrativeText}</p>
      </div>

      ${f.daily_forecast && f.daily_forecast.length ? `
      <div class="panel-title" style="margin:14px 0 6px">14-day demand forecast / अगले 14 दिन <span class="helper-text" style="font-size:10px;font-weight:400">⚡ = festival day</span></div>
      <div class="chart-wrap" style="overflow:hidden;border-radius:8px">${drawForecastSparkline(f.daily_forecast)}</div>` : ''}

      <div class="form-actions" style="margin-top:16px">
        <button class="btn btn-secondary" id="openDrawerBtn">Open Order Drawer / ऑर्डर विवरण →</button>
      </div>
    </div>
  </section>`;
}


async function runMlTraining() {
  toast('Training per-SKU Random Forest models…');
  const btn = $('#trainMl') || $('#triggerMlTrain');
  if (btn) { btn.disabled = true; btn.textContent = 'Training…'; }
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
    if (b2) { b2.disabled = false; b2.textContent = '❖ Train ML models'; }
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
      <p class="helper-text" style="margin:4px 0 10px">Which signals drive this SKU’s demand prediction.</p>
      ${bars}
      <p class="helper-text" style="margin-top:8px;font-size:10px">MAE: ${r.mae !== undefined ? num(r.mae) + ' units/day' : '—'} · Model trained locally</p>
      <button class="btn btn-secondary btn-small" id="triggerMlTrain" style="margin-top:8px">Re-train models →</button>`;
    $('#triggerMlTrain')?.addEventListener('click', runMlTraining);
  } catch(e) {
    // Model not yet trained — keep the original button
  }
}

async function loadValidation() {
  const box = $('#validationPanel .panel-body');
  if (!box) return;
  try {
    const v = await api('/validation');
    const val = x => x === null || x === undefined ? '—' : `${num(x)}%`;
    box.innerHTML = `
      <div class="notice ${v.is_demo_data?'warn':'info'}">
        <b>${v.is_demo_data ? 'Synthetic Demo Data' : 'Seller Records'}:</b> Retrospective 56-day training / 14-day holdout validation.
      </div>
      <div class="metric-grid" style="grid-template-columns:repeat(4,minmax(0,1fr));margin:14px 0 10px">
        <div class="metric-card" style="box-shadow:none;padding:12px"><div class="metric-top">WAPE</div><div class="metric-value" style="font-size:20px">${val(v.wape_pct)}</div><div class="metric-foot">Weighted error</div></div>
        <div class="metric-card" style="box-shadow:none;padding:12px"><div class="metric-top">MAPE*</div><div class="metric-value" style="font-size:20px">${val(v.mape_nonzero_days_pct)}</div><div class="metric-foot">Non-zero days</div></div>
        <div class="metric-card" style="box-shadow:none;padding:12px"><div class="metric-top">MAE</div><div class="metric-value" style="font-size:20px">${v.mae_units_per_day===null?'—':num(v.mae_units_per_day)}</div><div class="metric-foot">Units / day</div></div>
        <div class="metric-card" style="box-shadow:none;padding:12px"><div class="metric-top">SKUs</div><div class="metric-value" style="font-size:20px">${v.products_evaluated}</div><div class="metric-foot">Evaluated</div></div>
      </div>
      ${v.products.length ? `<div class="table-wrap"><table><thead><tr><th>PRODUCT</th><th>ACTUAL UNITS</th><th>ABS. ERROR</th><th>WAPE</th><th>MAE/DAY</th></tr></thead><tbody>${v.products.map(p => `<tr><td><strong>${esc(p.name)}</strong></td><td>${num(p.actual_units)}</td><td>${num(p.absolute_error_units)}</td><td>${num(p.wape_pct)}%</td><td>${num(p.mae_units_per_day)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
  } catch(e) {}
}

// -------------------------------------------------------------
// 6. WHAT-IF SIMULATOR
// -------------------------------------------------------------
async function renderSimulator() {
  if (!state.products.length) {
    $('#pageContent').innerHTML = heading('What-if simulator / क्या-अगर सिम्युलेटर', 'Test order overrides.', '') + empty('No products available', 'Add products first.');
    return;
  }
  if (!state.simulationProductId) state.simulationProductId = state.products[0].id;
  const selected = state.forecasts.find(x => x.product_id === state.simulationProductId) || state.forecasts[0];
  state.simulationProductId = selected.product_id;

  $('#pageContent').innerHTML = heading('What-if simulator / क्या-अगर सिम्युलेटर', 'The algorithm suggests; the merchant decides.', `<select class="input" id="simProduct" style="width:auto;min-width:190px">${productOptions(selected.product_id)}</select>`) + `
    <div class="simulation-layout">
      <div class="section-stack">
        <section class="panel form-panel">
          <div class="eyebrow">ORDER OVERRIDE WORKSPACE</div>
          <div class="panel-title" style="font-size:20px">${esc(selected.name)}</div>
          <p class="panel-subtitle">Adjust quantity to see instant cash freed, shortfall risk and budget impact.</p>
          <div class="form-separator"></div>

          <div style="display:flex;align-items:baseline;justify-content:space-between">
            <div class="quantity-display" id="simQtyDisplay">${selected.recommended_qty}</div>
            <span class="helper-text">${esc(selected.unit)} override</span>
          </div>

          <input id="simRange" class="range-control" type="range" min="0" max="${Math.max(25, selected.recommended_qty * 2 + 10)}" step="1" value="${selected.recommended_qty}"/>
          <div class="range-values"><span>0 units</span><span>${Math.max(25, selected.recommended_qty * 2 + 10)} units</span></div>

          <div class="field" style="margin-top:14px">
            <label>EXACT OVERRIDE QUANTITY</label>
            <input type="number" id="simQtyInput" min="0" step="1" value="${selected.recommended_qty}"/>
          </div>

          <div class="form-actions" style="margin-top:20px">
            <button class="btn btn-primary" id="simPlaceOrderBtn">✓ Approve & Place Order</button>
            <button class="btn btn-secondary" id="simWhatsAppBtn">💬 Share to WhatsApp</button>
          </div>
        </section>
      </div>

      <div class="section-stack">
        <section class="panel form-panel">
          <div class="panel-title">Instant Financial & Inventory Impact</div>
          <div class="panel-subtitle">Calculated deterministically in real time.</div>
          <div class="form-separator"></div>
          <div id="simResults"><div class="empty-state">Calculating…</div></div>
        </section>
      </div>
    </div>`;

  $('#simProduct').addEventListener('change', e => {
    state.simulationProductId = Number(e.target.value);
    renderSimulator();
  });

  const range = $('#simRange'), input = $('#simQtyInput');
  const update = async value => {
    const q = Math.max(0, Number(value) || 0);
    $('#simQtyDisplay').textContent = num(q);
    if (input !== document.activeElement) input.value = q;
    if (range !== document.activeElement) range.value = Math.min(Number(range.max), q);
    await loadSimulation(selected.product_id, q);
  };
  range.addEventListener('input', () => update(range.value));
  input.addEventListener('input', () => update(input.value));

  $('#simPlaceOrderBtn').addEventListener('click', async () => {
    const q = Number(range.value);
    if (q <= 0) { toast('Please choose a quantity greater than 0.', 'error'); return; }
    try {
      const r = await api('/purchase-orders', {
        method: 'POST',
        body: {
          product_id: selected.product_id,
          quantity: q,
          unit_cost: selected.cost_price,
          notes: 'Placed from What-If Simulator'
        }
      });
      toast(r.message, 'success');
      await renderPage();
    } catch(e) { toast(e.message, 'error'); }
  });

  $('#simWhatsAppBtn').addEventListener('click', () => {
    const q = Number(range.value);
    const msg = `*VANI-LEDGER Purchase Order*\n*Product:* ${selected.name} (${selected.sku})\n*Quantity:* ${q} ${selected.unit}\n*Est. Value:* ${inr(q * selected.cost_price)}\n*Lead Time Requested:* ${selected.lead_time_days} days\n\nPlease confirm delivery. Thank you!`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  });

  await loadSimulation(selected.product_id, selected.recommended_qty);
}

async function loadSimulation(productId, quantity) {
  try {
    const r = await api('/simulate', {method: 'POST', body: {product_id: productId, quantity}});
    const box = $('#simResults');
    if (!box) return;
    const pct = Math.min(100, Math.max(0, r.planned_spend_all_products / r.budget * 100));
    box.innerHTML = `
      <div class="sim-kpis">
        <div class="sim-result">
          <small>ORDER CASH COMMITTED</small>
          <strong>${inr(r.order_cost)}</strong>
          <p>Committed purchase value.</p>
        </div>
        <div class="sim-result">
          <small>CASH FREED VS SUGGESTION</small>
          <strong style="color:${r.cash_saved_vs_recommendation?'var(--teal)':'var(--ink-heading)'}">${inr(r.cash_saved_vs_recommendation)}</strong>
          <p>${r.additional_cash_vs_recommendation ? `${inr(r.additional_cash_vs_recommendation)} above recommendation` : 'Saved in working capital.'}</p>
        </div>
        <div class="sim-result">
          <small>SHORTFALL EXPOSURE</small>
          <strong style="color:${r.stockout_exposure_index>40?'var(--red)':'var(--ink-heading)'}">${num(r.stockout_exposure_index)}%</strong>
          <p>${num(r.shortfall_units)} units below suggested buffer.</p>
        </div>
        <div class="sim-result">
          <small>ESTIMATED DAYS OF COVER</small>
          <strong>${num(r.estimated_days_of_cover)} days</strong>
          <p>Current + incoming + order.</p>
        </div>
      </div>
      <div style="margin-top:14px">
        <div class="metric-top"><span>PLANNED SPEND VS WEEKLY BUDGET</span><strong style="color:var(--ink-heading)">${inr(r.planned_spend_all_products)} / ${inr(r.budget)}</strong></div>
        <div class="budget-bar"><span style="width:${pct}%;background:${r.budget_exceeded?'var(--red)':'var(--teal)'}"></span></div>
      </div>
      ${r.shelf_life_warning ? `<div class="notice warn" style="margin-top:10px">Shelf-life alert: Cover (${num(r.estimated_days_of_cover)} days) exceeds ${r.shelf_life_days} day shelf life!</div>` : ''}
      ${r.budget_exceeded ? `<div class="notice danger" style="margin-top:10px">Total planned spend exceeds your ₹${num(r.budget)} weekly budget.</div>` : ''}`;
  } catch(e) { $('#simResults').innerHTML = `<div class="notice danger">${esc(e.message)}</div>`; }
}

// -------------------------------------------------------------
// 7. SETTINGS & DEMO CONTROLS
// -------------------------------------------------------------
async function renderSettings() {
  const [events, settings, pos] = await Promise.all([
    api('/events'),
    api('/settings'),
    api('/purchase-orders').catch(() => [])
  ]);

  const poRows = pos.map(po => `
    <tr>
      <td>#${po.id}</td>
      <td><strong>${esc(po.product_name)}</strong><div class="table-muted">${esc(po.sku)}</div></td>
      <td>${num(po.quantity)} ${esc(po.unit)}</td>
      <td>${inr(po.unit_cost * po.quantity)}</td>
      <td><span class="status-pill ${po.status==='received'?'pill-green':'pill-amber'}">${esc(po.status)}</span></td>
      <td>${fmtDate(po.order_date)}</td>
      <td>${po.status === 'ordered' ? `<button class="btn btn-secondary btn-small" data-receive-po="${po.id}">Mark Received</button>` : '✓ Received'}</td>
    </tr>`).join('');

  $('#pageContent').innerHTML = heading('Events & settings / सेटिंग्स और इवेंट्स', 'Configure festival surges, weekly budget and data backups.', `<button class="btn btn-secondary" id="exportSales">↓ Export sales CSV</button>`) + `
    <div class="section-grid">
      <div class="section-stack">
        <section class="panel form-panel">
          <div class="panel-title">Weekly purchasing budget / साप्ताहिक बजट</div>
          <div class="panel-subtitle">Used by the simulator to flag over-budget order plans.</div>
          <div class="form-separator"></div>
          <form id="budgetForm">
            <div class="field"><label>WEEKLY BUDGET (₹)</label><input name="weekly_budget" type="number" min="1" step="100" value="${settings.weekly_budget}" required/></div>
            <div class="form-actions"><button class="btn btn-primary">Save budget</button></div>
          </form>
        </section>

        <section class="panel form-panel">
          <div class="panel-title">Add a festival or local demand surge / त्योहार या मेला जोड़ें</div>
          <div class="panel-subtitle">Applies an uplift factor to products during festival dates.</div>
          <div class="form-separator"></div>
          <form id="eventForm">
            <div class="form-grid">
              <div class="field"><label>EVENT NAME / नाम</label><input name="name" required placeholder="e.g. Diwali Rush / Local Fair"/></div>
              <div class="field"><label>CATEGORY / श्रेणी</label><select name="category"><option value="">All categories</option><option>Staples</option><option>Dairy</option><option>Snacks</option><option>Beverages</option><option>General</option></select></div>
              <div class="field"><label>START DATE</label><input name="start_date" type="date" value="${today()}" required/></div>
              <div class="field"><label>END DATE</label><input name="end_date" type="date" value="${today()}" required/></div>
              <div class="field"><label>UPLIFT (%)</label><input name="uplift_pct" type="number" min="0" max="300" step="1" value="25" required/></div>
            </div>
            <div class="form-actions"><button class="btn btn-primary">＋ Add event</button></div>
          </form>
        </section>
      </div>

      <div class="section-stack">
        ${panel('Configured festival events', 'Events affecting upcoming forecast windows', events.length ? `<div class="event-list">${events.map(ev => `<div class="event-row"><div><strong>${esc(ev.name)}</strong><small>${fmtDate(ev.start_date)} – ${fmtDate(ev.end_date)} · ${esc(ev.category||'All categories')}</small></div><div style="display:flex;align-items:center;gap:10px"><span class="status-pill pill-green">+${num(ev.uplift_pct)}%</span><button class="text-link" data-delete-event="${ev.id}" style="color:var(--red)">Remove</button></div></div>`).join('')}</div>` : empty('No events configured', 'Add upcoming festivals or market days.'))}
        ${panel('Demo & database controls', 'Backup or reset store workspace', `
          <div style="display:grid;gap:9px">
            <button class="btn btn-secondary" id="seedDemo">Load demo workspace (if empty)</button>
            <button class="btn btn-danger" id="resetDemo">Reset workspace to fresh demo data</button>
            <button class="btn btn-secondary" id="downloadBackup">Download complete JSON backup</button>
          </div>`)}
      </div>
    </div>
    <div style="height:16px"></div>
    ${panel('Recent purchase orders / हाल के सप्लायर ऑर्डर', `${pos.length} recorded orders`, pos.length ? `<div class="table-wrap"><table><thead><tr><th>PO#</th><th>PRODUCT</th><th>QUANTITY</th><th>VALUE</th><th>STATUS</th><th>ORDER DATE</th><th>ACTION</th></tr></thead><tbody>${poRows}</tbody></table></div>` : empty('No purchase orders placed yet', 'Use the What-If Simulator or Recommendation Drawer to place orders.'))}`;

  $('#budgetForm').addEventListener('submit', saveBudget);
  $('#eventForm').addEventListener('submit', saveEvent);
  $('#exportSales').addEventListener('click', () => window.location.href = '/api/export/sales.csv');
  $('#downloadBackup').addEventListener('click', () => window.location.href = '/api/export/backup.json');
  $('#seedDemo').addEventListener('click', async () => {
    try { const r = await api('/demo/seed', {method:'POST'}); toast(r.message); await renderPage(); } catch(e) { toast(e.message, 'error'); }
  });
  $('#resetDemo').addEventListener('click', async () => {
    if (!confirm('This deletes current records and reseeds fresh demo data. Continue?')) return;
    try { const r = await api('/demo/reset', {method:'POST'}); toast(r.message); await renderPage(); } catch(e) { toast(e.message, 'error'); }
  });
  $$('[data-delete-event]').forEach(b => b.addEventListener('click', async () => {
    try { await api(`/events/${b.dataset.deleteEvent}`, {method:'DELETE'}); toast('Event removed.'); renderSettings(); } catch(e) { toast(e.message, 'error'); }
  }));
  $$('[data-receive-po]').forEach(b => b.addEventListener('click', async () => {
    try {
      const r = await api(`/purchase-orders/${b.dataset.receivePo}/receive`, {method:'POST'});
      toast(r.message, 'success');
      await renderPage();
    } catch(e) { toast(e.message, 'error'); }
  }));
}

async function saveBudget(e) {
  e.preventDefault();
  const weekly_budget = Number(new FormData(e.currentTarget).get('weekly_budget'));
  try {
    await api('/settings', {method:'PUT', body:{weekly_budget}});
    toast('Weekly budget updated.');
    await renderPage();
  } catch(e) { toast(e.message, 'error'); }
}

async function saveEvent(e) {
  e.preventDefault();
  const x = Object.fromEntries(new FormData(e.currentTarget).entries());
  x.uplift_pct = Number(x.uplift_pct);
  try {
    await api('/events', {method:'POST', body:x});
    toast('Demand event added.');
    await renderPage();
  } catch(e) { toast(e.message, 'error'); }
}

// Global Listeners & Initialization
$$('.nav-item').forEach(b => b.addEventListener('click', () => setPage(b.dataset.page)));
$('#mobileMenu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#exportBackup').addEventListener('click', () => window.location.href = '/api/export/backup.json');
$('#drawerClose')?.addEventListener('click', closeRecommendationDrawer);
$('#drawerBackdrop')?.addEventListener('click', closeRecommendationDrawer);

initTheme();
renderPage();

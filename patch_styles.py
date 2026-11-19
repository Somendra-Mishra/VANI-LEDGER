"""
Patch styles.css:
1. Add .tag and .inline-input styles
2. Add .two-panel-grid style (already has two-panel items)
3. Improve .notice color contrast in dark mode
4. Add .result-row helper
5. Add .helper-text
6. Improve .btn-small
"""

with open('static/styles.css', 'r', encoding='utf-8') as f:
    content = f.read()

EXTRAS = """
/* ===================== Utility Classes ===================== */

/* Category/SKU tag chip */
.tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 20px;
  background: var(--accent2);
  color: var(--accent);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

/* Inline number input (OCR review etc.) */
.inline-input {
  border: 1px solid var(--line);
  background: var(--surface);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--ink);
  width: 90px;
  text-align: center;
  outline: none;
}
.inline-input:focus { border-color: var(--line-focus); box-shadow: 0 0 0 3px var(--accent2); }

/* Two panel insight grid on dashboard */
.two-panel-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 14px;
}
@media (max-width: 768px) { .two-panel-grid { grid-template-columns: 1fr; } }

.insight-card {
  background: var(--surface-subtle);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 16px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.insight-symbol {
  font-size: 22px;
  line-height: 1;
  opacity: 0.6;
  flex: none;
  margin-top: 2px;
}
.insight-card strong { display: block; color: var(--ink-heading); font-size: 12px; font-weight: 700; margin-bottom: 4px; }
.insight-card p { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.6; }

/* Result row (voice / OCR confirm) */
.result-box { margin-top: 12px; }
.result-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
}
.result-row:last-child { border-bottom: 0; }

/* Helper text */
.helper-text { font-size: 10px; color: var(--muted); line-height: 1.4; margin-top: 2px; }
.legend-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); margin-right: 4px; }

/* Event list */
.event-list { display: grid; gap: 0; }
.event-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 11px 0;
  border-bottom: 1px solid var(--line);
  gap: 10px;
}
.event-row:last-child { border-bottom: 0; }
.event-row strong { display: block; font-size: 12px; color: var(--ink-heading); }
.event-row small { display: block; font-size: 10px; color: var(--muted); margin-top: 2px; }

/* Table action buttons */
.table-actions { display: flex; gap: 6px; align-items: center; }

/* Simulation layout */
.simulation-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 1024px) { .simulation-layout { grid-template-columns: 1fr; } }

/* Chart axes */
.axis-label { font-size: 9px; fill: var(--muted); }
.chart-grid { stroke: var(--line); stroke-width: 1; }
.chart-fill { fill: url(#chartFill); }
.chart-line { fill: none; stroke: var(--accent); stroke-width: 2; }
.chart-dot { fill: var(--accent); }
.chart-wrap { overflow: hidden; border-radius: 8px; background: var(--surface-subtle); border: 1px solid var(--line); }

/* Local card in sidebar */
.local-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 10px;
}
.local-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--teal);
  flex: none;
  box-shadow: 0 0 0 3px rgba(16,185,129,0.25);
}
.local-card strong { display: block; color: rgba(255,255,255,0.85); font-size: 11px; }
.local-card small { display: block; color: rgba(255,255,255,0.4); font-size: 10px; }
.sidebar-foot { font-size: 10px; color: rgba(255,255,255,0.3); line-height: 1.6; padding: 0 4px; }
.sidebar-foot span { color: rgba(255,255,255,0.2); }

/* Loading state */
.loading-state {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 60px 20px;
  color: var(--muted);
  font-size: 13px;
}
.spinner {
  width: 22px;
  height: 22px;
  border: 3px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Forecast layout (product list + detail pane) */
.forecast-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 14px;
  align-items: flex-start;
}
@media (max-width: 1024px) { .forecast-layout { grid-template-columns: 1fr; } }

.forecast-card {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px 14px;
  cursor: pointer;
  transition: all 0.16s ease;
  background: var(--surface-subtle);
  margin-bottom: 6px;
}
.forecast-card:hover { border-color: var(--accent); background: var(--surface); }
.forecast-card.selected { border-color: var(--accent); background: var(--surface); box-shadow: 0 0 0 2px var(--accent2); }
.forecast-card-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.forecast-product { display: flex; align-items: center; gap: 8px; min-width: 0; }
.forecast-product strong { font-size: 11px; color: var(--ink-heading); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px; }
.forecast-product small { font-size: 10px; color: var(--muted); }
.forecast-number { text-align: right; flex: none; }
.forecast-number strong { font-size: 15px; color: var(--ink-heading); display: block; }
.forecast-number small { font-size: 9px; color: var(--muted); }
.forecast-meta { margin-top: 6px; display: flex; gap: 8px; flex-wrap: wrap; }
.forecast-meta span { font-size: 9px; color: var(--muted); background: var(--surface); border: 1px solid var(--line); border-radius: 4px; padding: 1px 6px; }

/* Metric grid */
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
.metric-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 18px 16px;
  box-shadow: var(--shadow);
}
.metric-top { font-size: 10px; font-weight: 700; color: var(--muted); display: flex; justify-content: space-between; align-items: center; letter-spacing: 0.3px; margin-bottom: 6px; }
.metric-value { font-size: 28px; font-weight: 800; color: var(--ink-heading); line-height: 1.1; }
.metric-foot { font-size: 10px; color: var(--muted); margin-top: 4px; }
.metric-foot.warn { color: var(--amber); }
.metric-foot.good { color: var(--teal); }
.metric-icon { font-size: 14px; color: var(--accent); }
"""

# Only add if not already present
if '.two-panel-grid' not in content:
    content = content.rstrip() + '\n' + EXTRAS + '\n'
    print("Added utility classes block")
else:
    print("Utility classes already present, skipping")

with open('static/styles.css', 'w', encoding='utf-8') as f:
    f.write(content)
print(f"styles.css updated ({len(content)} chars)")

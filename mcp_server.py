"""Optional FastMCP tool server. Install the 'mcp' package to run it."""
from datetime import date, timedelta
import sqlite3, os
from pathlib import Path
from mcp.server.fastmcp import FastMCP
from ml_forecasting import train_product, predict_product

BASE=Path(__file__).resolve().parent
DB=Path(os.getenv('VANI_DB_PATH', BASE/'data'/'vani_ledger.db'))
mcp=FastMCP('vani-ledger-tools')

def daily_history(product_id: int):
    with sqlite3.connect(DB) as c:
        rows=c.execute('SELECT sale_date, SUM(quantity) FROM sales WHERE product_id=? GROUP BY sale_date ORDER BY sale_date',(product_id,)).fetchall()
    lookup={date.fromisoformat(d):float(q) for d,q in rows}
    if not lookup: return [],[]
    start,end=min(lookup),max(lookup); ds=[]; qs=[]; d=start
    while d<=end: ds.append(d); qs.append(lookup.get(d,0.0)); d+=timedelta(days=1)
    return ds,qs

@mcp.tool()
def ingest_bill_ledger(product_id: int, quantity: float, unit_cost: float=0.0) -> dict:
    """Record a reviewed purchase quantity and update current stock."""
    if quantity<=0: return {'ok':False,'error':'quantity must be positive'}
    with sqlite3.connect(DB) as c:
        exists=c.execute('SELECT id FROM products WHERE id=?',(product_id,)).fetchone()
        if not exists: return {'ok':False,'error':'unknown product'}
        c.execute('INSERT INTO purchases(product_id,purchase_date,quantity,unit_cost,source,notes) VALUES(?,?,?,?,?,?)',
                  (product_id,date.today().isoformat(),quantity,unit_cost,'mcp','Reviewed MCP tool purchase'))
        c.execute('UPDATE products SET current_stock=current_stock+? WHERE id=?',(quantity,product_id))
    return {'ok':True,'product_id':product_id,'stock_added':quantity}

@mcp.tool()
def train_sku_forecast(product_id: int) -> dict:
    """Train a per-SKU machine-learning model using chronological sales history."""
    ds,qs=daily_history(product_id)
    if not ds: return {'trained':False,'reason':'No sales history'}
    return train_product(product_id,ds,qs)

@mcp.tool()
def forecast_sku_demand(product_id: int, horizon_days: int=14) -> dict:
    """Forecast daily SKU demand using the trained model."""
    ds,qs=daily_history(product_id)
    if not ds: return {'available':False,'reason':'No sales history'}
    return predict_product(product_id,ds,qs,horizon_days)

@mcp.tool()
def explain_forecast_drivers(product_id: int) -> dict:
    """Return transparent lag, trend and weekday evidence for a SKU."""
    ds,qs=daily_history(product_id)
    if len(qs)<14: return {'available':False,'reason':'Need at least 14 days'}
    a=sum(qs[-7:])/7; b=sum(qs[-14:-7])/7
    return {'recent_7d_daily_average':round(a,2),'previous_7d_daily_average':round(b,2),
            'trend_pct':round((a-b)/b*100,1) if b else None,
            'last_28d_units':round(sum(qs[-28:]),1),
            'note':'These are descriptive drivers, not causal attributions.'}

if __name__=='__main__': mcp.run(transport='stdio')

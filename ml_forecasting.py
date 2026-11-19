"""Trainable SKU-level demand forecasting with chronological validation.

Uses lag/rolling/calendar features and a RandomForestRegressor. This is a
practical hackathon baseline, not a claim of guaranteed forecast accuracy.
"""
from __future__ import annotations
import json, math
from datetime import date, timedelta
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.multioutput import MultiOutputRegressor
import joblib

BASE = Path(__file__).resolve().parent
MODEL_DIR = BASE / "data" / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)
FEATURES = ["lag1", "lag7", "lag14", "lag28", "mean7", "mean14", "mean28", "std14", "weekday", "month", "dayofyear"]


def make_frame(dates, quantities):
    s = pd.Series(np.asarray(quantities, dtype=float), index=pd.to_datetime(dates)).sort_index()
    frame = pd.DataFrame(index=s.index)
    frame["y"] = s
    for lag in (1, 7, 14, 28): frame[f"lag{lag}"] = s.shift(lag)
    for window in (7, 14, 28):
        frame[f"mean{window}"] = s.shift(1).rolling(window, min_periods=window).mean()
    frame["std14"] = s.shift(1).rolling(14, min_periods=14).std().fillna(0)
    frame["weekday"] = frame.index.day_of_week if hasattr(frame.index, "day_of_week") else frame.index.dayofweek
    frame["month"] = frame.index.month
    frame["dayofyear"] = frame.index.day_of_year if hasattr(frame.index, "day_of_year") else frame.index.dayofyear
    return frame.dropna()


def train_product(product_id: int, dates, quantities):
    frame = make_frame(dates, quantities)
    if len(frame) < 25:
        return {"trained": False, "reason": f"Need at least 53 consecutive daily observations; usable rows={len(frame)}."}
    # Chronological holdout: never shuffle time-series observations.
    split = max(15, int(len(frame) * .80))
    if len(frame) - split < 5: split = len(frame) - 5
    train, test = frame.iloc[:split], frame.iloc[split:]
    model = RandomForestRegressor(n_estimators=240, max_depth=8, min_samples_leaf=2,
                                  random_state=42, n_jobs=-1)
    model.fit(train[FEATURES], train["y"])
    pred = np.maximum(0, model.predict(test[FEATURES]))
    actual = test["y"].to_numpy()
    mae = float(mean_absolute_error(actual, pred))
    denom = float(np.sum(actual))
    wape = float(np.sum(np.abs(actual-pred))/denom*100) if denom > 0 else None
    feature_importances = {f: round(float(imp), 4) for f, imp in zip(FEATURES, model.feature_importances_)}
    path = MODEL_DIR / f"sku_{product_id}.joblib"
    joblib.dump({"model": model, "features": FEATURES, "feature_importances": feature_importances,
                 "trained_rows": len(train), "holdout_rows": len(test), "mae": mae, "wape": wape,
                 "trained_at": date.today().isoformat()}, path)
    return {"trained": True, "product_id": product_id, "train_rows": len(train),
            "holdout_rows": len(test), "mae_units_per_day": round(mae, 3),
            "wape_pct": round(wape, 2) if wape is not None else None,
            "model": "RandomForestRegressor", "feature_importances": feature_importances,
            "model_path": str(path.name)}


def predict_product(product_id: int, dates, quantities, horizon: int = 14):
    path = MODEL_DIR / f"sku_{product_id}.joblib"
    if not path.exists(): return {"available": False, "reason": "Train the SKU model first."}
    bundle = joblib.load(path); model = bundle["model"]
    feature_importances = bundle.get("feature_importances", {})
    history = pd.Series(np.asarray(quantities, dtype=float), index=pd.to_datetime(dates)).sort_index()
    if len(history) < 28: return {"available": False, "reason": "At least 28 days of history are needed."}
    preds=[]; future_dates=[]
    for _ in range(max(1, min(horizon, 30))):
        day = history.index[-1] + pd.Timedelta(days=1)
        vals = history.to_numpy()
        row = {
            "lag1": vals[-1], "lag7": vals[-7], "lag14": vals[-14], "lag28": vals[-28],
            "mean7": float(np.mean(vals[-7:])), "mean14": float(np.mean(vals[-14:])),
            "mean28": float(np.mean(vals[-28:])), "std14": float(np.std(vals[-14:])),
            "weekday": day.day_of_week if hasattr(day, "day_of_week") else day.dayofweek,
            "month": day.month,
            "dayofyear": day.day_of_year if hasattr(day, "day_of_year") else day.dayofyear,
        }
        y = max(0.0, float(model.predict(pd.DataFrame([row], columns=FEATURES))[0]))
        history.loc[day] = y; preds.append(y); future_dates.append(day.date().isoformat())
    return {"available": True, "model": "RandomForestRegressor", "forecast": [
        {"date": d, "demand": round(float(v), 2)} for d,v in zip(future_dates,preds)],
        "daily_average": round(float(np.mean(preds)),2),
        "feature_importances": feature_importances,
        "validation": {"mae_units_per_day": round(bundle["mae"],3),
                       "wape_pct": round(bundle["wape"],2) if bundle["wape"] is not None else None,
                       "holdout_rows": bundle["holdout_rows"]}}

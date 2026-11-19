# VANI-LEDGER Advanced Hackathon Build

This build extends the local-first MVP with a trainable SKU-level ML forecast, chronological holdout metrics, optional FastMCP tools, and an optional LangGraph validation workflow. The deterministic reorder and cash-flow calculations remain Python code; no LLM is used for arithmetic.

## Run on Windows
1. Install Python 3.10+.
2. Extract the ZIP.
3. Double-click `start_windows.bat` (or open a terminal in this folder and run `python -m venv .venv`, `.venv\\Scripts\\activate`, `pip install -r requirements.txt`, `uvicorn app:app --reload`).
4. Open http://127.0.0.1:8000 and load the demo workspace.
5. Open http://127.0.0.1:8000/docs for the interactive API.

## Hackathon demo sequence
1. Load demo workspace: `POST /api/demo/seed`.
2. Check data: `GET /api/products`, `GET /api/summary`.
3. Train SKU models: `POST /api/ml/train-all`.
4. Check model status: `GET /api/ml/status`.
5. Forecast a SKU: `GET /api/ml/forecast/1?horizon_days=14` (replace 1 with a product ID).
6. Compare rule-based recommendation: `GET /api/forecasts`.
7. Simulate seller override: `POST /api/simulate` with `{"product_id":1,"quantity":12}`.
8. Add a festival scenario: `POST /api/events` with a future date range and a category uplift, then refresh `/api/forecasts`.

## ML design
- Daily SKU sales series, including zero-sale dates between first and last observation.
- Features: lags 1/7/14/28, rolling means 7/14/28, 14-day volatility, weekday, month, day-of-year.
- Model: RandomForestRegressor per SKU.
- Validation: chronological 80/20 holdout; reports MAE and WAPE. No random shuffle.
- Recursive 1–30 day prediction. Model artifacts saved under `data/models/`.
- A trained ML forecast is a demand signal; the existing reorder engine applies stock, incoming stock, lead time, safety buffer and budget rules separately.

Important: demo data is synthetic. Holdout scores are not evidence of real-world performance. Replace it with actual daily sales and compare against a naive baseline before claiming accuracy.

## Architecture mapping from the presentation
- Next.js/PWA: the included lightweight web UI remains the current working front end; a Next.js migration is a separate front-end task.
- FastAPI: working application API.
- Pydantic: request validation.
- FastMCP: optional `mcp_server.py`, exposing reviewed ingestion, SKU training, forecast and driver tools. Install `mcp` (included in requirements) and run `python mcp_server.py` in a separate terminal.
- LangGraph: optional `agent_flow.py` validation/orchestration skeleton. Install `langgraph`; run from Python with `build_graph()`.
- Forecast model: scikit-learn Random Forest, with local joblib artifacts and measured holdout metrics.
- Explainability: descriptive drivers in `/api/forecasts`; optional SHAP can be added after model validation. Do not call descriptive drivers SHAP values.
- Storage: SQLite local-first. PostgreSQL/cloud sync is intentionally not claimed as implemented.
- Voice/OCR: current app supports text intent parsing and OCR when Tesseract is installed; full LiveKit/Whisper/Kokoro real-time voice is not included in this build.

## API highlights
- `POST /api/demo/seed`
- `GET /api/summary`, `GET /api/products`, `POST /api/products`
- `POST /api/sales`, `POST /api/sales/import`
- `GET /api/forecasts`, `POST /api/simulate`
- `POST /api/ml/train/{product_id}`, `POST /api/ml/train-all`
- `GET /api/ml/status`, `GET /api/ml/forecast/{product_id}`
- `POST /api/events`
- `GET /api/validation`

## Notes
- OCR requires the Tesseract executable installed separately and available on PATH.
- Browser speech recognition support varies by browser; text input remains available.
- Keep `data/` backed up. Do not upload real customer or financial data to a public demo server.

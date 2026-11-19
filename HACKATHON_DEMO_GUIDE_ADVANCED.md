# 5-minute VANI-LEDGER hackathon demo

## Before judges arrive
- Start app and load demo workspace.
- Train models once using `POST /api/ml/train-all` in `/docs`.
- Keep dashboard and `/docs` tabs open.
- Use synthetic demo data; say so explicitly.

## Live story
1. **Problem (30 sec):** Small sellers use paper/voice records and struggle with overstock and stockouts.
2. **Capture (45 sec):** Show bill OCR or voice/text parsing. Emphasize that extracted entries are drafts requiring seller confirmation.
3. **Forecast (60 sec):** Show the SKU recommendation, then open `/api/ml/status` and `/api/ml/forecast/{id}`. Explain lag and rolling features and chronological holdout MAE/WAPE.
4. **Explain (45 sec):** Show baseline, recent trend, weekly pattern, festival input, lead-time demand and safety buffer. State that the reasons are transparent business drivers, not causal proof.
5. **Human control (60 sec):** Move the reorder quantity in the simulator. Show cash saved, shortfall units, excess stock, shelf-life warning and remaining budget.
6. **Offline-first (30 sec):** Explain SQLite local persistence. Do not claim cloud synchronization is implemented unless you build and test it.
7. **Close (30 sec):** “AI understands the seller's records; deterministic Python and a trained model support the forecast; the seller makes the final decision.”

## Judge-safe claims
- Say “trained on the demo sales history” only after running training.
- Quote the actual returned holdout metrics, not the PPT's projected benchmark as measured performance.
- WAPE is used alongside MAE; MAPE can be unstable on zero-sales days.
- The stockout exposure index is a relative planning indicator, not a calibrated probability.
- Synthetic sample data is for demonstration, not a production recommendation.

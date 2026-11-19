# VANI-LEDGER — Hackathon Demo & Judge Notes

## Recommended 3–4 minute live demo

### Before the judges arrive

1. Start VANI-LEDGER and open `http://127.0.0.1:8000` in Chrome or Edge.
2. Click **Load demo workspace** on Overview.
3. Confirm the page shows six products and synthetic sales history.
4. Keep `static/sample_bill.png` ready for the bill-scanning demonstration.

### Demo flow

**1. Problem and dashboard (20–30 seconds)**

Explain that small sellers often work from notebooks, paper bills and memory. Show the inventory value and reorder alerts. State that the seeded numbers are sample data, not real merchant results.

**2. Explainable forecast (45–60 seconds)**

Open **Forecast & why**, select Mustard Oil and point to:

- recent daily baseline;
- recent trend adjustment;
- weekday and configured-event effect;
- safety buffer;
- reorder point and recommended quantity.

Explain: “The system does not ask a chatbot to invent a purchase number. The Python engine calculates it, and the screen shows the drivers.”

**3. Manual override (45–60 seconds)**

Open **What-if simulator**. Reduce the suggested quantity. Show:

- cash freed versus recommendation;
- relative shortfall exposure index;
- excess units versus target;
- days of cover;
- remaining weekly budget.

Say clearly that the shortfall exposure index is a relative gap to the recommendation, not a calibrated probability of stockout.

**4. Voice capture (30–45 seconds)**

Open **Sales & inputs**. Enter or speak: `Aaj 12 crate doodh bika`. The app identifies Milk and a sale transaction. Review the product, quantity and transaction type, then confirm. If the browser speech service is unavailable, type the sentence; the text workflow uses the same parser.

**5. Bill-photo OCR (30–45 seconds)**

Upload `static/sample_bill.png`. The OCR draft should identify four sample lines. Correct the quantities if needed, then select **Confirm lines & add stock**. Point out that the application requires seller confirmation before updating inventory.

**6. Evidence and close (20–30 seconds)**

Return to **Forecast & why** and show the rolling holdout check. Explain that the screen uses 56 days of training history and a 14-day holdout. If the demo flag says “Synthetic demo history”, do not present its WAPE/MAPE as real-world accuracy or as proof of the deck's projected target.

## Suggested project explanation

“VANI-LEDGER is a local-first inventory decision-support system for small sellers. It turns sales, bill and voice inputs into structured records, estimates demand using a transparent seasonal baseline, explains each reorder suggestion, and lets the seller test a different quantity before committing cash. The seller always makes the final decision.”

## Likely judge questions

**What is technically intelligent about it?**

It combines input understanding, SKU-level time-series aggregation, trend and weekday factors, configured event signals, safety stock and a budget-aware what-if workflow. It also provides a historical holdout check rather than showing only a decorative forecast chart.

**Why is the calculation deterministic?**

A reorder number is a business calculation. It should be repeatable and testable. The MVP uses Python/NumPy for the arithmetic. AI-like language tools are not used to calculate cash or quantities.

**How does the app work offline?**

The web server and SQLite database run locally on the seller's computer, so the core records and calculations do not need a cloud service. The cached PWA shell can reopen the interface, but API actions still require the local server to be running. Browser speech recognition may require browser/network support.

**Can OCR be wrong?**

Yes. Bill OCR is a draft. The user sees extracted text and candidate product lines and must review them before the app records a stock receipt.

**Does it provide formal credit or loans?**

No. It organizes transaction and stock history. That record may help a seller prepare for formal credit conversations, but the app does not issue or approve credit.

## Implementation honesty: this build vs. the presentation roadmap

This deliverable is a working, local-first MVP. It includes a FastAPI REST backend, SQLite, Python/NumPy forecasting, bill-photo OCR with Tesseract, browser speech/text parsing, explainable rule-based drivers, a what-if simulator, CSV import/export, backups and historical holdout validation.

The presentation's larger production stack is **not all integrated in this MVP**: FastMCP v4, PydanticAI, LangGraph, LightGBM model training, SHAP attribution, PostgreSQL/pgvector/BM25, LiveKit, Whisper-turbo, Kokoro TTS, Ollama and cloud/local model gateway. Do not say those components are already running. They are sensible next integrations once the end-to-end merchant workflow and data contracts are validated.

## What to improve before a production deployment

- Collect consented, real merchant data and document data provenance.
- Backtest by SKU and season; compare against simple baselines; report WAPE/MAE by product and category.
- Calibrate reorder service levels and stockout probability with actual lead-time and lost-sales observations.
- Add a review/approval trail for OCR corrections and edits.
- Add authentication, role-based access, encrypted backups and multi-device synchronization before hosting real business records online.
- Add a proper festival/holiday data source and seller-configurable event validation.

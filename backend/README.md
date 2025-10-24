# Backend (FastAPI) — Email Classification API

## Overview
This FastAPI service exposes a minimal `/predict` endpoint that returns top-2 categories for an email given its subject and body. The model is loaded once on startup (joblib-based fallback) to keep inference fast. A `/health` endpoint is available for readiness checks.

## Endpoints
- GET `/health` → `{ "status": "ok" }`
- GET `/` → Basic status and links
- GET `/predict` → Guidance on using POST
- POST `/predict` → Request: `{ subject: string, body: string }` | Response: `string[]` of two labels

## Project layout
```
backend/
├── main.py            # Thin entrypoint so `uvicorn main:app` works
├── simple_main.py     # Minimal FastAPI app (CORS + /predict + /health)
├── joblib_model.py    # Model loader and top-2 predictor
├── requirements.txt   # Dependencies
└── ai_model/
    └── model.pkl      # Optional joblib model file (user-provided)
```

## Quickstart
1) Create a venv and activate it (Windows PowerShell):
```powershell
cd "D:\Mark 2\backend"
python -m venv venv
.\venv\Scripts\Activate.ps1
```

2) Install dependencies:
```powershell
pip install -r requirements.txt
```

3) (Optional) Place your trained model at `backend\ai_model\model.pkl`.

4) Run the server:
```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

5) Explore the API docs:
- http://127.0.0.1:8000/docs
- http://127.0.0.1:8000/openapi.json

## Example requests
PowerShell using curl.exe:
```powershell
# Health
curl.exe http://127.0.0.1:8000/health

# Predict
$body = '{"subject":"Meeting update","body":"Project deadline moved to Friday"}'
curl.exe -X POST http://127.0.0.1:8000/predict -H "Content-Type: application/json" -d $body
```

## Configuration
- MODEL_PATH (optional): Override location of model.pkl. Example run:
```powershell
$env:MODEL_PATH = "D:\\Mark 2\\ai_model\\model.pkl"; uvicorn main:app --reload
```
- CORS: Currently allows all origins for local development.

## Tests
If you add tests under `backend/tests`, run them with:
```powershell
pytest -q
```

## Notes
- If no model is found or loading fails, the API returns a safe fallback of two generic labels.
- You can evolve `simple_main.py` into a router-based structure, add Pydantic schemas, and integrate a transformer-based inference pipeline when ready.

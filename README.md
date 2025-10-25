# MailXpert — Smart Email Classifier (React + FastAPI + Transformers)

MailXpert is a full‑stack app that connects to Gmail, fetches recent emails, and classifies them with a fine‑tuned Transformers model. The React frontend provides a clean UX for login, filtering, and viewing results; the FastAPI backend handles OAuth, Gmail fetch, and batched model inference optimized for free‑tier hosting.

- Frontend: React (CRA), React Router, Tailwind, Framer Motion, Axios
- Backend: FastAPI + Uvicorn, Google OAuth, Gmail API, Transformers + PyTorch (CPU)
- Model: Hugging Face Transformers classifier stored under `ai_model/email_classification_model/` (tracked via Git LFS)

> Note: Production deploy is in progress. You can run locally or follow the deploy section below. A short announcement message is provided at the end if you want to post an update on GitHub/LinkedIn.

## Repository structure
```
.
├── ai_model/
│   ├── email_classification_model/   # tokenizer + model.safetensors + configs
│   └── training_output/              # checkpoints (optional)
├── backend/                          # FastAPI service and Gmail integration
│   ├── main.py                       # Gmail endpoints (/emails, /fetch-and-classify, /reclassify)
│   ├── simple_main.py                # Core app: /health, OAuth, /predict, /predict-batch
│   ├── ai_model/                     # Inference code
│   │   └── inference.py              # EmailClassifier (batch + sub-batch, memory‑safe)
│   ├── requirements.txt              # CPU‑only torch; transformers; google‑auth libs
│   └── ... (gmail_client.py, helpers, stores)
├── frontend/                         # React app (CRA)
│   ├── src/pages/                    # Landing, Dashboard, Calendar, Sender, EmailDetail
│   ├── public/privacy.html           # OAuth privacy policy
│   ├── public/terms.html             # Terms page
│   ├── package.json
│   └── .env.example                  # REACT_APP_API_URL + REACT_APP_GOOGLE_CLIENT_ID
└── README.md                         # You are here
```

## Features
- Google OAuth login with explicit consent flow
- Gmail Readonly fetch and parsing to get sender, subject, date, and plaintext body
- Batched Transformers inference with sub‑batching and memory cleanup (free‑tier friendly)
- Dashboard, Calendar, and Sender views; fast search and compact email cards
- Landing banner that shows backend warm‑up/health status

## Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- A Google OAuth client (Web) with the following authorized redirect URI for local dev:
  - http://127.0.0.1:8000/auth/callback

## Backend — local setup
1) Create a virtual environment and install dependencies
```powershell
cd "D:\Mark 2\backend"
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2) Set environment variables (PowerShell)
```powershell
$env:GOOGLE_CLIENT_ID = "<your-google-client-id>"
$env:GOOGLE_CLIENT_SECRET = "<your-google-client-secret>"
$env:FRONTEND_URL = "http://localhost:3000"
$env:OAUTH_REDIRECT_URI = "http://127.0.0.1:8000/auth/callback"
$env:MODEL_PATH = "D:\\Mark 2\\ai_model\\email_classification_model"
$env:ALLOWED_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
# Memory‑safe defaults for laptops / free tiers
$env:TOKENIZERS_PARALLELISM = "false"
$env:OMP_NUM_THREADS = "1"
$env:MAX_SEQ_LEN = "256"
```

3) Run the API
```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

4) Explore
- Docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/health
- OAuth start: http://127.0.0.1:8000/auth/login

### Key backend endpoints
- GET `/health` → readiness
- GET `/auth/login` → redirect to Google
- GET `/auth/callback` → completes OAuth and sets a session cookie
- GET `/auth/status` → who’s logged in
- POST `/auth/logout`
- POST `/predict` → `{subject, body}` → top‑2 labels
- POST `/predict-batch` → `{emails: [{subject, body}, ...]}` → top‑2 for each
- POST `/fetch-emails` → for session cookie (dev only)
- GET `/emails` → Bearer token; fetch + classify new; returns all stored
- POST `/fetch-and-classify` → Bearer token; classify only new and return them
- POST `/reclassify/{message_id}` → reclassify one message
- POST `/clear-user-data` → clear processed caches/stores (dev helper)

## Frontend — local setup
1) Configure environment
```powershell
cd "D:\Mark 2\frontend"
Copy-Item .env.example .env -Force
(Get-Content .env) | ForEach-Object { $_ } | Out-Null
```
Edit `frontend/.env` and set:
```
REACT_APP_API_URL=http://127.0.0.1:8000
REACT_APP_GOOGLE_CLIENT_ID=<your-google-client-id>
```

2) Install and run
```powershell
npm install
npm start
```
App runs on http://localhost:3000 and talks to the backend at `REACT_APP_API_URL`.

## Deployment (summary)

### Frontend (Vercel)
- Root: `frontend`
- Env vars:
  - `REACT_APP_API_URL` = your backend URL
  - `REACT_APP_GOOGLE_CLIENT_ID` = your Google client id

### Backend (Render or Railway)
- Start command:
```
uvicorn main:app --host 0.0.0.0 --port $PORT
```
- Required env vars:
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - `FRONTEND_URL` = your Vercel URL
  - `OAUTH_REDIRECT_URI` = https://<backend-domain>/auth/callback
  - `MODEL_PATH` = ai_model/email_classification_model
  - `ALLOWED_ORIGINS` = https://<your-frontend>,http://localhost:3000
- Performance:
  - `TOKENIZERS_PARALLELISM=false`, `OMP_NUM_THREADS=1`, `MAX_SEQ_LEN=256`
- Model weights via Git LFS: ensure `model.safetensors` is pulled at build time. If needed, add build step:
```
git lfs install && git lfs pull
```
- Optional persistent volume: set `PROCESSED_STORE_PATH` and `PROCESSED_EMAILS_STORE_PATH` to `/data/...` and mount a volume at `/data`.

See `DEPLOY.md` for a full, click‑by‑click guide (Render and Railway).

## Troubleshooting
- 401 after login: verify `OAUTH_REDIRECT_URI` matches exactly in Google console and backend env.
- CORS errors: ensure `ALLOWED_ORIGINS` includes your frontend URL and localhost.
- Memory restarts on free tiers: keep `MAX_SEQ_LEN=256`; batch size is already 2 in `main.py`.
- Model not found: confirm `MODEL_PATH` and that Git LFS pulled `model.safetensors`.

## Credits
Branding: “MailXpert”. Includes privacy and terms pages for OAuth compliance.

## License
All rights reserved unless a license is added.

---

### Announcement (ready‑to‑post)

Title: MailXpert — Smart Gmail Email Classifier (React + FastAPI + Transformers)

I just open‑sourced MailXpert, a Gmail email classification app using a Transformers model with a React frontend and a FastAPI backend.

Repo: https://github.com/taminderjeet/Smart-Email-Classifier

Status: I’m ironing out some deployment issues (free‑tier constraints). A live demo will be up soon. In the meantime, you can run it locally and check out the code. Feedback and PRs welcome!

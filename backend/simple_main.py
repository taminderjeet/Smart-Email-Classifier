from __future__ import annotations

import os
import secrets
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Annotated

from fastapi import FastAPI, Response, Request, HTTPException, Header
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import sys
from pathlib import Path

# Ensure project root is on sys.path to import ai_model.inference
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

try:
    from ai_model.inference import EmailClassifier  # type: ignore
except Exception as e:  # pragma: no cover - import-time guard
    EmailClassifier = None  # type: ignore

# OAuth dependencies
from typing import TYPE_CHECKING, Any
try:
    from google_auth_oauthlib.flow import Flow as GoogleFlow  # type: ignore
except Exception:
    GoogleFlow = None  # type: ignore

import requests  # type: ignore
from dotenv import load_dotenv
from session_store import SessionStore

load_dotenv()

app = FastAPI(title="Email Classification API (Transformers)", version="0.2.0")
# CORS: when sending cookies (withCredentials), we must NOT use '*'.
_default_origins = [
    os.getenv("FRONTEND_URL") or "http://localhost:3000",
]
_extra = os.getenv("ALLOWED_ORIGINS")  # comma-separated
if _extra:
    _default_origins = [o.strip() for o in _extra.split(",") if o.strip()]
else:
    # Include both localhost and 127.0.0.1 by default for local dev
    base = _default_origins[0]
    candidates = {base, "http://localhost:3000", "http://127.0.0.1:3000"}
    _default_origins = sorted(candidates)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_default_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class EmailInput(BaseModel):
    subject: str = Field(..., min_length=1)
    body: str = Field(..., min_length=1)


class EmailBatchInput(BaseModel):
    emails: List[EmailInput]


# In-memory session store for demo only. Replace with DB/Redis for production.
SESSIONS: Dict[str, Dict[str, object]] = {}
SESSION_JSON_PATH = os.getenv("SESSION_STORE_PATH")
if SESSION_JSON_PATH:
    SESSION_JSON_PATH = Path(SESSION_JSON_PATH)
else:
    SESSION_JSON_PATH = Path(__file__).resolve().parent / "session_store.json"
SESSION_STORE = SessionStore(SESSION_JSON_PATH)  # type: ignore[arg-type]
OAUTH_STATES: Dict[str, str] = {}


def _get_env(name: str, required: bool = True) -> Optional[str]:
    val = os.getenv(name)
    if required and not val:
        raise RuntimeError(f"Missing required env var: {name}")
    return val


def _build_google_flow() -> Any:
    if GoogleFlow is None:
        raise RuntimeError("google-auth-oauthlib is not installed")
    client_id = _get_env("GOOGLE_CLIENT_ID")
    client_secret = _get_env("GOOGLE_CLIENT_SECRET")
    redirect_uri = _get_env("OAUTH_REDIRECT_URI")
    client_config = {
        "web": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri],
        }
    }
    # Use userinfo.* scopes to match what Google returns during token exchange
    scopes = [
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/gmail.readonly",
    ]
    flow = GoogleFlow.from_client_config(client_config, scopes=scopes, redirect_uri=redirect_uri)
    return flow



# Global classifier instance
classifier = None

def load_classifier():
    """Load the AI model classifier on startup."""
    global classifier
    # Allow override via env; default to repo's ai_model/email_classification_model
    model_dir = os.getenv("MODEL_PATH")
    if not model_dir:
        model_dir = str(ROOT_DIR / "ai_model" / "email_classification_model")
    if EmailClassifier is None:
        raise RuntimeError("Failed to import EmailClassifier from ai_model.inference")
    classifier = EmailClassifier(model_dir)

@app.on_event("startup")
async def startup() -> None:
    # Set environment variables for memory optimization on Render
    os.environ["TOKENIZERS_PARALLELISM"] = "false"
    os.environ["OMP_NUM_THREADS"] = "1"
    load_classifier()


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/")
async def root() -> dict:
    return {"status": "ok", "docs": "/docs", "openapi": "/openapi.json"}


@app.get("/favicon.ico")
async def favicon() -> Response:
    return Response(status_code=204)


@app.get("/predict")
async def predict_info() -> dict:
    return {"message": "Use POST /predict with JSON {subject, body}"}


@app.post("/predict", response_model=List[str])
async def predict(payload: EmailInput) -> List[str]:
    """Predict email categories using AI model - strict mode, no fallbacks."""
    if classifier is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    result = classifier.predict(payload.subject, payload.body, top_k=2)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=f"Model error: {result.get('error')}")
    
    top2 = result.get("top_2_categories") or result.get("top_categories", [])
    labels = [str(x) for x in (top2 or [])]
    
    if len(labels) < 2:
        raise HTTPException(status_code=500, detail="Model did not return two categories")
    
    return labels[:2]


@app.post("/predict-batch", response_model=List[List[str]])
async def predict_batch(payload: EmailBatchInput) -> List[List[str]]:
    """Batch predict email categories using AI model - strict mode, no fallbacks."""
    if classifier is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    # Convert to list of dicts expected by classifier.predict_batch
    emails_dicts = [{"subject": e.subject, "body": e.body} for e in payload.emails]
    results = classifier.predict_batch(emails_dicts, top_k=2)
    
    labels_list: List[List[str]] = []
    for i, r in enumerate(results):
        if not r.get("success"):
            raise HTTPException(
                status_code=500, 
                detail=f"Model error for email {i}: {r.get('error')}"
            )
        top2 = r.get("top_2_categories") or r.get("top_categories", [])
        labels = [str(x) for x in (top2 or [])]
        
        if len(labels) < 2:
            raise HTTPException(
                status_code=500, 
                detail=f"Model did not return two categories for email {i}"
            )
        labels_list.append(labels[:2])
    
    return labels_list


# ------------------ OAuth2: Gmail login ------------------
@app.get("/auth/login")
async def auth_login() -> Response:
    try:
        flow = _build_google_flow()
        auth_url, state = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
        )
        # Create a new session id and bind to state for CSRF protection
        session_id = secrets.token_urlsafe(32)
        OAUTH_STATES[state] = session_id
        # Redirect user to Google's consent page
        return RedirectResponse(url=auth_url, status_code=302)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/auth/callback")
async def auth_callback(request: Request) -> Response:
    try:
        code = request.query_params.get("code")
        state = request.query_params.get("state")
        if not code or not state:
            raise HTTPException(status_code=400, detail="Missing code/state")
        session_id = OAUTH_STATES.get(state)
        if not session_id:
            raise HTTPException(status_code=400, detail="Invalid state")

        flow = _build_google_flow()
        # Complete the OAuth flow: exchange code for tokens
        flow.fetch_token(code=code)
        creds = flow.credentials

        # Fetch user info
        userinfo_resp = requests.get(
            "https://openidconnect.googleapis.com/v1/userinfo",
            headers={"Authorization": f"Bearer {creds.token}"},
            timeout=10,
        )
        userinfo = userinfo_resp.json() if userinfo_resp.ok else {}

        # Save session
        expiry: Optional[str] = None
        try:
            if getattr(creds, "expiry", None):
                expiry = creds.expiry.isoformat()  # type: ignore[attr-defined]
        except Exception:
            expiry = None

        SESSIONS[session_id] = {
            "access_token": creds.token,
            "refresh_token": getattr(creds, "refresh_token", None),
            "expiry": expiry,
            "scopes": creds.scopes,
            "email": userinfo.get("email"),
            "name": userinfo.get("name"),
            "picture": userinfo.get("picture"),
        }

        # Persist session for dev (JSON) and clean the used state
        OAUTH_STATES.pop(state, None)
        SESSION_STORE.set(session_id, SESSIONS[session_id])

        # Redirect to frontend with access_token and user email in URL (dev convenience)
        # Note: For production, avoid passing tokens via URL; rely on HttpOnly cookies or server-side sessions instead.
        frontend = _get_env("FRONTEND_URL")
        access_token = creds.token
        user_email = userinfo.get("email", "")
        redirect_to = frontend.rstrip("/") + f"/dashboard?token={access_token}&email={user_email}&login=success"
        resp = RedirectResponse(url=redirect_to, status_code=302)
        # For dev, set HttpOnly=False so frontend can read the id, tighten for prod
        secure_cookie = redirect_to.startswith("https://")
        resp.set_cookie(
            key="session_id",
            value=session_id,
            httponly=False,
            samesite="lax",
            secure=secure_cookie,
            max_age=60 * 60 * 24 * 7,  # 7 days
        )
        return resp
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/auth/status")
async def auth_status(request: Request) -> dict:
    session_id = request.cookies.get("session_id")
    sess = SESSIONS.get(session_id or "") or (SESSION_STORE.get(session_id or "") if session_id else None)
    if not sess:
        return {"loggedIn": False, "logged_in": False}
    return {
        "loggedIn": True,
        "logged_in": True,  # alias for frontend compatibility
        "email": sess.get("email"),
        "name": sess.get("name"),
        "picture": sess.get("picture"),
        "expiry": sess.get("expiry"),
        "scopes": sess.get("scopes"),
    }


@app.post("/auth/logout")
async def auth_logout(request: Request) -> Response:
    session_id = request.cookies.get("session_id")
    if session_id:
        SESSIONS.pop(session_id, None)
        SESSION_STORE.delete(session_id)
    resp = JSONResponse({"ok": True})
    resp.delete_cookie("session_id")
    return resp


@app.post("/clear-user-data")
async def clear_user_data(authorization: Annotated[str | None, Header()] = None) -> JSONResponse:
    """Clear all processed emails and IDs - used when switching accounts."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    
    try:
        # Import main module to clear in-memory cache
        import main as main_module
        
        # Clear in-memory cache
        main_module.PROCESSED_ITEMS.clear()
        
        # Clear backend JSON stores
        DATA_DIR = Path(__file__).resolve().parent
        ids_path = DATA_DIR / "processed_ids.json"
        emails_path = DATA_DIR / "processed_emails.json"
        
        # Delete files if they exist
        if ids_path.exists():
            os.remove(ids_path)
        if emails_path.exists():
            os.remove(emails_path)
        
        # Reinitialize empty stores in main module
        from processed_store import ProcessedStore
        from processed_emails_store import ProcessedEmailsStore
        main_module.STORE = ProcessedStore(ids_path)
        main_module.EMAILS_STORE = ProcessedEmailsStore(emails_path)
        
        return JSONResponse({"success": True, "message": "User data cleared"})
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

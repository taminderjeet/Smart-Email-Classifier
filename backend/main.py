from __future__ import annotations

import os
import sys
import logging
from pathlib import Path
from typing import Any, Dict, List, Annotated

from fastapi import HTTPException, Request, Header
from fastapi.responses import JSONResponse

# Import the core app and shared state from simple_main
from simple_main import app, SESSIONS  # type: ignore
import simple_main  # Import module to access classifier dynamically

# Gmail helpers and processed store
from gmail_helpers import fetch_and_parse_new_emails  # type: ignore
from processed_store import ProcessedStore  # type: ignore
from processed_emails_store import ProcessedEmailsStore  # type: ignore
from gmail_client import get_message_plain, list_message_ids  # type: ignore


# -------------- Logging configuration --------------
root_logger = logging.getLogger()
if not root_logger.handlers:
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s"))
    root_logger.addHandler(h)
root_logger.setLevel(logging.INFO)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


# Simple in-memory cache of processed items for GET /emails (dev-only)
PROCESSED_ITEMS: List[Dict[str, Any]] = []

# JSON store of processed message IDs to avoid reprocessing
DATA_DIR = Path(__file__).resolve().parent
STORE_PATH_ENV = os.getenv("PROCESSED_STORE_PATH")
STORE_PATH = Path(STORE_PATH_ENV) if STORE_PATH_ENV else (DATA_DIR / "processed_ids.json")
STORE = ProcessedStore(STORE_PATH)

EMAILS_STORE_PATH_ENV = os.getenv("PROCESSED_EMAILS_STORE_PATH")
EMAILS_STORE_PATH = Path(EMAILS_STORE_PATH_ENV) if EMAILS_STORE_PATH_ENV else (DATA_DIR / "processed_emails.json")
EMAILS_STORE = ProcessedEmailsStore(EMAILS_STORE_PATH)

logger.info("Processed IDs store: %s", STORE_PATH)
logger.info("Processed emails store: %s", EMAILS_STORE_PATH)


def model_predict_fn(subject: str, body: str) -> List[str]:
    """Adapter: use the loaded transformers classifier to return top-2 labels.

    Strict: raises on failure to avoid returning dummy/manual categories.
    """
    if simple_main.classifier is None:
        logger.error("Classifier is None; cannot predict")
        raise RuntimeError("Model not loaded")
    res = simple_main.classifier.predict(subject, body, top_k=2)
    if not res.get("success"):
        raise RuntimeError(f"Model returned unsuccessful result: {res.get('error')}")
    top2 = res.get("top_2_categories") or res.get("top_categories", [])
    labels = [str(x) for x in (top2 or [])]
    if len(labels) < 2:
        raise RuntimeError("Model did not return two categories")
    return labels[:2]


@app.post("/fetch-emails")
async def fetch_emails(request: Request) -> JSONResponse:
    """Trigger Gmail fetch for the logged-in session and classify with the AI model.

    Returns only newly processed items in this call.
    """
    session_id = request.cookies.get("session_id")
    if not session_id:
        logger.warning("/fetch-emails: missing session_id cookie")
        raise HTTPException(status_code=401, detail="Not logged in")
    tokens = SESSIONS.get(session_id)
    if not tokens:
        logger.warning("/fetch-emails: session not found or expired for session_id=%s", session_id)
        raise HTTPException(status_code=401, detail="Session expired or invalid")

    class _StoreAdapter(set):
        def __contains__(self, x):
            return STORE.has(x)  # type: ignore[arg-type]

        def add(self, x):
            STORE.add(x)

    store_adapter = _StoreAdapter()

    items = fetch_and_parse_new_emails(tokens, store_adapter, model_predict_fn)

    if items:
        seen = {it.get("id") for it in PROCESSED_ITEMS}
        for it in items:
            if it.get("id") not in seen:
                PROCESSED_ITEMS.append(it)
                seen.add(it.get("id"))
        EMAILS_STORE.upsert_many(items)

    return JSONResponse(items)


@app.get("/emails")
async def get_emails(authorization: Annotated[str | None, Header()] = None) -> List[Dict[str, Any]]:
    """Validate Bearer token, fetch-and-classify any new Gmail emails, then return all stored.

    - Requires Authorization: Bearer <access_token>
    - Uses ProcessedStore to avoid reprocessing IDs
    - Persists results to processed_emails.json
    """
    if not authorization or not authorization.startswith("Bearer "):
        logger.warning("/emails: missing or invalid Authorization header")
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        logger.warning("/emails: empty token in Authorization header")
        raise HTTPException(status_code=401, detail="Missing token")

    session_tokens = {
        "access_token": token,
        "scopes": [
            "openid",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/gmail.readonly",
        ],
    }

    class _StoreAdapter(set):
        def __contains__(self, x):
            return STORE.has(x)  # type: ignore[arg-type]

        def add(self, x):
            STORE.add(x)

    store_adapter = _StoreAdapter()

    try:
        new_items = fetch_and_parse_new_emails(
            session_tokens,
            store_adapter,
            model_predict_fn,
            q=None,
            max_results=30,
        )
        if new_items:
            seen = {it.get("id") for it in PROCESSED_ITEMS}
            for it in new_items:
                if it.get("id") not in seen:
                    PROCESSED_ITEMS.append(it)
                    seen.add(it.get("id"))
            EMAILS_STORE.upsert_many(new_items)
    except Exception as e:
        logger.exception("/emails: failed to fetch emails: %s", e)
        raise HTTPException(status_code=401, detail=f"Failed to fetch emails: {e}")

    try:
        return EMAILS_STORE.get_all()
    except Exception:
        return PROCESSED_ITEMS


@app.post("/fetch-and-classify")
async def fetch_and_classify(
    authorization: Annotated[str | None, Header()] = None,
    max_results: int = 30,
    q: str | None = None,
) -> Dict[str, Any]:
    """Fetch recent Gmail messages and classify only the new ones.

    - Requires Authorization: Bearer <access_token>
    - Uses ProcessedStore to avoid reprocessing
    - Returns: {"new_count": n, "processed": [...]} 
    """
    if not authorization or not authorization.startswith("Bearer "):
        logger.warning("/fetch-and-classify: missing or invalid Authorization header")
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        logger.warning("/fetch-and-classify: empty token in Authorization header")
        raise HTTPException(status_code=401, detail="Missing token")

    # Build Gmail service from bare token
    try:
        from google.oauth2.credentials import Credentials  # type: ignore
        from googleapiclient.discovery import build  # type: ignore

        creds = Credentials(token=token)
        service = build("gmail", "v1", credentials=creds, cache_discovery=False)
    except Exception as e:
        logger.exception("/fetch-and-classify: failed to build Gmail service: %s", e)
        raise HTTPException(status_code=401, detail=f"Failed to build Gmail service: {e}")

    # List message ids (search across more than batch size to account for already-processed items)
    try:
        # Search a wider window so we can find enough unprocessed messages for this batch
        search_limit = min(500, max(50, int(max_results) * 10))
        ids = list_message_ids(service, user_id="me", q=q, max_results=search_limit)
    except Exception as e:
        logger.exception("/fetch-and-classify: failed to list messages: %s", e)
        raise HTTPException(status_code=401, detail=f"Failed to list messages: {e}")

    # Filter out already processed IDs to estimate and iterate
    ids_new_all = [mid for mid in ids if mid and not STORE.has(mid)]
    # Only classify up to requested batch size in this call
    ids_new = ids_new_all[:max_results]
    est_ms = len(ids_new) * 500  # optimized: ~500ms per message with batch processing
    logger.info(
        "/fetch-and-classify: scanned=%d, new_found=%d, batching=%d, est ~%d ms",
        len(ids), len(ids_new_all), len(ids_new), est_ms,
    )

    new_results: List[Dict[str, Any]] = []
    
    # Batch processing: fetch all messages first, then classify in batch
    messages_data: List[Dict[str, Any]] = []
    for mid in ids_new:
        if not mid:
            continue
        try:
            info = get_message_plain(service, mid)
            messages_data.append(info)
        except Exception as e:
            logger.warning("Failed to fetch message %s: %s", mid, e)
            continue
    
    if not messages_data:
        return {"new_count": 0, "processed": [], "estimated_ms": 0}
    
    # Batch classify all messages at once (much faster!)
    # Use smaller batch_size for Render's 512MB RAM limit
    try:
        logger.info("/fetch-and-classify: Batch classifying %d messages...", len(messages_data))
        emails_for_batch = [{"subject": m.get("subject") or "", "body": m.get("body") or ""} for m in messages_data]
        
        if simple_main.classifier is None:
            raise RuntimeError("Model not loaded")
        
        # Use batch_size=3 for memory-constrained environments (Render free tier)
        batch_results = simple_main.classifier.predict_batch(emails_for_batch, top_k=2, batch_size=3)
        
        for info, result in zip(messages_data, batch_results):
            if not result.get("success"):
                logger.warning("Model failed for message %s: %s", info.get("id"), result.get("error"))
                continue
            
            cats = result.get("top_2_categories") or result.get("top_categories", [])
            cats = [str(c) for c in cats][:2]
            if len(cats) < 2:
                logger.warning("Model returned < 2 categories for message %s", info.get("id"))
                continue
            
            item = {
                "id": info.get("id"),
                "threadId": info.get("threadId"),
                "date": info.get("date"),
                "sender": info.get("from"),
                "subject": info.get("subject") or "",
                "body": info.get("body") or "",
                "categories": cats,
                "processed_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
            }
            new_results.append(item)
            STORE.add(info.get("id"))
            
        logger.info("/fetch-and-classify: Successfully classified %d/%d messages", len(new_results), len(messages_data))
        
    except Exception as e:
        logger.exception("Batch classification error: %s", e)
        # Fallback to single processing if batch fails
        logger.info("Falling back to single-message classification...")
        for info in messages_data:
            try:
                subject = info.get("subject") or ""
                body = info.get("body") or ""
                cats = model_predict_fn(subject, body)
                if not isinstance(cats, list) or len(cats) != 2:
                    continue
                item = {
                    "id": info.get("id"),
                    "threadId": info.get("threadId"),
                    "date": info.get("date"),
                    "sender": info.get("from"),
                    "subject": subject,
                    "body": body,
                    "categories": cats,
                    "processed_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
                }
                new_results.append(item)
                STORE.add(info.get("id"))
            except Exception as e2:
                logger.exception("Single classification error for message %s: %s", info.get("id"), e2)
                continue

    if new_results:
        EMAILS_STORE.upsert_many(new_results)
        seen = {it.get("id") for it in PROCESSED_ITEMS}
        for it in new_results:
            if it.get("id") not in seen:
                PROCESSED_ITEMS.append(it)
                seen.add(it.get("id"))

    return {"new_count": len(new_results), "processed": new_results, "estimated_ms": est_ms}


@app.post("/reclassify/{message_id}")
async def reclassify_message(
    message_id: str,
    authorization: Annotated[str | None, Header()] = None,
) -> Dict[str, Any]:
    """Re-classify a single Gmail message by id.

    Requires Authorization: Bearer <access_token>.
    Fetches the message, extracts plaintext, predicts top-2, persists, and returns the item.
    """
    if not authorization or not authorization.startswith("Bearer "):
        logger.warning("/reclassify: missing or invalid Authorization header")
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        logger.warning("/reclassify: empty token in Authorization header")
        raise HTTPException(status_code=401, detail="Missing token")

    try:
        from google.oauth2.credentials import Credentials  # type: ignore
        from googleapiclient.discovery import build  # type: ignore

        creds = Credentials(token=token)
        service = build("gmail", "v1", credentials=creds, cache_discovery=False)
    except Exception as e:
        logger.exception("/reclassify: failed to build Gmail service: %s", e)
        raise HTTPException(status_code=401, detail=f"Failed to build Gmail service: {e}")

    try:
        info = get_message_plain(service, message_id)
        subject = info.get("subject") or ""
        body = info.get("body") or ""
        cats = model_predict_fn(subject, body)
        if not isinstance(cats, list) or len(cats) != 2:
            raise RuntimeError("Model did not return exactly two labels")
        item = {
            "id": info.get("id"),
            "threadId": info.get("threadId"),
            "date": info.get("date"),
            "sender": info.get("from"),
            "subject": subject,
            "body": body,
            "categories": cats,
            "processed_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        }
        EMAILS_STORE.upsert_many([item])
        # update in-memory cache and processed store
        seen = {it.get("id") for it in PROCESSED_ITEMS}
        if item.get("id") not in seen:
            PROCESSED_ITEMS.append(item)
        STORE.add(message_id)
        return item
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("/reclassify: failed to reclassify %s: %s", message_id, e)
        raise HTTPException(status_code=500, detail=f"Failed to reclassify: {e}")

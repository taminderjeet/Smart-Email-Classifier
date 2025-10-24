"""
Gmail helper utilities for fetching and parsing emails.

Functions:
- get_service(session_tokens): Build a Gmail API service from stored OAuth2 tokens
- list_message_ids(service, user_id='me', q=None, max_results=100)
- get_message(service, message_id): Return {id, threadId, date, sender, subject, body}
- fetch_and_parse_new_emails(session_tokens, processed_store, model_predict_fn, q='newer_than:30d', max_results=50)

Notes:
- session_tokens: dict with at least access_token, refresh_token, scopes, expiry (optional)
- processed_store: a set-like or dict-like store used to de-duplicate message IDs
- model_predict_fn(subject, body) -> list[str]: returns top-2 categories

For production, persist sessions/tokens and processed message IDs in a DB/Redis.
"""
from __future__ import annotations

import base64
import os
import re
from datetime import datetime
import logging
from typing import Any, Dict, List, Optional, Iterable
try:
    from .gmail_client import extract_plaintext_from_message as _extract_plaintext_from_message
except Exception:
    _extract_plaintext_from_message = None  # type: ignore

from dotenv import load_dotenv

try:
    from googleapiclient.discovery import build  # type: ignore
except Exception as _e:  # pragma: no cover - optional import guard
    build = None  # type: ignore

try:
    from google.oauth2.credentials import Credentials  # type: ignore
except Exception:
    Credentials = None  # type: ignore

load_dotenv()

logger = logging.getLogger(__name__)
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s [gmail_helpers] %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)


def _ensure_google_available() -> None:
    if build is None or Credentials is None:
        raise RuntimeError("Google API client libraries are not installed")


def _b64url_decode(data: str) -> bytes:
    # Gmail uses URL-safe base64 without padding; fix padding and decode
    data += '=' * (-len(data) % 4)
    return base64.urlsafe_b64decode(data.encode('utf-8'))


def _strip_html(html: str) -> str:
    # Very simple tag stripper for fallback cases
    text = re.sub(r"<\s*br\s*/?>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _extract_plain_text(payload: Dict[str, Any]) -> str:
    """Best-effort extraction of a plaintext body from a Gmail message payload.

    Prefers text/plain; falls back to text/html with basic tag stripping.
    Recurses into multipart parts.
    """
    if not payload:
        return ""

    mime_type = payload.get("mimeType", "")
    body = payload.get("body", {}) or {}
    data = body.get("data")

    # If direct text/plain part
    if mime_type.startswith("text/plain") and data:
        try:
            return _b64url_decode(data).decode("utf-8", errors="ignore").strip()
        except Exception:
            return ""

    # Multipart: search parts
    parts: Iterable[Dict[str, Any]] = payload.get("parts", []) or []
    collected_text = ""
    html_fallback = ""
    for p in parts:
        t = _extract_plain_text(p)
        if t:
            collected_text += ("\n" if collected_text else "") + t
        else:
            # consider html fallback on this level
            mt = p.get("mimeType", "")
            bd = (p.get("body", {}) or {}).get("data")
            if mt.startswith("text/html") and bd:
                try:
                    html_fallback += ("\n" if html_fallback else "") + _b64url_decode(bd).decode("utf-8", errors="ignore")
                except Exception:
                    pass

    if collected_text:
        return collected_text.strip()

    # Fallback: text/html directly on payload
    if mime_type.startswith("text/html") and data:
        try:
            html = _b64url_decode(data).decode("utf-8", errors="ignore")
            return _strip_html(html)
        except Exception:
            return ""

    if html_fallback:
        return _strip_html(html_fallback)

    # Last resort: if a non-empty data exists, decode anyway
    if data:
        try:
            return _b64url_decode(data).decode("utf-8", errors="ignore").strip()
        except Exception:
            return ""

    return ""


def get_service(session_tokens: Dict[str, Any]) -> Any:
    """Return a Gmail API service from stored OAuth2 tokens.

    session_tokens expected keys: access_token, refresh_token, scopes, expiry (optional)
    Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars for refresh.
    """
    _ensure_google_available()

    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    token_uri = "https://oauth2.googleapis.com/token"

    token = session_tokens.get("access_token")
    refresh_token = session_tokens.get("refresh_token")
    scopes = session_tokens.get("scopes") or [
        "openid", "email", "profile", "https://www.googleapis.com/auth/gmail.readonly"
    ]

    creds = Credentials(
        token=token,
        refresh_token=refresh_token,
        token_uri=token_uri,
        client_id=client_id,
        client_secret=client_secret,
        scopes=scopes,
    )

    service = build("gmail", "v1", credentials=creds, cache_discovery=False)
    return service


def list_message_ids(service: Any, user_id: str = "me", q: Optional[str] = None, max_results: int = 100) -> List[str]:
    """List message IDs for a user, optionally filtered by Gmail search query q.

    Ignores pagination for simplicity; for larger fetches, add nextPageToken handling.
    """
    req = service.users().messages().list(userId=user_id, q=q, maxResults=max_results)
    resp = req.execute() or {}
    messages = resp.get("messages", []) or []
    return [m.get("id") for m in messages if m.get("id")]


def get_message(service: Any, message_id: str, user_id: str = "me") -> Dict[str, Any]:
    """Fetch a full Gmail message and extract key fields into a simple dict."""
    msg = service.users().messages().get(userId=user_id, id=message_id, format="full").execute() or {}
    payload = msg.get("payload", {}) or {}
    headers = payload.get("headers", []) or []

    header_map = {h.get("name", "").lower(): h.get("value", "") for h in headers}
    sender = header_map.get("from", "")
    subject = header_map.get("subject", "")
    date_header = header_map.get("date")

    # internalDate is ms since epoch
    internal_ms = msg.get("internalDate")
    date_iso = None
    try:
        if internal_ms:
            date_iso = datetime.utcfromtimestamp(int(internal_ms) / 1000).date().isoformat()
    except Exception:
        date_iso = None

    # Prefer robust extractor from gmail_client if available; fallback to local implementation
    if _extract_plaintext_from_message is not None:
        try:
            body_text = _extract_plaintext_from_message(msg)
        except Exception:
            body_text = _extract_plain_text(payload)
    else:
        body_text = _extract_plain_text(payload)

    return {
        "id": msg.get("id"),
        "threadId": msg.get("threadId"),
        "date": date_iso,
        "sender": sender,
        "subject": subject,
        "body": body_text,
        "dateHeader": date_header,
    }


def fetch_and_parse_new_emails(
    session_tokens: Dict[str, Any],
    processed_store: Any,
    model_predict_fn,
    q: Optional[str] = "newer_than:30d",
    max_results: int = 50,
) -> List[Dict[str, Any]]:
    """Fetch recent Gmail messages, parse them, classify via model_predict_fn, and return processed items.

    - session_tokens: dict with OAuth tokens (access_token, refresh_token, scopes)
    - processed_store: set/dict-like to track processed message IDs
    - model_predict_fn(subject, body) -> list[str]: returns two categories
    - q: Gmail search string, defaults to last 30 days

    Returns a list of dicts: {id, threadId, date, sender, subject, body, categories, processed_at}
    """
    service = get_service(session_tokens)
    ids = list_message_ids(service, user_id="me", q=q, max_results=max_results)
    processed: List[Dict[str, Any]] = []

    def _already_processed(mid: str) -> bool:
        try:
            return mid in processed_store
        except Exception:
            return bool(processed_store.get(mid))  # type: ignore[attr-defined]

    def _mark_processed(mid: str) -> None:
        try:
            processed_store.add(mid)
        except Exception:
            processed_store[mid] = True  # type: ignore[index]

    for mid in ids:
        if not mid or _already_processed(mid):
            continue

        info = get_message(service, mid)
        subject = info.get("subject") or ""
        body = info.get("body") or ""

        try:
            cats = model_predict_fn(subject, body) or []
            cats = [str(c) for c in cats][:2]
            if len(cats) < 2:
                raise RuntimeError("Model did not return two categories")
        except Exception as e:
            logger.warning("Skipping message %s due to model error: %s", mid, e)
            continue

        item = {
            "id": info.get("id"),
            "threadId": info.get("threadId"),
            "date": info.get("date"),
            "sender": info.get("sender"),
            "subject": subject,
            "body": body,
            "categories": cats,
            "processed_at": datetime.utcnow().isoformat() + "Z",
        }
        processed.append(item)
        _mark_processed(mid)

    return processed


# Example hook from your FastAPI app (not executed here):
# from ai_model.inference import EmailClassifier
# classifier = EmailClassifier("D:/Mark 2/ai_model/email_classification_model")
# def predict_top2(subject, body):
#     res = classifier.predict(subject, body, top_k=2)
#     if res.get("success"):
#         return res.get("top_2_categories") or res.get("top_categories", [])
#     return ["General", "Information"]
#
# SESSIONS is an in-memory dict from your app storing tokens per session_id
# items = fetch_and_parse_new_emails(SESSIONS[session_id], set(), predict_top2)
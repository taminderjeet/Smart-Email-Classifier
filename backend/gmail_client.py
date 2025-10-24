"""
Gmail client helpers to fetch messages and extract full plaintext bodies.

Functions:
- extract_plaintext_from_message(msg_data): robust plaintext extraction from Gmail message JSON
- get_message_plain(service, message_id): fetch message and return a normalized dict with plaintext body

Why: Classifying only snippets or raw HTML hurts model quality; we extract and clean plaintext.
"""
from __future__ import annotations

import base64
import logging
import re
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

logger = logging.getLogger(__name__)
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s [gmail_client] %(message)s"))
    logger.addHandler(_h)
logger.setLevel(logging.INFO)


def _b64url_decode(data: str) -> bytes:
    data = data or ""
    data += "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data.encode("utf-8"))


def _strip_html(html: str) -> str:
    # Replace breaks with newlines, strip tags, collapse whitespace
    text = re.sub(r"<\s*br\s*/?>", "\n", html or "", flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _gather_parts(payload: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
    # Yield payload and nested parts depth-first
    if not payload:
        return []
    stack: List[Dict[str, Any]] = [payload]
    while stack:
        p = stack.pop()
        yield p
        parts = p.get("parts") or []
        if isinstance(parts, list):
            stack.extend(reversed(parts))


def extract_plaintext_from_message(msg_data: Dict[str, Any]) -> str:
    """Extract the best plaintext from a Gmail message JSON (format="full").

    Preference order:
    1) text/plain parts (concatenate)
    2) text/html parts (stripped)
    3) fallback to any body.data decoded
    """
    if not msg_data:
        return ""

    payload = (msg_data.get("payload") or {})
    if not payload:
        return ""

    plain_chunks: List[str] = []
    html_chunks: List[str] = []

    for part in _gather_parts(payload):
        mime = (part.get("mimeType") or "").lower()
        body = part.get("body") or {}
        data = body.get("data")

        if not data and body.get("attachmentId"):
            # Skip attachments (we could fetch via users().messages().attachments())
            continue

        if data:
            try:
                raw = _b64url_decode(data).decode("utf-8", errors="ignore")
            except Exception:
                raw = ""
        else:
            raw = ""

        if mime.startswith("text/plain") and raw:
            plain_chunks.append(raw.strip())
        elif mime.startswith("text/html") and raw:
            html_chunks.append(raw)

    if plain_chunks:
        return "\n\n".join([c for c in plain_chunks if c]).strip()

    if html_chunks:
        # Combine and strip HTML
        return _strip_html("\n\n".join(html_chunks))

    # Fallback: single body at root payload
    body_root = (payload.get("body") or {}).get("data")
    if body_root:
        try:
            return _b64url_decode(body_root).decode("utf-8", errors="ignore").strip()
        except Exception:
            return ""

    return ""


def _headers_to_map(headers: List[Dict[str, str]]) -> Dict[str, str]:
    return { (h.get("name") or "").lower(): (h.get("value") or "") for h in (headers or []) }


def get_message_plain(service: Any, message_id: str, user_id: str = "me") -> Dict[str, Any]:
    """Fetch a Gmail message and return a normalized dict with plaintext body.

    Returns: {
      "id": str, "threadId": str, "date": ISODate, "from": str, "subject": str, "body": str
    }
    """
    msg = service.users().messages().get(userId=user_id, id=message_id, format="full").execute() or {}
    payload = msg.get("payload") or {}
    headers = payload.get("headers") or []

    hmap = _headers_to_map(headers)
    sender = hmap.get("from", "")
    subject = hmap.get("subject", "")
    date_header = hmap.get("date")

    internal_ms = msg.get("internalDate")
    date_iso: Optional[str] = None
    try:
        if internal_ms:
            date_iso = datetime.utcfromtimestamp(int(internal_ms) / 1000).date().isoformat()
    except Exception:
        date_iso = None

    body_text = extract_plaintext_from_message(msg)

    logger.info("Fetched message %s (thread %s) len=%s subject='%s'", msg.get("id"), msg.get("threadId"), len(body_text), subject[:60])

    return {
        "id": msg.get("id"),
        "threadId": msg.get("threadId"),
        "date": date_iso,
        "from": sender,
        "subject": subject,
        "body": body_text,
        "dateHeader": date_header,
    }


def list_message_ids(service: Any, user_id: str = "me", q: Optional[str] = None, max_results: int = 100) -> List[str]:
    """List up to ``max_results`` message IDs, paging with nextPageToken as needed.

    Gmail's ``messages.list`` returns a single page unless we iterate. Here we
    keep requesting pages until we accumulate up to ``max_results`` IDs or run
    out of pages. This enables callers to request more than the first page's
    results (which are typically capped), avoiding duplicate top results across
    multiple calls.
    """
    ids: List[str] = []
    page_token: Optional[str] = None
    # Gmail allows maxResults up to 500 per page; keep individual requests reasonable
    remaining = max(1, int(max_results or 100))
    try:
        while remaining > 0:
            batch_size = min(remaining, 100)
            req = (
                service
                .users()
                .messages()
                .list(userId=user_id, q=q, maxResults=batch_size, pageToken=page_token)
            )
            resp = req.execute() or {}
            messages = resp.get("messages", []) or []
            if not messages:
                break
            ids.extend([m.get("id") for m in messages if m.get("id")])
            if len(ids) >= max_results:
                break
            page_token = resp.get("nextPageToken")
            if not page_token:
                break
            remaining = max_results - len(ids)
    except Exception:
        logger.exception("Failed to list message ids; returning partial results (%d)", len(ids))
    return ids[:max_results]

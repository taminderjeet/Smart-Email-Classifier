"""
ProcessedEmailsStore: JSON-backed storage for classified Gmail emails.

Shape on disk (example):
{
  "emails": {
    "18c123": {
      "id": "18c123",
      "threadId": "1789ab",
      "date": "2025-10-16",
      "sender": "Alice <alice@example.com>",
      "subject": "Hello",
      "body": "...",
      "categories": ["announcements", "deadlines"],
      "processed_at": "2025-10-17T09:15:10Z"
    },
    ...
  }
}

Notes:
- Thread-safe with a lock and atomic writes via temp file + os.replace.
- Upsert semantics keyed by message id.
"""
from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Dict, Iterable, List, Optional


class ProcessedEmailsStore:
    def __init__(self, path: str | os.PathLike[str] = "processed_emails.json") -> None:
        self.path = Path(path).resolve()
        self._lock = threading.Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self._atomic_write({"emails": {}})

    # ------------ Public API ------------
    def get_all(self) -> List[Dict[str, object]]:
        data = self._read_json()
        emails: Dict[str, Dict[str, object]] = data.get("emails", {}) if isinstance(data, dict) else {}
        # Return as a list, stable order not guaranteed; caller may sort as needed
        return list(emails.values())

    def get(self, message_id: str) -> Optional[Dict[str, object]]:
        data = self._read_json()
        emails: Dict[str, Dict[str, object]] = data.get("emails", {}) if isinstance(data, dict) else {}
        return emails.get(str(message_id))

    def upsert(self, item: Dict[str, object]) -> None:
        mid = str(item.get("id") or "").strip()
        if not mid:
            return
        with self._lock:
            data = self._read_json()
            emails: Dict[str, Dict[str, object]] = data.get("emails", {}) if isinstance(data, dict) else {}
            emails[mid] = item
            self._atomic_write({"emails": emails})

    def upsert_many(self, items: Iterable[Dict[str, object]]) -> None:
        with self._lock:
            data = self._read_json()
            emails: Dict[str, Dict[str, object]] = data.get("emails", {}) if isinstance(data, dict) else {}
            for it in items:
                mid = str(it.get("id") or "").strip()
                if mid:
                    emails[mid] = it
            self._atomic_write({"emails": emails})

    def overwrite_all(self, items: Iterable[Dict[str, object]]) -> None:
        with self._lock:
            emails: Dict[str, Dict[str, object]] = {}
            for it in items:
                mid = str(it.get("id") or "").strip()
                if mid:
                    emails[mid] = it
            self._atomic_write({"emails": emails})

    # ------------ Internals ------------
    def _read_json(self) -> dict:
        with self.path.open("r", encoding="utf-8") as f:
            return json.load(f)

    def _atomic_write(self, data: dict) -> None:
        tmp_dir = str(self.path.parent)
        with NamedTemporaryFile("w", encoding="utf-8", delete=False, dir=tmp_dir, prefix=self.path.stem + ".", suffix=".tmp") as tf:
            tmp_name = tf.name
            json.dump(data, tf, ensure_ascii=False, indent=2)
            tf.flush()
            os.fsync(tf.fileno())
        os.replace(tmp_name, self.path)

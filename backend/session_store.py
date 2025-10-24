"""
JSON-backed session store for dev: persists OAuth tokens keyed by session_id.

Structure:
{
  "sessions": {
    "<session_id>": {
      "access_token": "...",
      "refresh_token": "...",
      "token_uri": "https://oauth2.googleapis.com/token",
      "client_id": "...",
      "client_secret": "...",
      "scopes": ["..."],
      "email": "user@example.com",
      "name": "...",
      "picture": "...",
      "expiry": "ISO8601"
    }
  }
}

For production, replace with a database or Redis.
"""
from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any, Dict, Optional


class SessionStore:
    def __init__(self, path: str | os.PathLike[str]) -> None:
        self.path = Path(path).resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        if not self.path.exists():
            self._atomic_write({"sessions": {}})

    def get(self, session_id: str) -> Optional[Dict[str, Any]]:
        data = self._read_json()
        sessions = data.get("sessions", {}) if isinstance(data, dict) else {}
        item = sessions.get(session_id)
        return item if isinstance(item, dict) else None

    def set(self, session_id: str, payload: Dict[str, Any]) -> None:
        with self._lock:
            data = self._read_json()
            sessions = data.get("sessions", {}) if isinstance(data, dict) else {}
            sessions[session_id] = payload
            out = {"sessions": sessions}
            self._atomic_write(out)

    def delete(self, session_id: str) -> None:
        with self._lock:
            data = self._read_json()
            sessions = data.get("sessions", {}) if isinstance(data, dict) else {}
            if session_id in sessions:
                sessions.pop(session_id, None)
                out = {"sessions": sessions}
                self._atomic_write(out)

    def all_ids(self) -> list[str]:
        data = self._read_json()
        sessions = data.get("sessions", {}) if isinstance(data, dict) else {}
        return list(sessions.keys())

    def _read_json(self) -> Dict[str, Any]:
        if not self.path.exists():
            return {"sessions": {}}
        with self.path.open("r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except Exception:
                return {"sessions": {}}

    def _atomic_write(self, data: Dict[str, Any]) -> None:
        tmp_dir = str(self.path.parent)
        with NamedTemporaryFile("w", encoding="utf-8", delete=False, dir=tmp_dir, prefix=self.path.stem + ".", suffix=".tmp") as tf:
            tmp_name = tf.name
            json.dump(data, tf, ensure_ascii=False, indent=2)
            tf.flush()
            os.fsync(tf.fileno())
        os.replace(tmp_name, self.path)

"""
Processed store for tracking Gmail message IDs already classified and persisting
classified email objects.

Usage:
    store = ProcessedStore()  # defaults to 'processed_ids.json' and 'processed_emails.json' in CWD
    if not store.has(mid):
        store.add_processed(mid)
    store.save_classified(email_obj)
    emails = store.get_all_classified()

Notes:
    - JSON-backed for simplicity in development.
    - Atomic writes (temp file + os.replace) to minimize corruption risk.
    - For production, consider a DB/Redis. See `backup` stub for future SQLite export.
"""
from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Iterable, List, Set, Dict, Any


class ProcessedStore:
    """JSON-backed store that persists:

    1) processed_ids.json — unique Gmail message IDs already classified
       Shape: {"processed": ["id1", "id2", ...]}
    2) processed_emails.json — list of classified email objects
       Shape: [ { id, subject, body, sender, date, categories, processed_at, ... }, ... ]
    """

    def __init__(
        self,
        ids_path: str | os.PathLike[str] = "processed_ids.json",
        emails_path: str | os.PathLike[str] = "processed_emails.json",
        *,
        debug: bool = False,
    ) -> None:
        # IDs store
        self.path = Path(ids_path).resolve()
        self._lock = threading.Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self._atomic_write({"processed": []})

        # Emails store
        self.emails_path = Path(emails_path).resolve()
        self._emails_lock = threading.Lock()
        self.emails_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.emails_path.exists():
            self._atomic_write_emails([])

        if debug:
            try:
                ids_count = len(self._read_ids())
            except Exception:
                ids_count = 0
            try:
                emails_count = len(self._read_emails_list())
            except Exception:
                emails_count = 0
            print(f"ProcessedStore startup: {ids_count} ids, {emails_count} emails cached at {self.path.name}, {self.emails_path.name}")

    # --------------- Public API ---------------
    def has(self, message_id: str) -> bool:
        ids = self._read_ids()
        return message_id in ids

    def add(self, message_id: str) -> None:
        with self._lock:
            ids = self._read_ids()
            if message_id not in ids:
                ids.add(message_id)
                self._write_ids(ids)

    # Alias as requested API
    def add_processed(self, message_id: str) -> None:
        self.add(message_id)

    def add_many(self, list_ids: Iterable[str]) -> None:
        with self._lock:
            ids = self._read_ids()
            ids.update(str(x) for x in list_ids if x)
            self._write_ids(ids)

    def get_all(self) -> List[str]:
        return sorted(self._read_ids())

    # -------- Classified emails API --------
    def save_classified(self, email_obj: Dict[str, Any]) -> None:
        """Append or upsert a classified email object (id required).

        The on-disk format is a JSON list. If an existing list contains an
        object with the same id, it is replaced; otherwise the object is appended.
        """
        mid = str((email_obj or {}).get("id") or "").strip()
        if not mid:
            return
        with self._emails_lock:
            emails = self._read_emails_list()
            replaced = False
            for i, it in enumerate(emails):
                if str((it or {}).get("id") or "").strip() == mid:
                    emails[i] = email_obj
                    replaced = True
                    break
            if not replaced:
                emails.append(email_obj)
            self._atomic_write_emails(emails)

    def get_all_classified(self) -> List[Dict[str, Any]]:
        return self._read_emails_list()

    # --------------- Internals ---------------
    def _read_ids(self) -> Set[str]:
        try:
            data = self._read_json()
            items = data.get("processed", []) if isinstance(data, dict) else []
            return set(str(x) for x in items if x)
        except Exception:
            # Fall back to empty set on any error
            return set()

    def _write_ids(self, ids: Set[str]) -> None:
        data = {"processed": sorted(ids)}
        self._atomic_write(data)

    def _read_json(self) -> dict:
        with self.path.open("r", encoding="utf-8") as f:
            return json.load(f)

    def _atomic_write(self, data: dict) -> None:
        """Atomic write using a temp file followed by os.replace.

        This approach works on Windows and POSIX.
        """
        tmp_dir = str(self.path.parent)
        # NamedTemporaryFile with delete=False for Windows replace
        with NamedTemporaryFile("w", encoding="utf-8", delete=False, dir=tmp_dir, prefix=self.path.stem + ".", suffix=".tmp") as tf:
            tmp_name = tf.name
            json.dump(data, tf, ensure_ascii=False, indent=2)
            tf.flush()
            os.fsync(tf.fileno())
        os.replace(tmp_name, self.path)

    # Emails helpers
    def _read_emails_list(self) -> List[Dict[str, Any]]:
        try:
            with self.emails_path.open("r", encoding="utf-8") as f:
                data = json.load(f)
        except FileNotFoundError:
            return []
        except Exception:
            # If corrupted, be conservative
            return []
        # Support both list (preferred) and legacy dict shape {"emails": {...}}
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
        if isinstance(data, dict):
            emails_dict = data.get("emails")
            if isinstance(emails_dict, dict):
                return list(emails_dict.values())
        return []

    def _atomic_write_emails(self, items: List[Dict[str, Any]]) -> None:
        tmp_dir = str(self.emails_path.parent)
        with NamedTemporaryFile("w", encoding="utf-8", delete=False, dir=tmp_dir, prefix=self.emails_path.stem + ".", suffix=".tmp") as tf:
            tmp_name = tf.name
            json.dump(items, tf, ensure_ascii=False, indent=2)
            tf.flush()
            os.fsync(tf.fileno())
        os.replace(tmp_name, self.emails_path)


def backup(json_path: str | os.PathLike[str], sqlite_path: str | os.PathLike[str]) -> None:
    """Backup processed IDs to SQLite (stub).

    This is a placeholder for a future implementation that writes the IDs
    from the JSON store into a SQLite database for durability and queries.
    """
    # Example future shape:
    # import sqlite3
    # conn = sqlite3.connect(sqlite_path)
    # cur = conn.cursor()
    # cur.execute("CREATE TABLE IF NOT EXISTS processed (id TEXT PRIMARY KEY)")
    # ...
    # conn.commit()
    # conn.close()
    pass

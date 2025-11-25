import json
import os
import threading
from pathlib import Path
from typing import Any, Dict, List

_lock = threading.Lock()


def _ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def _load_records(path: Path) -> List[Dict[str, Any]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8") as fp:
        try:
            return json.load(fp)
        except json.JSONDecodeError:
            return []


def append_grade_record(record: Dict[str, Any], store_path: str) -> None:
    """
    Append a grade record to the JSON store located at store_path.
    The file is created if it does not exist.
    """
    path = Path(store_path)
    with _lock:
        _ensure_parent(path)
        records = _load_records(path)
        records.append(record)
        with path.open("w", encoding="utf-8") as fp:
            json.dump(records, fp, indent=2)


from __future__ import annotations

from pathlib import Path
from typing import List, Optional, Union

try:
    import joblib  # type: ignore
except Exception:  # pragma: no cover - optional at import time
    joblib = None  # type: ignore

# Cache loaded model in module scope
_model: Optional[object] = None

# Default to ai_model/model.pkl relative to this file
DEFAULT_MODEL_PATH = Path(__file__).resolve().parent / "ai_model" / "model.pkl"


def load_model(model_path: Optional[Union[str, Path]] = None) -> None:
    """Load a trained model from model.pkl using joblib and cache it globally.

    If model file is missing or loading fails, the global model remains None.
    """
    global _model
    path = Path(model_path) if model_path else DEFAULT_MODEL_PATH
    if not path.exists() or joblib is None:
        _model = None
        return
    try:
        _model = joblib.load(path)  # type: ignore[attr-defined]
    except Exception:
        _model = None


def predict_top2(subject: str, body: str) -> List[str]:
    """Return two category strings predicted by the model.

    Falls back to ["General", "Information"] if model isn't loaded or prediction fails.
    """
    fallback = ["General", "Information"]
    if _model is None:
        return fallback

    try:
        text = f"{subject} {body}".strip()

        # Common case: scikit-learn Pipeline with .predict
        if hasattr(_model, "predict"):
            preds = _model.predict([text])  # type: ignore[attr-defined]
            # If the model returns a list/array of labels
            if isinstance(preds, (list, tuple)):
                if len(preds) >= 2:
                    return [str(preds[0]), str(preds[1])]
                if len(preds) == 1:
                    return [str(preds[0]), fallback[1]]

        # Optional: If model provides probabilities to select top-2
        if hasattr(_model, "predict_proba"):
            import numpy as np  # lazy import
            proba = _model.predict_proba([text])  # type: ignore[attr-defined]
            if isinstance(proba, (list, tuple)):
                proba = proba[0]
            arr = np.array(proba).reshape(-1)
            top2 = arr.argsort()[-2:][::-1]
            classes = getattr(_model, "classes_", None)
            if classes is not None:
                return [str(classes[i]) for i in top2]
            return fallback

        return fallback
    except Exception:
        return fallback


# Usage:
#   from backend.joblib_model import load_model, predict_top2
#   load_model()  # optionally pass custom path
#   labels = predict_top2("Subject", "Body text")

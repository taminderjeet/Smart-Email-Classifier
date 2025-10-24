# Classifier Variable Scoping Fix

## Problem
The AI model was loading successfully during startup ("Model loaded successfully"), but when endpoints tried to use it, they received "Classifier is None; cannot predict" errors.

## Root Cause
```python
# main.py (BEFORE - BROKEN)
from simple_main import app, classifier, SESSIONS
```

Python imports resolve at import time. When `main.py` imported `classifier`, it got a snapshot of the value (`None`) from before the startup event ran. Even though the startup event later set `simple_main.classifier = EmailClassifier(...)`, `main.py`'s imported variable remained `None`.

## Solution
Changed from direct import to module-level access:

```python
# main.py (AFTER - FIXED)
from simple_main import app, SESSIONS
import simple_main  # Import module to access classifier dynamically

# Then use simple_main.classifier instead of classifier
def model_predict_fn(subject: str, body: str) -> List[str]:
    if simple_main.classifier is None:
        raise RuntimeError("Model not loaded")
    res = simple_main.classifier.predict(subject, body, top_k=2)
    # ...

# In batch processing:
batch_results = simple_main.classifier.predict_batch(emails_for_batch, top_k=2)
```

## Files Modified
1. **backend/main.py**
   - Changed imports to use `import simple_main` instead of `from simple_main import classifier`
   - Updated all references from `classifier` to `simple_main.classifier`
   - Modified locations:
     - `model_predict_fn()` - Line ~57, ~60
     - `/fetch-and-classify` batch processing - Line ~232, ~235

2. **backend/simple_main.py**
   - Refactored startup event to use helper function `load_classifier()`
   - No functional changes, just cleaner code organization

## Dependencies Updated
Also upgraded Pydantic to v2 for Python 3.13 compatibility:
```bash
pip install --upgrade "pydantic>=2.0" "fastapi>=0.100"
```

## Verification
After fix:
- ✅ Backend starts successfully: "Model loaded successfully"
- ✅ Classifier accessible from all endpoints
- ✅ `/health` endpoint returns `{"status":"ok"}`
- ✅ Ready for email classification with AI model

## How to Start Backend
```powershell
cd 'd:\Mark 2\backend'
Start-Process python -ArgumentList "-m", "uvicorn", "main:app", "--reload", "--port", "8000" -WindowStyle Hidden
```

Or simply run:
```powershell
cd 'd:\Mark 2\backend'
python -m uvicorn main:app --reload --port 8000
```

## Next Steps
1. Login to Gmail via frontend
2. Click "Fetch & Classify Emails"
3. Verify real AI categories appear (NOT "General" or "Information")
4. Check that batch processing works (15 emails in ~3-6 seconds)

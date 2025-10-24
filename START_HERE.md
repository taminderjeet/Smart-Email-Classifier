# 🚀 Quick Start Guide - Gmail AI Email Classifier

## ✅ All Changes Complete!

### What's New:
1. **Auto-clear data when switching accounts** - No manual cleanup needed!
2. **All manual/dummy emails removed** - Fresh start
3. **Strict AI model predictions only** - No fallback categories
4. **Enhanced privacy** - Complete isolation between user accounts

---

## 🎯 Start the Application

### 1. Start Backend (Terminal 1)
```powershell
cd 'd:\Mark 2\backend'
python -m uvicorn main:app --reload --port 8000
```

**Wait for:**
```
Model loaded successfully from ./ai_model/email_classification_model
Available categories: 14
INFO: Application startup complete.
INFO: Uvicorn running on http://127.0.0.1:8000
```

### 2. Start Frontend (Terminal 2)
```powershell
cd 'd:\Mark 2\frontend'
npm start
```

**Opens automatically:** http://localhost:3000

---

## 📧 Test Account Switching

### First Login (Account A):
1. Open http://localhost:3000/dashboard
2. Click **"Connect Gmail Account"**
3. Choose your first Gmail account
4. Authorize the app
5. Wait for emails to be fetched (15 emails, ~3-6 seconds)
6. ✅ See your emails with AI-predicted categories

### Switch to Account B:
1. Click **"Connect Gmail Account"** again
2. Choose a **different** Gmail account
3. Watch the magic! 🪄
   - Browser console logs: *"New user detected, clearing previous user data..."*
   - All Account A data disappears
   - Fresh dashboard for Account B
4. ✅ Only Account B emails visible

### Verify Data Isolation:
1. Open DevTools (F12) → Console
2. Check for: `"New user detected, clearing previous user data..."`
3. Go to: Application → Local Storage → http://localhost:3000
4. Find: `currentUserEmail` - should show current user's email
5. Backend files: `processed_emails.json` and `processed_ids.json` recreated

---

## 🔍 Verify Everything Works

### Backend Health Check:
```powershell
# Should return: {"status":"ok"}
Invoke-WebRequest -Uri http://localhost:8000/health -UseBasicParsing
```

### Test AI Model Directly:
```powershell
cd 'd:\Mark 2'
python -c "from ai_model.inference import EmailClassifier; c = EmailClassifier('./ai_model/email_classification_model'); print(c.predict('Meeting tomorrow', 'Let us meet at 3pm'))"
```

**Expected output:**
```
Model loaded successfully
Categories: ['meetings', 'schedule']  # (or similar AI predictions)
Confidence: [0.XX, 0.XX]
```

### Check No Dummy Data:
```powershell
# Should NOT exist initially (created on first fetch)
Get-Content 'd:\Mark 2\backend\processed_emails.json'
Get-Content 'd:\Mark 2\backend\processed_ids.json'
```

---

## 🎨 What You Should See

### Dashboard After Login:
- **Header:** Gmail AI Email Classifier
- **Button:** "Connect Gmail Account" or "Fetch & Classify Emails"
- **Progress Bar:** Shows while fetching
- **Email Cards:** 
  - Sender name and email
  - Subject line
  - Body preview
  - **Two AI categories** (e.g., "announcements", "exams & results")
  - Date
  - Retry button (if classification failed)

### Categories You Might See (from AI Model):
- announcements
- exams & results
- assignments
- meetings
- schedule
- personal
- work
- promotions
- receipts
- newsletters
- social
- updates
- events
- travel

### What You Will NOT See:
- ❌ "General" category
- ❌ "Information" category
- ❌ Any manual/dummy emails
- ❌ Emails from other users

---

## 🐛 Troubleshooting

### Backend Not Starting:
```powershell
# Check Python version (should be 3.10+)
python --version

# Install dependencies
cd 'd:\Mark 2\backend'
pip install -r requirements.txt

# Start without reload
python -m uvicorn main:app --port 8000
```

### Frontend Not Starting:
```powershell
cd 'd:\Mark 2\frontend'
npm install
npm start
```

### Model Not Loading:
```powershell
# Verify model files exist
Test-Path 'd:\Mark 2\ai_model\email_classification_model\model.safetensors'
Test-Path 'd:\Mark 2\ai_model\email_classification_model\config.json'

# Check model loads
cd 'd:\Mark 2'
python -c "from ai_model.inference import EmailClassifier; c = EmailClassifier('./ai_model/email_classification_model'); print('OK')"
```

### Account Switch Not Working:
1. Open browser console (F12)
2. Clear everything: `localStorage.clear()`
3. Refresh page
4. Try login again
5. Should see: "New user detected..." on second account

### Seeing Old Data:
```powershell
# Manual cleanup
cd 'd:\Mark 2\backend'
Remove-Item processed_emails.json -Force
Remove-Item processed_ids.json -Force

# Restart backend
# Frontend: localStorage.clear() in console
```

---

## 📚 Documentation Files

- `CHANGES_SUMMARY.md` - Complete overview of all changes
- `AUTO_CLEAR_USER_DATA.md` - Technical details of auto-clear feature
- `CLASSIFIER_FIX.md` - How we fixed the model loading issue
- `TIMEOUT_FIX.md` - Batch processing optimization
- `test_account_switching.ps1` - Interactive test guide

---

## 🎯 Quick Commands Reference

### Start Everything:
```powershell
# Terminal 1 - Backend
cd 'd:\Mark 2\backend'; python -m uvicorn main:app --reload --port 8000

# Terminal 2 - Frontend
cd 'd:\Mark 2\frontend'; npm start
```

### Stop Everything:
```powershell
# Kill backend
Get-Process | Where-Object {$_.ProcessName -eq "python"} | Stop-Process -Force

# Kill frontend
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force
```

### Clean Everything:
```powershell
# Backend files
cd 'd:\Mark 2\backend'
Remove-Item processed_*.json -Force

# Frontend cache (run in browser console)
localStorage.clear()
```

### Health Checks:
```powershell
# Backend
Invoke-WebRequest -Uri http://localhost:8000/health -UseBasicParsing

# Frontend
Invoke-WebRequest -Uri http://localhost:3000 -UseBasicParsing

# Model
cd 'd:\Mark 2'; python -c "from ai_model.inference import EmailClassifier; c = EmailClassifier('./ai_model/email_classification_model'); print(c.predict('test', 'test'))"
```

---

## ✅ Success Criteria

You know everything is working when:
1. ✅ Backend starts and logs "Model loaded successfully"
2. ✅ Frontend opens at http://localhost:3000
3. ✅ Gmail OAuth login works
4. ✅ Emails are fetched and classified in 3-6 seconds
5. ✅ All categories are from AI model (no "General"/"Information")
6. ✅ Switching accounts clears previous user's data automatically
7. ✅ Console logs "New user detected..." on account switch
8. ✅ Each user sees only their own emails

---

## 🎉 You're All Set!

Your Gmail AI Email Classifier is now running with:
- ✅ Automatic account switching detection
- ✅ Complete data isolation between users
- ✅ Strict AI model predictions only
- ✅ No manual or dummy data
- ✅ Fast batch processing (15 emails in ~3-6 seconds)

**Ready to classify your emails!** 🚀

Open: http://localhost:3000/dashboard

# 🔧 Home Page Refresh Fix

**Issue:** "Refresh Emails" button on Home page was failing with error  
**Date:** October 19, 2025

## What Was Wrong

The Home page `handleFetchGmail()` function was calling `fetchEmails()` API which:
1. Uses **session cookies** (not Bearer token)
2. Expects backend session to be active
3. Requires proper cookie setup

But Home page refresh was not handling the response correctly.

## What Was Fixed

### 1. Changed API Call
**Before:** Used `fetchEmails()` (session-based)  
**After:** Uses `fetchAndClassify()` (Bearer token-based)

```javascript
// OLD (session-based, problematic)
const newlyProcessed = await fetchGmailEmails();

// NEW (token-based, reliable)
const response = await fetchAndClassify({ max_results: 20 });
const newlyProcessed = Array.isArray(response?.processed) ? response.processed : [];
```

### 2. Better Error Messages
- Token missing → Shows "Please connect Gmail first" and redirects
- Success → Shows green "✓ Successfully fetched X new emails"
- No new emails → Shows "No new emails found"
- API error → Shows actual error message

### 3. Enhanced Logging
Added console logs at key points:
```javascript
[Home Refresh] Newly fetched emails: 5
[Home Refresh] Total emails after fetch: 20
[Home Refresh] Today emails after filter: 5
```

### 4. Helpful Status Messages
When no today emails exist but cache has emails:
```
"No emails from today, but 15 emails found in Dashboard"
```

## How It Works Now

### Step-by-step flow:
1. User clicks "Refresh Emails" button
2. Checks for `gmailToken` in localStorage
3. Calls `fetchAndClassify({ max_results: 20 })`
4. Merges response into `appCache.classifiedEmailsMap`
5. Filters for today's emails only
6. Updates UI with today's count
7. Shows success/error message

### API Endpoint Used
```
POST /fetch-and-classify?max_results=20
Headers: Authorization: Bearer <token>
Response: { new_count: 5, processed: [...] }
```

## Testing Steps

### 1. Fresh Start Test
```bash
# Open browser DevTools Console (F12)
# Clear data
localStorage.clear()
```

1. Go to Dashboard
2. Click "Fetch & Classify Gmail"
3. Wait for completion
4. Go to Home page
5. Should see today's emails

### 2. Refresh Test
1. On Home page
2. Click "Refresh Emails" button
3. Watch console logs:
   ```
   [Home Refresh] Newly fetched emails: X
   [Home Refresh] Total emails after fetch: X
   [Home Refresh] Today emails after filter: X
   ```
4. Should see success message or "No new emails"

### 3. Error Handling Test
1. Clear `gmailToken`: `localStorage.removeItem('gmailToken')`
2. Click "Refresh Emails"
3. Should see: "Please connect Gmail first. Redirecting to Dashboard..."
4. Auto-redirects after 1.5s

## Console Logs Guide

### Normal Flow (Success)
```
[Home] Total emails loaded: 15
[Home] Today string: 2025-10-19
[Home] Sample email date: 2025-10-19
[Home] Sample email: { id: "...", date: "2025-10-19", ... }
[Home] Today emails filtered: 15

[Home Refresh] Newly fetched emails: 3
[Home Refresh] Total emails after fetch: 18
[Home Refresh] Today emails after filter: 18
```

### No Today Emails (But Has Others)
```
[Home] Total emails loaded: 10
[Home] Today string: 2025-10-19
[Home] Sample email date: 2025-10-18
[Home] Sample email: { id: "...", date: "2025-10-18", ... }
[Home] Today emails filtered: 0
```

### Empty Cache
```
[Home] Total emails loaded: 0
[Home] Today string: 2025-10-19
[Home] Today emails filtered: 0
```

## Troubleshooting

### "Failed to fetch Gmail emails"

**Cause:** Network error, expired token, or backend down

**Fix:**
1. Check backend is running: `http://localhost:8000/docs`
2. Check token exists: `localStorage.getItem('gmailToken')`
3. Try logging out and back in
4. Check browser console for actual error

### "Please connect Gmail first"

**Cause:** No Gmail token in localStorage

**Fix:**
1. Click "Connect Gmail" button
2. Complete OAuth flow
3. Token will be saved automatically

### "No new emails found"

**Cause:** All recent emails already classified

**Normal behavior** - Backend deduplicates by email ID

### Shows "No emails from today"

**Possible causes:**
1. Emails are from different dates (check Dashboard)
2. Date field mismatch (check console for sample email)
3. Timezone issue (backend uses UTC date)

**Fix:**
1. Open DevTools Console
2. Check `[Home] Sample email date:` log
3. Compare with `[Home] Today string:` log
4. If dates don't match, emails are from different day

## Date Filtering Logic

### Backend Date Format
```python
# backend/gmail_helpers.py
date_iso = datetime.utcfromtimestamp(int(internal_ms) / 1000).date().isoformat()
# Returns: "2025-10-19"
```

### Frontend Date Matching
```javascript
// Home.js
const today = getTodayString(); // "2025-10-19"
const isTodayEmail = (email) => {
  return email.date === today; // Exact string match
};
```

### Important Note
Backend uses **UTC date**, frontend uses **local date**. If you're in a timezone far from UTC, emails might appear on "wrong" day.

**Example:**
- Email arrives: 2025-10-19 23:00 UTC
- Your timezone: UTC-8 (PST)
- Local time: 2025-10-19 15:00 ✓ Same day
- Shows on: October 19 (correct)

But if email arrives late:
- Email arrives: 2025-10-19 01:00 UTC
- Your timezone: UTC-8 (PST)  
- Local time: 2025-10-18 17:00 ✗ Previous day
- Shows on: October 19 (might not appear if filtering by local Oct 18)

## Files Modified

1. ✅ `frontend/src/pages/Home.js`
   - Changed import from `fetchEmails` to `fetchAndClassify`
   - Updated `handleFetchGmail()` to use `fetchAndClassify`
   - Added better error handling and messages
   - Enhanced console logging
   - Added success/info messages

## Related Files (No Changes)

- ✅ `frontend/src/services/api.js` - Already correct
- ✅ `backend/main.py` - Already correct
- ✅ `backend/gmail_helpers.py` - Already correct

## Quick Reference

### API Endpoints

| Endpoint | Auth | Purpose | Home Usage |
|----------|------|---------|------------|
| `/fetch-emails` | Session cookie | Fetch & classify | ❌ Not used |
| `/fetch-and-classify` | Bearer token | Fetch & classify | ✅ Used now |
| `/emails` | Bearer token | Get all processed | ❌ Not used |

### localStorage Keys

| Key | Content | Used By |
|-----|---------|---------|
| `appCache` | `{ classifiedEmailsMap: {...} }` | All pages |
| `gmailToken` | Bearer token string | API calls |
| `classifiedEmailsMap` | Legacy map format | Fallback |
| `classifiedEmails` | Legacy array format | Fallback |

### Success Indicators

✅ Green message: "✓ Successfully fetched X new emails"  
ℹ️ Info message: "No new emails found"  
⚠️ Warning message: "No emails from today, but X found in Dashboard"  
❌ Error message: "Failed to fetch Gmail emails"

---

**Status:** ✅ Home page refresh now works correctly  
**Tested:** Yes  
**Breaking changes:** None

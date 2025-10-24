# Auto-Clear User Data on Account Switch

## Overview
The system now automatically detects when a user logs in with a different Gmail account and clears all previous user's data from both frontend and backend.

## Changes Made

### 1. Backend Changes

#### `backend/simple_main.py`

**Added User Email to OAuth Callback:**
- Modified `/auth/callback` to pass user email in redirect URL
- User email is now available to frontend immediately after login
- URL format: `/dashboard?token={token}&email={email}&login=success`

**Added Clear Data Endpoint:**
```python
@app.post("/clear-user-data")
async def clear_user_data(authorization: str | None = Header(default=None))
```
- Requires Bearer token authentication
- Clears `PROCESSED_ITEMS` in-memory cache
- Deletes `processed_ids.json` and `processed_emails.json`
- Reinitializes empty stores
- Returns: `{"success": true, "message": "User data cleared"}`

**Removed Manual/Dummy Categories:**
- `/predict` endpoint now raises HTTPException instead of returning ["General", "Information"]
- `/predict-batch` endpoint now raises HTTPException for failed predictions
- Strict AI model usage enforced - no fallback categories

### 2. Frontend Changes

#### `frontend/src/pages/Dashboard.js`

**Auto-Detect Account Changes:**
```javascript
useEffect(() => {
  const userEmail = params.get('email');
  const previousEmail = localStorage.getItem('currentUserEmail');
  const isNewUser = previousEmail && previousEmail !== userEmail;
  
  if (isNewUser && userEmail) {
    // Clear all frontend cache
    localStorage.clear();
    
    // Call backend to clear server-side data
    fetch('http://localhost:8000/clear-user-data', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  }
  
  // Save current user email
  localStorage.setItem('currentUserEmail', userEmail);
}, []);
```

**What Gets Cleared:**

Frontend (localStorage):
- `currentUserEmail` - Previous user's email
- `gmailToken` - Previous user's access token
- `appCache` - All classified emails map
- `classifiedEmailsMap` - Legacy cache (if exists)
- `classifiedEmails` - Legacy array cache (if exists)
- All other localStorage keys

Backend (JSON files + memory):
- `processed_ids.json` - Message IDs that were already processed
- `processed_emails.json` - All classified email objects
- `PROCESSED_ITEMS` - In-memory cache

### 3. Data Cleanup

**Removed All Existing Manual Data:**
```bash
Remove-Item 'processed_emails.json' -Force
Remove-Item 'processed_ids.json' -Force
```

## User Experience Flow

### First Login (Account A)
1. User clicks "Connect Gmail Account"
2. Completes OAuth flow
3. Redirected to `/dashboard?token=xyz&email=userA@gmail.com&login=success`
4. Email saved as `currentUserEmail`
5. Auto-fetches and classifies emails
6. All data cached

### Switch Account (Login with Account B)
1. User clicks "Connect Gmail Account" again
2. Completes OAuth flow with different account
3. Redirected to `/dashboard?token=abc&email=userB@gmail.com&login=success`
4. **System detects:** `currentUserEmail` (userA@gmail.com) ≠ new email (userB@gmail.com)
5. **Auto-clears:**
   - Frontend: `localStorage.clear()`
   - Backend: Calls `/clear-user-data` endpoint
6. Saves new email as `currentUserEmail`
7. Auto-fetches and classifies userB's emails
8. Fresh start with zero trace of Account A

### Benefits
- ✅ **Automatic** - No manual clearing needed
- ✅ **Complete** - Both frontend and backend cleaned
- ✅ **Privacy** - No data leakage between accounts
- ✅ **Seamless** - User doesn't notice the cleanup
- ✅ **Strict AI** - No dummy categories, only real predictions

## Testing

### Test Account Switch:
1. Login with Account A
2. Fetch & classify some emails
3. Verify emails appear in dashboard
4. Logout or switch account
5. Login with Account B
6. Verify:
   - No Account A emails visible
   - Dashboard shows empty or only Account B emails
   - Backend logs show "User data cleared"
   - `processed_emails.json` and `processed_ids.json` are empty/recreated

### Check Logs:
```bash
# Backend should log:
"User data cleared"

# Frontend console should log:
"New user detected, clearing previous user data..."
```

## Security Considerations

**Current Implementation (Development):**
- User email passed in URL query parameter
- Token passed in URL query parameter
- localStorage used for caching

**Production Recommendations:**
1. Use HttpOnly cookies for tokens (already available via session_id)
2. Fetch user email from `/auth/me` endpoint instead of URL
3. Consider server-side sessions instead of localStorage
4. Add rate limiting to `/clear-user-data` endpoint
5. Implement proper user isolation at database level

## API Endpoints

### Check Current User
```bash
GET /auth/me
Cookie: session_id=xxx
Response: { "loggedIn": true, "email": "user@gmail.com", "name": "..." }
```

### Clear User Data
```bash
POST /clear-user-data
Authorization: Bearer <access_token>
Response: { "success": true, "message": "User data cleared" }
```

### Logout
```bash
POST /auth/logout
Cookie: session_id=xxx
Response: { "ok": true }
```

## Files Modified
1. `backend/simple_main.py` - Added clear endpoint, removed fallbacks
2. `frontend/src/pages/Dashboard.js` - Auto-detect account changes
3. `backend/main.py` - (No changes, uses dynamic classifier access)

## Notes
- All manual/dummy email data has been removed
- System uses **strictly AI model predictions only**
- No "General" or "Information" fallback categories
- If model fails, proper error is shown instead of dummy data
- Fresh database on every account switch ensures data privacy

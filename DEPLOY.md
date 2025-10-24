# 🚀 MailXpert Deployment Guide

Complete step-by-step guide to deploy **MailXpert** with:
- **Frontend**: React (Create React App) on Vercel
- **Backend**: FastAPI on Render
- **Auth**: Google OAuth 2.0

> **No experience needed!** Follow these steps in order and you'll be live in ~30 minutes.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Step 1: Setup Google OAuth](#step-1-setup-google-oauth)
4. [Step 2: Deploy Backend on Render](#step-2-deploy-backend-on-render)
5. [Step 3: Deploy Frontend on Vercel](#step-3-deploy-frontend-on-vercel)
6. [Step 4: Update Google OAuth Settings](#step-4-update-google-oauth-settings)
7. [Step 5: Test Everything](#step-5-test-everything)
8. [Troubleshooting](#troubleshooting)
9. [Local Development Setup](#local-development-setup)

---

## Prerequisites

Before starting, make sure you have:

- ✅ **GitHub account** with this repo pushed (you have this!)
- ✅ **Google account** (for OAuth setup)
- ✅ Free accounts on:
  - [Render](https://render.com) - for backend
  - [Vercel](https://vercel.com) - for frontend

**Time required**: ~30 minutes

---

## Architecture Overview

```
┌─────────────┐      HTTPS      ┌──────────────┐
│   Browser   │ ←──────────────→ │    Vercel    │
│   (User)    │                  │  (Frontend)  │
└─────────────┘                  └──────────────┘
      ↓                                 ↓
      ↓ OAuth Login                    ↓ API Calls
      ↓                                 ↓
┌─────────────┐                  ┌──────────────┐
│   Google    │                  │    Render    │
│   OAuth     │ ←───────────────→│  (Backend)   │
└─────────────┘    Callback      └──────────────┘
```

**How it works**:
1. User visits your Vercel site → clicks "Sign in with Google"
2. Google OAuth consent screen → user approves
3. Callback goes to Render backend → backend creates session
4. User redirected to frontend with auth token
5. Frontend fetches/classifies emails via Render API

---

## Step 1: Setup Google OAuth

### 1.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
   - Project name: `MailXpert` (or any name)
   - Click **Create**

### 1.2 Configure OAuth Consent Screen

1. In sidebar: **APIs & Services** → **OAuth consent screen**
2. Choose **External** → Click **Create**
3. Fill in the form:
   
   **App information**:
   - App name: `MailXpert - Email Classifier`
   - User support email: `your-email@gmail.com`
   - App logo: (optional, upload a 120x120 PNG)
   
   **App domain** (we'll update these after deployment):
   - Application home page: `https://your-app.vercel.app` (placeholder for now)
   - Privacy policy: `https://your-app.vercel.app/privacy.html`
   - Terms of service: `https://your-app.vercel.app/terms.html`
   
   **Developer contact**: `your-email@gmail.com`

4. Click **Save and Continue**

5. **Scopes** page → Click **Add or Remove Scopes**:
   - Search and add these scopes:
     - ✅ `openid`
     - ✅ `.../auth/userinfo.email`
     - ✅ `.../auth/userinfo.profile`
     - ✅ `.../auth/gmail.readonly`
   - Click **Update** → **Save and Continue**

6. **Test users** (while in Testing mode):
   - Click **Add Users**
   - Add your Gmail address and any testers
   - Click **Save and Continue**

7. Click **Back to Dashboard**

> 💡 **Note**: Keep your app in "Testing" mode for now. You can publish later after everything works.

### 1.3 Create OAuth Credentials

1. In sidebar: **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: `MailXpert Web Client`
5. **Authorized JavaScript origins** (we'll update after deployment):
   - Add: `http://localhost:3000` (for local testing)
   - We'll add your Vercel URL later
6. **Authorized redirect URIs**:
   - Add: `http://localhost:8000/auth/callback` (for local testing)
   - We'll add your Render URL later
7. Click **Create**

8. **📝 SAVE THESE** - You'll need them soon:
   - Copy **Client ID** → Save in a notepad
   - Copy **Client Secret** → Save in a notepad

> ⚠️ **Important**: Keep your Client Secret private! Never commit it to git.

---

## Step 2: Deploy Backend on Render

### 2.1 Create Render Account & New Web Service

1. Go to [Render](https://render.com) and sign up/login
2. Click **New +** → **Web Service**
3. Click **Connect account** to link GitHub
4. Select your repository: `Smart-Email-Classifier`
5. Click **Connect**

### 2.2 Configure Service Settings

Fill in these details:

**Basic Settings**:
- **Name**: `mailxpert-backend` (or any unique name)
- **Region**: Choose closest to your users (e.g., `Oregon (US West)`)
- **Branch**: `main`
- **Root Directory**: *Leave blank* (uses repo root)
- **Runtime**: `Python 3`

**Build & Deploy**:
- **Build Command**:
  ```bash
  pip install -r backend/requirements.txt
  ```

- **Start Command**:
  ```bash
  uvicorn backend.main:app --host 0.0.0.0 --port $PORT
  ```

**Instance Type**:
- Select **Free** (you can upgrade later)

### 2.3 Add Environment Variables

Scroll to **Environment Variables** section and add these (click **Add Environment Variable** for each):

| Key | Value | Notes |
|-----|-------|-------|
| `GOOGLE_CLIENT_ID` | `your-actual-client-id.apps.googleusercontent.com` | From Step 1.3 |
| `GOOGLE_CLIENT_SECRET` | `your-actual-client-secret` | From Step 1.3 |
| `FRONTEND_URL` | `https://your-app.vercel.app` | We'll update this after Vercel deploy |
| `OAUTH_REDIRECT_URI` | `https://mailxpert-backend.onrender.com/auth/callback` | Replace with YOUR service name |
| `MODEL_PATH` | `backend/ai_model/email_classification_model` | Path to your AI model |
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app,http://localhost:3000` | We'll update after Vercel deploy |

> 💡 **Tip**: For `OAUTH_REDIRECT_URI`, use the format: `https://YOUR-SERVICE-NAME.onrender.com/auth/callback`
> Your service name is what you entered in "Name" field above.

### 2.4 Deploy!

1. Click **Create Web Service**
2. Wait 5-10 minutes for the build to complete
3. Watch the logs - you should see:
   ```
   INFO:     Started server process
   INFO:     Uvicorn running on http://0.0.0.0:10000
   ```

### 2.5 Verify Backend is Live

1. Copy your Render URL from the top of the page (e.g., `https://mailxpert-backend.onrender.com`)
2. Open in browser: `https://your-backend.onrender.com/health`
3. You should see: `{"status":"ok"}`

> ⚠️ **First load may take 30-60 seconds** (cold start on free tier)

**📝 SAVE YOUR BACKEND URL** - You'll need it for frontend!

---

## Step 3: Deploy Frontend on Vercel

### 3.1 Create Vercel Account & Import Project

1. Go to [Vercel](https://vercel.com) and sign up/login with GitHub
2. Click **Add New** → **Project**
3. Find your repository: `Smart-Email-Classifier`
4. Click **Import**

### 3.2 Configure Build Settings

**Framework Preset**: Should auto-detect as `Create React App` ✅

**Root Directory**:
- Click **Edit** next to Root Directory
- Enter: `frontend`
- Click **Continue**

**Build Settings** (should auto-fill, but verify):
- Build Command: `npm run build` or `yarn build`
- Output Directory: `build`
- Install Command: `npm install` or `yarn install`

### 3.3 Add Environment Variables

Click **Environment Variables** and add these:

| Name | Value | Notes |
|------|-------|-------|
| `REACT_APP_API_URL` | `https://mailxpert-backend.onrender.com` | Your Render backend URL (NO trailing slash!) |
| `REACT_APP_GOOGLE_CLIENT_ID` | `your-actual-client-id.apps.googleusercontent.com` | Same as backend |

> ⚠️ **Critical**: `REACT_APP_API_URL` must NOT have a trailing slash!

### 3.4 Deploy!

1. Click **Deploy**
2. Wait 2-3 minutes for build to complete
3. You'll see 🎉 **Congratulations!** when done

### 3.5 Get Your Vercel URL

1. Click **Visit** or copy the URL shown (e.g., `https://smart-email-classifier.vercel.app`)
2. **📝 SAVE THIS URL** - You'll need it!

---

## Step 4: Update Google OAuth Settings

Now that you have both URLs, let's update Google OAuth to allow them.

### 4.1 Update OAuth Credentials

1. Go back to [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services** → **Credentials**
3. Click on your OAuth client (e.g., "MailXpert Web Client")
4. Edit **Authorized JavaScript origins**:
   - Remove the placeholder if any
   - Add: `https://your-app.vercel.app` (your actual Vercel URL)
   - Keep: `http://localhost:3000` (for local dev)
5. Edit **Authorized redirect URIs**:
   - Add: `https://your-backend.onrender.com/auth/callback` (your actual Render URL)
   - Keep: `http://localhost:8000/auth/callback` (for local dev)
6. Click **Save**

### 4.2 Update OAuth Consent Screen

1. **OAuth consent screen** in sidebar
2. Click **Edit App**
3. Update **App domain** URLs with your actual Vercel URL:
   - Application home page: `https://your-app.vercel.app`
   - Privacy policy: `https://your-app.vercel.app/privacy.html`
   - Terms of service: `https://your-app.vercel.app/terms.html`
4. Click **Save and Continue** through all steps

### 4.3 Update Backend Environment Variables

1. Go back to your Render dashboard
2. Click on your backend service
3. Go to **Environment** tab
4. Update these variables with your actual Vercel URL:
   - `FRONTEND_URL` → `https://your-app.vercel.app`
   - `ALLOWED_ORIGINS` → `https://your-app.vercel.app,http://localhost:3000`
5. Click **Save Changes**
6. Render will automatically redeploy (wait ~2 minutes)

---

## Step 5: Test Everything

### 5.1 Test Backend Health

1. Open: `https://your-backend.onrender.com/health`
2. Should see: `{"status":"ok"}`
3. If you see "Service Unavailable", wait 30-60 seconds (cold start)

### 5.2 Test Frontend

1. Open your Vercel URL: `https://your-app.vercel.app`
2. You should see the MailXpert landing page with:
   - ✅ Beautiful gradient background
   - ✅ Backend status banner (may show "warming up" for 30-60s on first load)
   - ✅ "Sign in with Google" button

### 5.3 Test OAuth Login Flow

1. Click **Sign in with Google**
2. Google consent screen appears
3. Select your test account
4. Approve the permissions (email, profile, Gmail readonly)
5. You should be redirected to `/dashboard` on your Vercel site
6. Your profile picture/name should appear in the top right

### 5.4 Test Email Classification

1. In the Dashboard, click **Fetch & Classify Emails**
2. Backend will fetch your recent Gmail messages
3. AI model classifies each email
4. You should see cards with:
   - ✅ Sender name/email
   - ✅ Subject
   - ✅ Date
   - ✅ Category badges (e.g., "Work", "Personal")

🎉 **Congratulations! Your app is live!**

---

## Troubleshooting

### Backend Issues

#### ❌ "Service Unavailable" or 502 Error
**Cause**: Cold start on free tier (server was sleeping)
**Solution**: Wait 30-60 seconds and refresh. The backend status banner will show when it's ready.

#### ❌ "ModuleNotFoundError: No module named 'ai_model'"
**Cause**: Wrong start command or missing model files
**Solution**: 
- Verify start command is exactly: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
- Ensure `backend/ai_model` folder exists in your repo
- Check Render logs for exact error

#### ❌ "Model not loaded" error
**Cause**: Incorrect `MODEL_PATH` or missing model files
**Solution**:
- Set `MODEL_PATH=backend/ai_model/email_classification_model`
- Ensure the model folder has these files: `config.json`, `model.safetensors`, `tokenizer.json`, etc.

### Frontend Issues

#### ❌ CORS Error in Browser Console
**Cause**: Backend `ALLOWED_ORIGINS` doesn't include your Vercel URL
**Solution**:
- Update `ALLOWED_ORIGINS` in Render environment variables
- Add your exact Vercel URL (with https://)
- Save and wait for Render to redeploy

#### ❌ "Network Error" when fetching emails
**Cause**: Wrong `REACT_APP_API_URL` or backend is down
**Solution**:
- Verify `REACT_APP_API_URL` in Vercel environment variables
- Must be: `https://your-backend.onrender.com` (no trailing slash!)
- Check backend health endpoint first

#### ❌ Backend status banner stuck on "warming up"
**Cause**: Backend not responding to /health checks
**Solution**:
- Check Render logs for errors
- Verify backend URL is correct
- Try opening backend health endpoint in new tab

### OAuth Issues

#### ❌ "redirect_uri_mismatch" error
**Cause**: Redirect URI doesn't match Google OAuth settings
**Solution**:
- Go to Google Cloud Console → Credentials
- Verify **Authorized redirect URIs** includes: `https://your-backend.onrender.com/auth/callback`
- Must match EXACTLY (check for extra slashes, http vs https)

#### ❌ "Access blocked: This app's request is invalid"
**Cause**: Scopes or OAuth setup incomplete
**Solution**:
- Ensure all 4 scopes are added (openid, email, profile, gmail.readonly)
- Verify app is published or you're added as a test user
- Check OAuth consent screen is filled out completely

#### ❌ "401 Unauthorized" when fetching emails
**Cause**: Token expired or invalid
**Solution**:
- Log out and log back in
- Clear browser cookies for your site
- Check that `GOOGLE_CLIENT_ID` matches in both frontend and backend

---

## Local Development Setup

Want to run everything locally before deploying? Here's how:

### Backend (Local)

1. **Navigate to backend**:
   ```powershell
   cd "d:\Mark 2\backend"
   ```

2. **Create virtual environment** (first time only):
   ```powershell
   python -m venv venv
   ```

3. **Activate virtual environment**:
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```

4. **Install dependencies**:
   ```powershell
   pip install -r requirements.txt
   ```

5. **Create `.env` file**:
   ```powershell
   cp .env.example .env
   ```
   
   Then edit `.env` and fill in:
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   FRONTEND_URL=http://localhost:3000
   OAUTH_REDIRECT_URI=http://localhost:8000/auth/callback
   MODEL_PATH=backend/ai_model/email_classification_model
   ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
   ```

6. **Run the backend**:
   ```powershell
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

7. **Verify**: Open http://localhost:8000/health
   - Should see: `{"status":"ok"}`

### Frontend (Local)

1. **Navigate to frontend**:
   ```powershell
   cd "d:\Mark 2\frontend"
   ```

2. **Install dependencies** (first time only):
   ```powershell
   npm install
   ```

3. **Create `.env` file**:
   ```powershell
   cp .env.example .env
   ```
   
   Then edit `.env` and fill in:
   ```env
   REACT_APP_API_URL=http://localhost:8000
   REACT_APP_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

4. **Run the frontend**:
   ```powershell
   npm start
   ```

5. **Open**: http://localhost:3000

### Local OAuth Setup

Make sure Google OAuth credentials include:
- **Authorized JavaScript origins**: `http://localhost:3000`
- **Authorized redirect URIs**: `http://localhost:8000/auth/callback`

---

## Performance Tips

### Backend Optimization

- **Free tier cold starts**: First request after 15 mins of inactivity takes 30-60s
  - Your landing page status banner handles this gracefully
  - Consider upgrading to paid tier ($7/month) for instant response
  
- **Keep backend warm**: 
  - Free tier spins down after 15 minutes of inactivity
  - You can use a service like [UptimeRobot](https://uptimerobot.com/) to ping `/health` every 5 minutes
  - Note: Render's free tier may still enforce spin-down policies

### Frontend Optimization

- Vercel free tier is very generous and fast
- Uses global CDN - your site loads quickly worldwide
- Automatic HTTPS and caching

---

## Security Best Practices

✅ **DO**:
- Keep `.env` files out of git (already in `.gitignore`)
- Rotate OAuth secrets if accidentally exposed
- Use environment variables for all secrets
- Keep dependencies updated (`pip list --outdated`, `npm outdated`)

❌ **DON'T**:
- Commit API keys or secrets to git
- Share your `.env` files
- Use the same secrets for dev and production

---

## Custom Domain (Optional)

### For Frontend (Vercel)

1. In Vercel project → **Settings** → **Domains**
2. Add your custom domain (e.g., `mailxpert.com`)
3. Follow Vercel's DNS instructions
4. Update Google OAuth origins to include your custom domain
5. Update backend `ALLOWED_ORIGINS` to include your custom domain

### For Backend (Render)

1. In Render service → **Settings** → **Custom Domain**
2. Add your domain (e.g., `api.mailxpert.com`)
3. Follow Render's DNS instructions
4. Update `OAUTH_REDIRECT_URI` to your custom domain
5. Update Google OAuth redirect URIs to include your custom domain

---

## Scaling & Production Checklist

When you're ready to scale:

- [ ] Upgrade Render to paid tier for better performance
- [ ] Enable Render auto-scaling
- [ ] Add monitoring (Sentry, LogRocket, etc.)
- [ ] Set up proper logging/analytics
- [ ] Configure rate limiting on backend
- [ ] Add backend caching (Redis)
- [ ] Submit OAuth app for verification (for >100 users)
- [ ] Add custom domain for professional branding
- [ ] Set up automated backups for data stores
- [ ] Configure CI/CD with GitHub Actions

---

## Need Help?

**Common Resources**:
- [Render Docs](https://render.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [Google OAuth Docs](https://developers.google.com/identity/protocols/oauth2)

**Found a bug?**
- Check the logs on Render (Logs tab)
- Check browser console for frontend errors
- Open an issue on GitHub

---

## Summary

You've successfully deployed MailXpert! 🎉

**Your architecture**:
- Frontend: Vercel (global CDN, auto HTTPS)
- Backend: Render (Python, FastAPI, AI model)
- Auth: Google OAuth 2.0
- Data: JSON stores on Render filesystem

**What's working**:
- ✅ OAuth login flow
- ✅ Email fetching from Gmail
- ✅ AI-powered classification
- ✅ Beautiful responsive UI
- ✅ Privacy & Terms pages
- ✅ Cold start UX with status banner

**Next steps**:
- Share with friends and get feedback
- Monitor usage and performance
- Consider custom domain
- Submit for OAuth verification when ready

Enjoy your deployed app! 🚀

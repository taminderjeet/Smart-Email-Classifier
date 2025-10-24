# Test Account Switching Feature
# This script helps you manually test the account switching functionality

Write-Host "=== Gmail AI Classifier - Account Switching Test ===" -ForegroundColor Cyan
Write-Host ""

# Check if backend is running
try {
    $health = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -ErrorAction Stop
    Write-Host "✓ Backend is running on http://localhost:8000" -ForegroundColor Green
} catch {
    Write-Host "✗ Backend is not running. Please start it first." -ForegroundColor Red
    Write-Host "  Run: cd 'd:\Mark 2\backend'; python -m uvicorn main:app --reload --port 8000" -ForegroundColor Yellow
    exit
}

# Check if frontend is running
try {
    $frontend = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -ErrorAction Stop -TimeoutSec 2
    Write-Host "✓ Frontend is running on http://localhost:3000" -ForegroundColor Green
} catch {
    Write-Host "✗ Frontend is not running. Please start it first." -ForegroundColor Red
    Write-Host "  Run: cd 'd:\Mark 2\frontend'; npm start" -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "=== Test Steps ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. First Login (Account A):" -ForegroundColor Yellow
Write-Host "   • Open http://localhost:3000/dashboard"
Write-Host "   • Click 'Connect Gmail Account'"
Write-Host "   • Login with your first Gmail account"
Write-Host "   • Wait for emails to be fetched and classified"
Write-Host "   • Note the email address shown"
Write-Host ""

Write-Host "2. Check Data Persistence:" -ForegroundColor Yellow
Write-Host "   • Refresh the page"
Write-Host "   • Verify emails are still visible (cached)"
Write-Host "   • Open Browser DevTools → Application → Local Storage"
Write-Host "   • Look for 'currentUserEmail' key"
Write-Host ""

Write-Host "3. Switch to Account B:" -ForegroundColor Yellow
Write-Host "   • Click 'Connect Gmail Account' again"
Write-Host "   • Login with a DIFFERENT Gmail account"
Write-Host "   • Watch the browser console (F12)"
Write-Host ""

Write-Host "4. Verify Auto-Clear:" -ForegroundColor Yellow
Write-Host "   • Check browser console for: 'New user detected, clearing previous user data...'"
Write-Host "   • Verify NO emails from Account A are visible"
Write-Host "   • Check Local Storage - 'currentUserEmail' should show new email"
Write-Host "   • Check backend logs for: 'User data cleared'"
Write-Host ""

Write-Host "5. Backend Verification:" -ForegroundColor Yellow
$backendFiles = @("processed_emails.json", "processed_ids.json")
Write-Host "   Checking backend files..."
foreach ($file in $backendFiles) {
    $path = "d:\Mark 2\backend\$file"
    if (Test-Path $path) {
        $content = Get-Content $path -Raw | ConvertFrom-Json
        $count = 0
        if ($content.emails) {
            $count = ($content.emails.PSObject.Properties).Count
        } elseif ($content.ids) {
            $count = $content.ids.Count
        }
        Write-Host "   • $file exists (items: $count)"
    } else {
        Write-Host "   • $file: not found (will be created on first fetch)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "=== Expected Results ===" -ForegroundColor Cyan
Write-Host "✓ Each user sees ONLY their own emails" -ForegroundColor Green
Write-Host "✓ No data leakage between accounts" -ForegroundColor Green
Write-Host "✓ All categories are from AI model (no 'General'/'Information')" -ForegroundColor Green
Write-Host "✓ Frontend and backend data cleared automatically" -ForegroundColor Green
Write-Host ""

Write-Host "=== Open Browser Now ===" -ForegroundColor Yellow
Write-Host "Frontend URL: " -NoNewline
Write-Host "http://localhost:3000/dashboard" -ForegroundColor Cyan
Write-Host ""

Write-Host "Press any key to exit this test guide..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

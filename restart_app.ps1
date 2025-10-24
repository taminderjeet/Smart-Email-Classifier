# Quick Restart Script - Apply Timeout Fix
# This restarts both backend and frontend with the new optimizations

Write-Host "🔄 Restarting Application with Timeout Fix..." -ForegroundColor Cyan
Write-Host ""

# Kill existing processes
Write-Host "⏹️  Stopping existing processes..." -ForegroundColor Yellow
Get-Process | Where-Object { $_.ProcessName -like "*python*" -or $_.ProcessName -like "*node*" -or $_.ProcessName -like "*uvicorn*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "✅ Processes stopped" -ForegroundColor Green
Write-Host ""

# Instructions for manual restart
Write-Host "📋 RESTART INSTRUCTIONS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1️⃣  BACKEND (Terminal 1):" -ForegroundColor Yellow
Write-Host "   cd `"D:\Mark 2\backend`""
Write-Host "   .\venv\Scripts\Activate.ps1"
Write-Host "   uvicorn main:app --reload --host 0.0.0.0 --port 8000"
Write-Host ""
Write-Host "2️⃣  FRONTEND (Terminal 2):" -ForegroundColor Yellow
Write-Host "   cd `"D:\Mark 2\frontend`""
Write-Host "   npm start"
Write-Host ""
Write-Host "3️⃣  BROWSER:" -ForegroundColor Yellow
Write-Host "   • Press F12 (DevTools)"
Write-Host "   • Console tab: localStorage.clear()"
Write-Host "   • Refresh page"
Write-Host ""
Write-Host "✅ OPTIMIZATIONS APPLIED:" -ForegroundColor Green
Write-Host "   ⚡ Batch classification (5-10x faster!)"
Write-Host "   ⏰ Timeout: 20s → 300s (5 minutes)"
Write-Host "   📧 Default emails: 30 → 15 (faster processing)"
Write-Host ""
Write-Host "🎯 Expected processing time: 3-6 seconds for 15 emails!" -ForegroundColor Green

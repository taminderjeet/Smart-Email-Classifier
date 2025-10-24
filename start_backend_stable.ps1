# Start Backend Server (Stable Mode - No Auto-Reload)
# Use this for stable operation without constant reloading

Write-Host "🚀 Starting Gmail AI Classifier Backend (Stable Mode)..." -ForegroundColor Cyan
Write-Host ""

# Kill any existing Python processes
Get-Process | Where-Object {$_.ProcessName -eq "python"} | ForEach-Object {
    Write-Host "Stopping existing Python process (PID: $($_.Id))..." -ForegroundColor Yellow
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 1

# Navigate to backend directory
Set-Location "d:\Mark 2\backend"

Write-Host "Starting Uvicorn server..." -ForegroundColor Green
Write-Host "Mode: Production (No auto-reload)" -ForegroundColor Gray
Write-Host "Port: 8000" -ForegroundColor Gray
Write-Host ""

# Start without reload for stable operation
python -m uvicorn main:app --host 0.0.0.0 --port 8000

# This will block until Ctrl+C is pressed

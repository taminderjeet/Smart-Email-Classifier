# Start Backend Server
# Quick script to start the FastAPI backend with AI model

Write-Host "🚀 Starting Gmail AI Classifier Backend..." -ForegroundColor Cyan

# Navigate to backend directory
Set-Location "d:\Mark 2\backend"

# Kill any existing Python processes (optional - comment out if you want to keep other Python processes)
# Get-Process | Where-Object {$_.ProcessName -eq "python"} | Stop-Process -Force -ErrorAction SilentlyContinue

# Start the backend server
Write-Host "Starting Uvicorn server on http://localhost:8000..." -ForegroundColor Green
Start-Process python -ArgumentList "-m", "uvicorn", "main:app", "--reload", "--port", "8000" -WindowStyle Normal

# Wait for server to start
Write-Host "Waiting for server to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# Check if server is running
try {
    $response = Invoke-WebRequest -Uri http://localhost:8000/health -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Backend is running successfully!" -ForegroundColor Green
        Write-Host "✓ Health check passed: $($response.Content)" -ForegroundColor Green
        Write-Host ""
        Write-Host "Backend URLs:" -ForegroundColor Cyan
        Write-Host "  - API: http://localhost:8000" -ForegroundColor White
        Write-Host "  - Docs: http://localhost:8000/docs" -ForegroundColor White
        Write-Host "  - Health: http://localhost:8000/health" -ForegroundColor White
        Write-Host ""
        Write-Host "Frontend should be running on:" -ForegroundColor Cyan
        Write-Host "  - http://localhost:3000" -ForegroundColor White
    }
} catch {
    Write-Host "✗ Backend failed to start or health check failed" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Try running manually:" -ForegroundColor Yellow
    Write-Host "  cd 'd:\Mark 2\backend'" -ForegroundColor White
    Write-Host "  python -m uvicorn main:app --reload --port 8000" -ForegroundColor White
}

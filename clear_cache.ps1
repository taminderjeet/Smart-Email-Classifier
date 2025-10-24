# Clear Backend Cache Script
# This script removes old cached emails with "General/Information" categories

Write-Host "🧹 Clearing Backend Cache..." -ForegroundColor Cyan

$backendPath = "D:\Mark 2\backend"
Set-Location $backendPath

# Delete cache files
$files = @("processed_emails.json", "processed_ids.json")
foreach ($file in $files) {
    if (Test-Path $file) {
        Remove-Item $file -Force
        Write-Host "✅ Deleted: $file" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Not found: $file" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✅ Backend cache cleared successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Clear browser localStorage (F12 > Console > localStorage.clear())"
Write-Host "2. Restart backend: uvicorn main:app --reload --host 0.0.0.0 --port 8000"
Write-Host "3. Login and click 'Fetch & Classify Gmail'"
Write-Host ""
Write-Host "🎯 All emails will be reclassified with your AI model!" -ForegroundColor Green

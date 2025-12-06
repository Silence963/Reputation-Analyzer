# REPA Setup Script
# Run this script to install all dependencies

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  REPA - Reputation Analytics Platform  " -ForegroundColor Cyan
Write-Host "          Installation Script            " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Install Backend Dependencies
Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
Set-Location -Path "backend"
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Backend dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Backend installation failed" -ForegroundColor Red
    exit 1
}
Set-Location -Path ".."

Write-Host ""

# Install Frontend Dependencies
Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location -Path "frontend"
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Frontend dependencies installed successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Frontend installation failed" -ForegroundColor Red
    exit 1
}
Set-Location -Path ".."

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Installation Complete!                " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run database migration to add user fields to kf_vendor:" -ForegroundColor White
Write-Host "   mysql -h 88.150.227.117 -u nrktrn_web_admin -p'GOeg&*$*657' nrkindex_trn < backend/migrations/001_create_repa_users.sql" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Start backend server:" -ForegroundColor White
Write-Host "   cd backend; npm start" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Start frontend (in new terminal):" -ForegroundColor White
Write-Host "   cd frontend; npm start" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Open browser:" -ForegroundColor White
Write-Host "   http://localhost:3000" -ForegroundColor Gray
Write-Host ""

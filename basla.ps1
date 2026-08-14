# sticker-platform başlatıcı — PowerShell 5.1 uyumlu
# Kullanım: powershell -ExecutionPolicy Bypass -File basla.ps1

Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node bulunamadı. https://nodejs.org üzerinden kur." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path node_modules)) {
    Write-Host "İlk kurulum: npm install..." -ForegroundColor Cyan
    npm install
    if ($LASTEXITCODE -ne 0) { Write-Host "npm install başarısız." -ForegroundColor Red; exit 1 }
}

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Write-Host "Not: ffmpeg yok — Telegram video sticker üretimi kapalı. Kurmak için: winget install ffmpeg" -ForegroundColor Yellow
}

Write-Host "Atölye: http://127.0.0.1:47411  ·  Mağaza: http://127.0.0.1:47411/magaza" -ForegroundColor Green
node sunucu.js

# POS SaaS — Arranque completo de desarrollo
# Abre Windows Terminal con pestanas para cada servicio.
#
# Uso: .\scripts\dev-start.ps1
#       .\scripts\dev-start.ps1 -Backend    (solo backend)
#       .\scripts\dev-start.ps1 -Web        (solo frontend web)
#       .\scripts\dev-start.ps1 -Mobile     (solo app mobile)

param(
    [switch]$Backend,
    [switch]$Web,
    [switch]$Mobile
)

$ErrorActionPreference = "Continue"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$posSaasPath = Join-Path $projectRoot "pos-saas"

$backendDir = Join-Path $posSaasPath "backend"
$webDir = Join-Path $posSaasPath "apps\web"
$mobileDir = Join-Path $posSaasPath "apps\mobile"

# Detectar pwsh.exe (PowerShell 7+)
$pwshExe = Get-Command pwsh.exe -ErrorAction SilentlyContinue
$shell = if ($pwshExe) { $pwshExe.Source } else { "powershell.exe" }

# Detectar Windows Terminal
$wtExe = Get-Command wt.exe -ErrorAction SilentlyContinue

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  POS SaaS — Arranque de Desarrollo" -ForegroundColor Cyan
Write-Host "  Shell: $(if ($pwshExe) {'PowerShell 7+'} else {'PowerShell 5.1'})" -ForegroundColor Gray
Write-Host "  Terminal: $(if ($wtExe) {'Windows Terminal'} else {'ventanas separadas'})" -ForegroundColor Gray
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Verificar pnpm
$pnpmCheck = cmd /c "pnpm --version 2>nul"
if (-not $pnpmCheck) {
    Write-Host "[ERROR] pnpm no esta instalado." -ForegroundColor Red
    exit 1
}

# Determinar servicios
$startBackend = $Backend -or (-not $Backend -and -not $Web -and -not $Mobile)
$startWeb = $Web -or (-not $Backend -and -not $Web -and -not $Mobile)
$startMobile = $Mobile -or (-not $Backend -and -not $Web -and -not $Mobile)

# Instalar dependencias si faltan
if ($startBackend -and -not (Test-Path (Join-Path $backendDir "node_modules"))) {
    Write-Host "[INSTALL] Backend..." -ForegroundColor Yellow
    cmd /c "cd /d `"$backendDir`" && pnpm install"
}
if ($startWeb -and -not (Test-Path (Join-Path $webDir "node_modules"))) {
    Write-Host "[INSTALL] Frontend Web..." -ForegroundColor Yellow
    cmd /c "cd /d `"$webDir`" && pnpm install"
}
if ($startMobile -and -not (Test-Path (Join-Path $mobileDir "node_modules"))) {
    Write-Host "[INSTALL] App Mobile..." -ForegroundColor Yellow
    cmd /c "cd /d `"$mobileDir`" && pnpm install"
}

Write-Host ""

# ============================================================
# MODO: Windows Terminal (cmd /s /c preserva comillas internas)
# ============================================================
if ($wtExe) {

    # Construir el command line como un solo string
    # cmd /s /c preserva las comillas que estan dentro del string
    # Asi que cotreamos cada path y cada -Command internamente

    $parts = @()

    # Pestana 1: Backend
    $parts += "-d `"$backendDir`" $shell -NoExit -ExecutionPolicy Bypass -Command `"pnpm run start:dev`""

    if ($startWeb) {
        $parts += "; new-tab -d `"$webDir`" $shell -NoExit -ExecutionPolicy Bypass -Command `"node node_modules/next/dist/bin/next dev`""
    }

    if ($startMobile) {
        $parts += "; new-tab -d `"$mobileDir`" $shell -NoExit -ExecutionPolicy Bypass -Command `"pnpm run start`""
    }

    $fullCmd = $parts -join " "

    Write-Host "[OK] Abriendo Windows Terminal..." -ForegroundColor Green

    # cmd /s /c: /s preserva comillas, /c ejecuta
    cmd /s /c "wt.exe $fullCmd"

} else {
    # ============================================================
    # MODO: Ventanas separadas (fallback)
    # ============================================================

    if ($startBackend) {
        $cmd = "Set-Location '$backendDir'; [Console]::Title = 'BACKEND ::3001'; pnpm run start:dev"
        Start-Process -FilePath $shell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $cmd
        Write-Host "[OK] Backend arrancando..." -ForegroundColor Green
    }
    if ($startWeb) {
        $cmd = "Set-Location '$webDir'; [Console]::Title = 'WEB ::3000'; node node_modules/next/dist/bin/next dev"
        Start-Process -FilePath $shell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $cmd
        Write-Host "[OK] Frontend Web arrancando..." -ForegroundColor Green
    }
    if ($startMobile) {
        $cmd = "Set-Location '$mobileDir'; [Console]::Title = 'MOBILE ::8081'; pnpm run start"
        Start-Process -FilePath $shell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $cmd
        Write-Host "[OK] App Mobile arrancando..." -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Servicios:" -ForegroundColor White
if ($startBackend) { Write-Host "    Backend:    http://localhost:3001" }
if ($startWeb)     { Write-Host "    Web:        http://localhost:3000" }
if ($startMobile)  { Write-Host "    Mobile:     Metro en :8081" }
Write-Host ""
Write-Host "  Detener:  .\scripts\dev-stop.ps1" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Cyan

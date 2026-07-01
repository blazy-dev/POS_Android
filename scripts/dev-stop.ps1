# POS SaaS — Detencion de desarrollo
# Mata los procesos que ocupan los puertos de los 3 servicios.
# Ejecutar desde la raiz del proyecto (POS_Android).
#
# Uso: .\scripts\dev-stop.ps1          (detiene todo)
#       .\scripts\dev-stop.ps1 -Web     (solo frontend web)
#       .\scripts\dev-stop.ps1 -Backend (solo backend)
#       .\scripts\dev-stop.ps1 -Mobile  (solo app mobile)

param(
    [switch]$Backend,
    [switch]$Web,
    [switch]$Mobile
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  POS SaaS — Detencion de Servicios" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

function Stop-PortService {
    param(
        [int]$Port,
        [string]$Name
    )
    $connections = netstat -ano 2>$null | Select-String ":$Port\s"
    if ($connections) {
        $pidsSeen = @{}
        foreach ($line in $connections) {
            if ($line.Line -match '(\d{1,5})\s*$') {
                $pid = $matches[1]
                if (-not $pidsSeen.ContainsKey($pid)) {
                    $pidsSeen[$pid] = $true
                    Write-Host "  Deteniendo $Name  (PID: $pid)..." -ForegroundColor Yellow
                    taskkill /PID $pid /F 2>$null | Out-Null
                }
            }
        }
    } else {
        Write-Host "  $Name no esta corriendo." -ForegroundColor Gray
    }
}

$stopAll = -not $Backend -and -not $Web -and -not $Mobile

if ($stopAll -or $Web)      { Stop-PortService -Port 3000 -Name "Frontend Web    :3000" }
if ($stopAll -or $Backend)  { Stop-PortService -Port 3001 -Name "Backend NestJS  :3001" }
if ($stopAll -or $Mobile)   { Stop-PortService -Port 8081 -Name "App Mobile Expo :8081" }

Write-Host ""
Write-Host "Listo." -ForegroundColor Green

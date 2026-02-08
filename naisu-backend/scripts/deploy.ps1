# =============================================================================
# Naisu Backend - VPS Deployment Script (PowerShell)
# =============================================================================

param(
    [Parameter(Position=0)]
    [ValidateSet("deploy", "deploy-slim", "stop", "logs", "status", "update", "backup", "help")]
    [string]$Command = "deploy"
)

# Colors
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Cyan"

# Script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir

function Write-Status { param($Message) Write-Host "➜ $Message" -ForegroundColor $Blue }
function Write-Success { param($Message) Write-Host "✓ $Message" -ForegroundColor $Green }
function Write-Error { param($Message) Write-Host "✗ $Message" -ForegroundColor $Red }
function Write-Warning { param($Message) Write-Host "⚠ $Message" -ForegroundColor $Yellow }

function Test-EnvFile {
    if (-not (Test-Path "$ProjectDir\.env")) {
        Write-Warning ".env file not found!"
        Write-Host "Creating from .env.example..."
        if (Test-Path "$ProjectDir\.env.example") {
            Copy-Item "$ProjectDir\.env.example" "$ProjectDir\.env"
            Write-Success ".env file created from example"
            Write-Warning "Please edit .env with your actual configuration before proceeding"
            exit 1
        } else {
            Write-Error ".env.example not found!"
            exit 1
        }
    }
    Write-Success ".env file found"
}

function Deploy-WithDb {
    Write-Status "Deploying with PostgreSQL database..."
    Set-Location $ProjectDir
    
    Write-Status "Pulling latest images..."
    docker-compose pull
    
    Write-Status "Building and starting services..."
    docker-compose up -d --build
    
    Write-Status "Waiting for database to be ready..."
    Start-Sleep -Seconds 5
    
    Write-Success "Deployment complete!"
    Write-Host ""
    Write-Host "Services:" -ForegroundColor $Green
    Write-Host "  - API: http://localhost:3000"
    Write-Host "  - Health: http://localhost:3000/api/v1/health"
    Write-Host "  - PostgreSQL: localhost:5432"
    Write-Host ""
}

function Deploy-WithoutDb {
    Write-Status "Deploying without database (lightweight mode)..."
    Set-Location $ProjectDir
    
    Write-Status "Building and starting services..."
    docker-compose -f docker-compose.no-db.yml up -d --build
    
    Write-Success "Deployment complete!"
    Write-Host ""
    Write-Host "Services:" -ForegroundColor $Green
    Write-Host "  - API: http://localhost:3000"
    Write-Host "  - Health: http://localhost:3000/api/v1/health"
    Write-Host ""
}

function Stop-Services {
    Write-Status "Stopping services..."
    Set-Location $ProjectDir
    docker-compose down
    docker-compose -f docker-compose.no-db.yml down 2>$null
    Write-Success "Services stopped"
}

function View-Logs {
    Write-Status "Viewing logs (Ctrl+C to exit)..."
    Set-Location $ProjectDir
    docker-compose logs -f api
}

function Show-Status {
    Write-Status "Service status:"
    Set-Location $ProjectDir
    docker-compose ps
}

function Update-Deployment {
    Write-Status "Updating deployment..."
    Set-Location $ProjectDir
    
    if (Test-Path ".git") {
        git pull origin main
    }
    
    docker-compose up -d --build
    Write-Success "Update complete!"
}

function Backup-Database {
    Write-Status "Creating database backup..."
    Set-Location $ProjectDir
    
    $BackupDir = "$ProjectDir\backups"
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
    
    $BackupFile = "$BackupDir\backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
    
    docker-compose exec -T postgres pg_dump -U naisu naisu_backend > $BackupFile
    
    Write-Success "Backup created: $BackupFile"
}

function Show-Help {
    Write-Host @"
Usage: .\deploy.ps1 [command]

Commands:
  deploy      Deploy with database (full stack)
  deploy-slim Deploy without database (lightweight)
  stop        Stop all services
  logs        View API logs
  status      Show service status
  update      Update and rebuild services
  backup      Backup PostgreSQL database
  help        Show this help message
"@
}

# Main
Write-Host "🚀 Naisu Backend Deployment Script" -ForegroundColor $Blue
Write-Host "================================================"

switch ($Command) {
    "deploy" {
        Test-EnvFile
        Deploy-WithDb
    }
    "deploy-slim" {
        Test-EnvFile
        Deploy-WithoutDb
    }
    "stop" { Stop-Services }
    "logs" { View-Logs }
    "status" { Show-Status }
    "update" {
        Test-EnvFile
        Update-Deployment
    }
    "backup" { Backup-Database }
    "help" { Show-Help }
    default { Show-Help }
}

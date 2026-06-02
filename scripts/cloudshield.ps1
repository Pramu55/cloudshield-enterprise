param(
  [Parameter(Position = 0)]
  [ValidateSet("start", "stop", "restart", "status")]
  [string]$Action = "status"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

function Show-Urls {
  Write-Host ""
  Write-Host "CloudShield local runtime"
  Write-Host "Frontend: http://localhost:3100"
  Write-Host "Backend:  http://localhost:4100"
  Write-Host "Postgres: localhost:55432"
  Write-Host "Redis:    localhost:6381"
  Write-Host ""
  Write-Host "Safety: AWS_CONNECTOR_MODE remains disabled by default. This command does not run AWS validation, AWS scanning, AWS mutation, automatic remediation, or Terraform apply."
}

function Start-CloudShield {
  Write-Host "Starting CloudShield local runtime..."
  docker compose up -d --build
  docker compose ps
  Show-Urls
}

function Stop-CloudShield {
  Write-Host "Stopping CloudShield local runtime..."
  docker compose down --remove-orphans
  docker compose ps
}

function Show-CloudShieldStatus {
  docker compose ps
  Show-Urls
}

switch ($Action) {
  "start" { Start-CloudShield }
  "stop" { Stop-CloudShield }
  "restart" {
    Stop-CloudShield
    Start-CloudShield
  }
  "status" { Show-CloudShieldStatus }
}

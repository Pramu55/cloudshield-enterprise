<#
.SYNOPSIS
Validates CloudShield query profiling.
.DESCRIPTION
This script safely profiles the query execution plan for the
`latestScansByAccount` and other complex analytical queries, returning
the query plan payload and preventing production secrets or data leak.
#>
$ErrorActionPreference = "Stop"

Write-Host "CloudShield Query Profiling Workflow" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

$DbUser = "cloudshield"
$MainDb = "cloudshield"

try {
    Write-Host "`n[1/1] Running query profile validation helper..."

    $ProdDbUrl = "postgresql://${DbUser}:cloudshield_local_password@localhost:55432/${MainDb}"
    $env:DATABASE_URL = $ProdDbUrl

    # Run helper script
    $Output = pnpm --filter @cloudshield/backend exec tsx src/scripts/profile-validation-helper.ts
    $ExitCode = $LASTEXITCODE

    if ($ExitCode -eq 0) {
        Write-Host "`nSuccess! Profiling payload:" -ForegroundColor Green
        Write-Host $Output
    } else {
        Write-Host "`nProfiling failed. Payload:" -ForegroundColor Red
        Write-Host $Output
        throw "Validation helper returned non-zero exit code."
    }

} catch {
    Write-Host "`n[ERROR] $_" -ForegroundColor Red
    exit 1
}

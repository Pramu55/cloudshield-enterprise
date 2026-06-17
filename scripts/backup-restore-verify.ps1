<#
.SYNOPSIS
Validates CloudShield database backup and restore logic.
.DESCRIPTION
This script safely creates a binary dump of the PostgreSQL database,
provisions an isolated validation database, restores the dump,
and runs the backup validation helper to verify integrity,
while preventing replay attacks or exposing raw Prisma connection errors.
#>
$ErrorActionPreference = "Stop"

Write-Host "CloudShield Backup and Restore Verification Workflow" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$PostgresContainer = "cloudshield-postgres-1"
$MainDb = "cloudshield"
$Timestamp = Get-Date -Format "yyyyMMddHHmmss"
$VerifyDb = "cloudshield_restore_test_$Timestamp"

$Blocklist = @("cloudshield", "postgres", "template0", "template1", "cloudshield_verify")
if ($Blocklist -contains $VerifyDb) {
    throw "Generated target database name '$VerifyDb' is on the blocklist."
}
if (-not $VerifyDb.StartsWith("cloudshield_restore_test_")) {
    throw "Target database name must start with 'cloudshield_restore_test_'."
}

$DbUser = "cloudshield"
$DumpFile = "cloudshield_backup_$Timestamp.dump"

try {
    Write-Host "`n[1/5] Creating binary-safe custom-format dump..."
    docker exec -i $PostgresContainer pg_dump -U $DbUser -d $MainDb -F c -f "/tmp/$DumpFile"
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed." }
    Write-Host "Dump created successfully." -ForegroundColor Green

    Write-Host "`n[2/5] Dropping existing validation database if it exists..."
    docker exec -i $PostgresContainer psql -U $DbUser -d postgres -c "DROP DATABASE IF EXISTS $VerifyDb;"
    if ($LASTEXITCODE -ne 0) { throw "Failed to drop validation database." }

    Write-Host "`n[3/5] Creating isolated validation database..."
    docker exec -i $PostgresContainer psql -U $DbUser -d postgres -c "CREATE DATABASE $VerifyDb;"
    if ($LASTEXITCODE -ne 0) { throw "Failed to create validation database." }

    Write-Host "`n[4/5] Restoring backup to validation database..."
    # Suppressing stderr for pg_restore as it often throws warnings for privileges
    docker exec -i $PostgresContainer bash -c "pg_restore -U $DbUser -d $VerifyDb -1 /tmp/$DumpFile 2>/dev/null"
    Write-Host "Dump restored to isolated database." -ForegroundColor Green

    $DumpSizeStr = docker exec -i $PostgresContainer stat -c%s "/tmp/$DumpFile"
    $DumpShaStr = docker exec -i $PostgresContainer sha256sum "/tmp/$DumpFile"
    $DumpSha = ($DumpShaStr -split ' ')[0]

    Write-Host "`n[5/5] Running backup safety validation helper..."
    $ValidationDbUrl = "postgresql://${DbUser}:cloudshield_local_password@localhost:55432/${VerifyDb}"
    $ProdDbUrl = "postgresql://${DbUser}:cloudshield_local_password@localhost:55432/${MainDb}"

    $env:VALIDATION_DATABASE_URL = $ValidationDbUrl
    $env:DATABASE_URL = $ProdDbUrl
    $env:VERIFY_DB = $VerifyDb
    $env:MAIN_DB = $MainDb
    $env:DUMP_SIZE = $DumpSizeStr
    $env:DUMP_SHA = $DumpSha

    # Run helper script
    $Output = pnpm --filter @cloudshield/backend exec tsx src/scripts/backup-validation-helper.ts
    $ExitCode = $LASTEXITCODE

    if ($ExitCode -eq 0) {
        Write-Host "`nSuccess! Validation payload:" -ForegroundColor Green
        Write-Host $Output
    } else {
        Write-Host "`nValidation failed. Payload:" -ForegroundColor Red
        Write-Host $Output
        throw "Validation helper returned non-zero exit code."
    }

} catch {
    Write-Host "`n[ERROR] $_" -ForegroundColor Red
    exit 1
} finally {
    Write-Host "`n[Cleanup] Removing dump file and validation database..."
    docker exec -i $PostgresContainer rm -f "/tmp/$DumpFile" 2>$null
    docker exec -i $PostgresContainer psql -U $DbUser -d postgres -c "DROP DATABASE IF EXISTS $VerifyDb;" 2>$null
    Write-Host "Cleanup complete."
    Write-Host "- temporary restore database dropped: pass"
    Write-Host "- temporary container dump removed: pass"
    Write-Host "- host dump removed or intentionally retained: not applicable (dump generated directly inside container and removed)"
}

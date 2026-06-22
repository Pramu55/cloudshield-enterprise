# Database Backup And Restore

Status: Automated validation implemented via isolated tests.

Do not commit backup files. Treat database dumps as sensitive.

## Backup Workflow

The `scripts\backup-restore-verify.ps1` script fully automates a safe backup validation process without risking production data.

```powershell
.\scripts\backup-restore-verify.ps1
```

The script performs the following isolated workflow:
1.  **Binary-Safe Export**: Uses `pg_dump -Fc` for a reliable binary dump preserving exact schema and extensions.
2.  **Isolated Verification Provisioning**: Safely provisions a unique temporary sandbox database beginning with the prefix `cloudshield_restore_test_` (specifically, `cloudshield_restore_test_<timestamp>`), dropping any stale instances first.
    *   `cloudshield_verify` is rejected as an obsolete/unsafe fixed target.
    *   Existing targets are not silently reused.
    *   The active source database cannot be selected (protected by validation blocklist and isolation policies).
3.  **Strict Restoration**: Restores the binary payload via `pg_restore` targeting the isolated database.
4.  **No-Replay Validation**: Automatically runs `pnpm --filter @cloudshield/backend exec tsx src/scripts/backup-validation-helper.ts` configured with strict isolation arguments to verify metric counts (Organizations, Scans, Users) without risking unintended replays against the source database. Raw Prisma stack traces or errors are safely abstracted away.
5.  **Clean Up**: The binary dump and isolated database are safely dropped.

## Manual Execution Example

**1. Create Backup**
```bash
docker exec -i cloudshield-postgres-1 pg_dump -U cloudshield -d cloudshield -F c -f /tmp/backup.dump
```

**2. Provision Isolated Database**
```bash
docker exec -i cloudshield-postgres-1 psql -U cloudshield -d postgres -c "CREATE DATABASE cloudshield_restore_test_manual;"
```

**3. Restore Data**
```bash
docker exec -i cloudshield-postgres-1 bash -c "pg_restore -U cloudshield -d cloudshield_restore_test_manual -1 /tmp/backup.dump 2>/dev/null"
```

**4. Validate Backup Integrity**
```powershell
$env:VALIDATION_DATABASE_URL="postgresql://cloudshield:<pwd>@localhost:55432/cloudshield_restore_test_manual"
$env:DATABASE_URL="postgresql://cloudshield:<pwd>@localhost:55432/cloudshield"
pnpm --filter @cloudshield/backend exec tsx src/scripts/backup-validation-helper.ts
```

## Security Considerations
*   The `backup-validation-helper.ts` script strictly prevents connecting to the database provided in `$DATABASE_URL` (production database) when running validation. It fails closed to enforce the strict no-replay requirement.
*   `cloudshield_verify` is rejected as an obsolete/unsafe fixed target by both the backup-validation helper and script wrappers.
*   The temporary target database is dropped automatically after verification completes.

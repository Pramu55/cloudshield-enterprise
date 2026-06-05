# Database Backup And Restore

Status: procedure documented; actual restore validation pending a sandbox database.

Do not commit backup files. Treat database dumps as sensitive.

## Backup

```powershell
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
docker compose exec -T postgres pg_dump -U cloudshield -d cloudshield -Fc > "C:\tmp\cloudshield-$timestamp.dump"
```

Record:

- timestamp
- source environment
- database name
- operator
- checksum
- retention date

## Restore Test

Restore into an isolated test database, never over the original pilot database:

```powershell
docker compose exec -T postgres createdb -U cloudshield cloudshield_restore_test
Get-Content "C:\tmp\cloudshield-<timestamp>.dump" -Raw | docker compose exec -T postgres pg_restore -U cloudshield -d cloudshield_restore_test --clean --if-exists
```

Verify critical records:

- organizations
- users
- AWS accounts
- resources
- scan runs
- findings
- remediation plans
- approvals
- operations
- audit events

This branch does not claim backup readiness because no real restore test has been authorized or run.

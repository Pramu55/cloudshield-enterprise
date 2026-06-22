# Query Profiling Guide

This guide outlines the query profiling strategies implemented to ensure reliable, performant database operations within CloudShield, particularly emphasizing the safe handling of cross-tenant and complex historical queries.

## Performance Requirements

- **Index Saturation**: Every multi-tenant query MUST explicitly filter on `organizationId` matching an active B-Tree index, effectively mitigating large table scans.
- **Bounded Queries**: Queries must be naturally bounded (such as retrieving latest-per-account records, which is inherently bounded by the tenant's registered AWS accounts) or enforce explicit row limits to prevent accidental resource exhaustion from unconstrained sets. The production `latestScansByAccount` query has no global limit to avoid omitting accounts.
- **Stable Plans**: Complex latest-record retrieval (e.g., getting the latest scan per AWS account) uses `SELECT DISTINCT ON` rather than Prisma aggregation post-processing to ensure stability and rely exclusively on Postgres `Incremental Sort` + `Index Scan` efficiency.
- **Data Isolation**: Profiling output must never expose raw credentials or actual database row content.

## Automated Profiling Workflow

The automated query profiling workflow validates the execution plan of critical bounded queries (such as the latest scan per account query) via a safe test helper.

```powershell
.\scripts\profile-queries.ps1
```

### Execution Steps
1. The script initializes the backend validation helper (`apps/backend/src/scripts/profile-validation-helper.ts`).
2. Using Prisma's `$queryRaw`, the helper runs `EXPLAIN (ANALYZE, FORMAT JSON)` on the target query.
3. The helper traps and sanitizes raw database stack traces and errors.
4. The helper returns a sanitized JSON execution plan detailing query cost, actual execution time, and exact execution nodes utilized (e.g., `Index Scan`, `Incremental Sort`).

### Expected Success Output

A successful validation prints the profiling payload and returns exit code 0:

```json
{
  "status": "success",
  "queryPlan": [
    {
      "QUERY PLAN": [
        {
          "Plan": {
            "Node Type": "Unique",
            "Parallel Aware": false,
            "Startup Cost": 0.01,
            "Total Cost": 0.02,
            ...
            "Plans": [
              {
                "Node Type": "Incremental Sort",
                ...
                "Plans": [
                  {
                    "Node Type": "Index Scan",
                    "Index Name": "ScanRun_organizationId_awsAccountId_idx",
                    ...
                  }
                ]
              }
            ]
          },
          "Execution Time": 0.101
        }
      ]
    }
  ]
}
```

## Security Considerations

- `profile-validation-helper.ts` strictly prevents returning query row contents; it purely returns the EXPLAIN AST.
- Raw Prisma errors resulting from connection failure are safely masked as generic internal errors.
- **No Production Cap**: The production query does not contain a `LIMIT 100` clause. The profiling tool evaluates the identical SQL structure to verify accurate index execution without skewing semantics.

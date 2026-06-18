# CloudShield CI Validation Foundation

## Workflow Purpose
The CI Validation Foundation ensures that every pull request and manual validation trigger adheres to CloudShield's stringent security, typing, and architectural boundaries. It prevents regressions by compiling all workspaces sequentially and running all integration tests in an isolated, safe GitHub Actions runner.

**Note:** The CI implementation is currently `CI_IMPLEMENTATION_READY_FOR_REVIEW_NOT_YET_RUNTIME_VALIDATED`. It is not considered fully runtime-validated until its first successful run on GitHub Actions. Branch protection rules are recommended *only* after successful workflow validation.

## Triggers
- **Pull Requests**: Runs on any PR targeting `feat/real-aws-live-sandbox-operations`.
- **Workflow Dispatch**: Allows manual validation trigger to assert trunk health on demand.

## Service Containers
The pipeline runs two local service containers attached natively to the GitHub Actions Ubuntu runner network:
1. **PostgreSQL 16**: Exposed on `localhost:5432` with a `pg_isready` health check.
2. **Redis 7**: Exposed on `localhost:6379` with a `redis-cli ping` health check.

## Safe CI Environment
The pipeline injects a deterministic `env` context to ensure safe test runs:
- `DATABASE_URL` / `TEST_DATABASE_URL`: Set to the local Postgres container (`cloudshield_test`).
- `REDIS_URL`: Set to the local Redis container.
- `ALLOW_INTEGRATION_TEST_DATABASE=true`: Bypasses safety locks forbidding DB mutation during tests.
- `DISABLE_QUEUE_CONNECTIONS_FOR_TESTS=true`: Enforces the backend's mocked BullMQ layer.

**Note:** `NODE_ENV` is intentionally scoped by step (e.g., `test` for backend/worker tests, and `production` for frontend build/assertions) rather than globally, to ensure accurate validation modes. No AWS credentials, secrets, or deployment payloads are exposed to this CI context, guaranteeing that a rogue PR cannot compromise real infrastructure.

## Exact Validation Order
The CI jobs run in this strict sequence:
1. Checkout repository (`fetch-depth: 0` for PRs) & setup Node 22 (LTS).
2. Enable Corepack and activate `pnpm@9.15.4`.
3. `pnpm install --frozen-lockfile`.
4. Verify lockfile safety via `git diff --exit-code`.
5. `prisma:generate` and `prisma:deploy`.
6. `contracts` typecheck and build.
7. `security` typecheck and build.
8. `database` typecheck and build.
9. `backend` typecheck, build, and tests.
10. `worker` typecheck, build, and tests.
11. `frontend` typecheck and build.
12. Frontend `assert-response-contracts.mjs`.
13. Frontend `assert-security-headers.mjs`.
14. Base branch whitespace check.
15. Added-lines unsafe TypeScript scan (for PRs only, strictly on code files).
16. Secret-file safety scan (for PR newly tracked files).
17. Overall repository cleanliness check via `git status --porcelain`.

## Expected Test Totals
Current expectations (not hard-coded invariants):
- **Backend**: ~270 passed tests.
- **Worker**: ~105 passed tests.
- **Frontend**: Successfully generates 22 static/dynamic pages.

## Why Backend and Worker Tests are Sequential
Both the `@cloudshield/backend` and `@cloudshield/worker` workspaces rely on the `cloudshield_test` database. Running their test suites in parallel would result in race conditions and deadlocks within the Prisma engine. Sequential execution maintains authoritative determinism.

## Why No AWS Credentials Exist
This phase of CI validates code correctness and local integration. True deployment and AWS mutation validation are performed only after CI is green, via isolated protected environments. No AWS values are injected here to adhere to the principle of least privilege.

## Deployment Policy
Deployment is intentionally outside this workflow. A future, separately reviewed and authenticated deployment pipeline will be required after CI, staging architecture, and release controls are approved.

## Why No Artifacts Are Uploaded
The runner executes tests against ephemeral data and tears down instantly. `.env` files, DB dumps, and cache artifacts are explicitly not uploaded to prevent any accidental leakage of infrastructure details or session states.

## Why Caching is Currently Deferred
`pnpm` caching (`actions/setup-node@v4` with `cache: pnpm`) is deferred and removed from the first milestone for reliability, as `corepack` enablement happens in a subsequent step. Remote Turborepo caching is completely disabled to prevent "cache poisoning" from untrusted PRs. All validations rebuild strictly from the localized storage within the runner instance.

## Known Limitations
### Duplicate Frontend Build
The custom assertions (`assert-response-contracts.mjs` and `assert-security-headers.mjs`) internally invoke `execSync("pnpm build")`. Because Turborepo natively triggers the frontend build before this step, the frontend may build twice. This is an accepted Phase 1 limitation to guarantee artifact freshness for assertions without rewriting existing application scripts.

## Rerunning the Pipeline
- If tests fail unexpectedly, ensure you rebase your PR onto `feat/real-aws-live-sandbox-operations`.
- You can manually rerun this validation via the "Actions" tab by selecting "CI Validation Foundation" and clicking **Run workflow**.

## Interpreting Failures
- **Unsafe TypeScript Detected**: Ensure no `any`, `@ts-ignore`, or `as unknown as` assertions were added in the PR diff.
- **Unexpected Tracked Files**: You committed a `.env`, key file, or the build modified a file that isn't `gitignore`d.

## History
- The first GitHub Actions runtime run exposed and corrected an undeclared direct package dependency (`zod`) within the `@cloudshield/database` workspace, validating the strict isolation of the CI environment.
- The second runtime CI run exposed that `@cloudshield/security-monitoring` used a dist-only types entry and was omitted from the workflow validation sequence. The correction aligned its types entry with workspace source resolution and added security-monitoring validation before backend validation.

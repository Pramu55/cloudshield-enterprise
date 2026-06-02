# Local Release Checklist

Before tagging a local release of CloudShield Enterprise, run through this checklist to ensure stability, safety, and demo-readiness.

## 1. Codebase Cleanliness
- [ ] `git status` is clean.
- [ ] No temporary/scratch validation files exist in the tree.
- [ ] No temporary helper scripts are committed.

## 2. Build & Typecheck
Run the following to ensure compilation and type safety:
- [ ] `pnpm install`
- [ ] `pnpm --filter @cloudshield/contracts build`
- [ ] `pnpm --filter @cloudshield/database prisma:generate`
- [ ] `pnpm --filter @cloudshield/database typecheck`
- [ ] `pnpm --filter @cloudshield/backend typecheck`
- [ ] `pnpm --filter @cloudshield/worker typecheck`
- [ ] `pnpm --filter @cloudshield/frontend typecheck`
- [ ] `pnpm --filter @cloudshield/frontend build`

## 3. Docker Runtime Checks
Ensure the containerized environment boots cleanly.
- [ ] `pnpm cloudshield start` (or `docker compose up -d`)
- [ ] `docker compose ps` shows `postgres`, `redis`, `backend`, `frontend`, and `worker` as Up/Healthy.

## 4. API Health & Login Validation
- [ ] `GET http://localhost:4100/health` returns 200 OK.
- [ ] `POST /api/v1/auth/login` successfully returns a bearer token for `demo@cloudshield.local`.

## 5. Route Checks (with Bearer Token)
All routes must return 200 OK without executing AWS calls.
- [ ] `GET /api/v1/auth/me`
- [ ] `GET /api/v1/platform/status`
- [ ] `GET /api/v1/dashboard/summary`
- [ ] `GET /api/v1/aws/connector/status`
- [ ] `GET /api/v1/aws/inventory/plan`
- [ ] `GET /api/v1/security/findings`
- [ ] `GET /api/v1/risk/findings`
- [ ] `GET /api/v1/compliance/evidence-center`
- [ ] `GET /api/v1/reports/summary`
- [ ] `GET /api/v1/recommendations`

## 6. Dashboard & Frontend Checks
Visit `http://localhost:3100/dashboard` and verify:
- [ ] The dashboard loads without runtime crashes.
- [ ] The executive demo-freeze header is visible.
- [ ] The sample/demo data labels are clearly visible.
- [ ] Sidebar navigation works across all pages (Accounts, Inventory, Security, Compliance, Reports, Scans).

## 7. Safety Scan Checks
Ensure no risky code or data has been introduced.
- [ ] **No Secrets**: No `.env` files, AWS credentials, API tokens, or database URLs are committed.
- [ ] **No False Claims**: No claims of real client deployment, Accenture customers, or official CIS/SOC2 certification.
- [ ] **No AWS Execution**: No AWS scanner runs, list API calls, or mutation APIs.
- [ ] **No Remediation**: No automatic remediation or Terraform apply logic is present.

## 8. Screenshot & Media Check
- [ ] All screenshots outlined in `docs/SCREENSHOT_CHECKLIST.md` are captured and safely stored without revealing local secrets.

## 9. Final Git Tag
- [ ] Create git tag (e.g., `v1.0.0-demo-freeze`).
- [ ] Push to repository.

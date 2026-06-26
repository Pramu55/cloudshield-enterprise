# Local Release Checklist

Use this checklist before committing, tagging, or presenting the current
CloudShield read-only AWS governance release candidate.

Release classification:

`CLOUDSHIELD_READONLY_AWS_GOVERNANCE_RELEASE_CANDIDATE_v0.6.0`

This release includes real read-only Track 2 AWS STS validation and a narrow
read-only EC2/VPC inventory proof. It does not claim production deployment,
formal audit certification, SLA, disaster-recovery proof, autonomous
remediation, Terraform apply, or broad AWS service coverage.

## 1. Repository State

- [ ] The intended branch and commit are verified.
- [ ] `git status` is clean after the release commit.
- [ ] `git diff --check` passes.
- [ ] No unresolved merge markers, temporary files, secrets, or unexpected artifacts exist.

## 2. Database

- [ ] `pnpm --filter @cloudshield/database exec prisma migrate status` reports 28 migrations and an up-to-date schema.
- [ ] `pnpm --filter @cloudshield/database exec prisma validate` passes.
- [ ] No migration was deleted, rewritten, or replaced.

## 3. Build And Test Validation

- [ ] `pnpm --filter @cloudshield/contracts build`
- [ ] `pnpm --filter @cloudshield/database typecheck`
- [ ] `pnpm --filter @cloudshield/backend typecheck`
- [ ] `pnpm --filter @cloudshield/worker typecheck`
- [ ] `pnpm --filter @cloudshield/frontend typecheck`
- [ ] `pnpm --filter @cloudshield/backend test` passes 330/330 tests.
- [ ] `pnpm --filter @cloudshield/worker test` passes 110/110 tests.
- [ ] `pnpm --filter @cloudshield/frontend build` generates 23 routes.
- [ ] `node apps/frontend/scripts/assert-response-contracts.mjs` passes.
- [ ] `node apps/frontend/scripts/assert-security-headers.mjs` passes after the frontend build.

## 4. Runtime Health

- [ ] `docker compose -p cloudshield-frontend ps` shows Postgres and Redis healthy, backend healthy, and frontend and worker running.
- [ ] `GET http://localhost:4100/health` returns HTTP 200 with `status=ok`.
- [ ] `GET http://localhost:4100/ready` returns HTTP 200 with `status=ready`.
- [ ] `GET http://localhost:3100/` returns HTTP 200.
- [ ] An unauthenticated request to `/dashboard` returns 307 to `/login`.

## 5. Browser Authentication

CloudShield uses an HTTP-only session cookie, CSRF cookie/header protection for mutations, and origin validation. It does not return a browser bearer token.

- [ ] Login succeeds through `/login` using the demo account.
- [ ] `/api/v1/auth/me` succeeds with the authenticated session cookie.
- [ ] Mutative browser requests include the CSRF header and matching cookie.
- [ ] Logout expires the session cookie.

## 6. Product Routes

- [ ] `/dashboard`
- [ ] `/dashboard/accounts`
- [ ] `/dashboard/inventory`
- [ ] `/dashboard/security`
- [ ] `/dashboard/monitoring`
- [ ] `/dashboard/compliance`
- [ ] `/dashboard/risk-acceptances`
- [ ] `/dashboard/reports`
- [ ] `/dashboard/settings`

Verify sample provenance, unavailable-score states, capability-aware actions, and readable evidence history.

## 7. AWS Safety

- [ ] For base `docker-compose.yml` local runtime, `AWS_CONNECTOR_MODE=disabled`.
- [ ] For AWS-readonly release validation runtime, `AWS_CONNECTOR_MODE=sts-validation`.
- [ ] `AWS_INVENTORY_SCANNER_MODE=disabled`.
- [ ] `AWS_CHANGE_EXECUTION_MODE=disabled`.
- [ ] Executor role is not configured.
- [ ] No STS validation is rerun during release validation.
- [ ] No inventory sync is rerun during release validation.
- [ ] No AWS mutation is performed during release validation.
- [ ] No External ID, temporary credential, or raw provider payload is returned by an API.
- [ ] Governed mutation-capable code remains disabled and approval-gated.
- [ ] Automatic remediation and Terraform apply remain unavailable.

## 8. Platform Reliability Proof

- [ ] Inventory worker lifecycle audit events are documented.
- [ ] `GET /api/v1/platform/operational-proof` is documented as DB-only,
      auth-required, tenant-scoped, and safe.
- [ ] Operational proof response contains safe counts/booleans/labels only.
- [ ] Operational proof does not call AWS, Redis, Docker, BullMQ, inventory sync,
      remediation, mutation, Terraform, or external services.
- [ ] Base `docker-compose.yml` runtime: `pnpm.cmd local:preflight` returns
      `Preflight status: GREEN`.
- [ ] AWS-readonly release validation runtime:
      `pnpm.cmd production:preflight` returns `Preflight status: GREEN`.

## 9. June 30 AWS Free-Tier Closeout

- [ ] Review `docs/FINAL_PLATFORM_RELEASE_PACKAGE_AND_FREE_TIER_CLOSEOUT.md`.
- [ ] Check AWS Billing dashboard manually before June 30.
- [ ] Check AWS Free Tier usage manually before June 30.
- [ ] Check active EC2, VPC, EBS, S3, IAM, and region-specific resources
      manually before June 30.
- [ ] Verify no running chargeable resources remain.
- [ ] Remove temporary AWS access keys after preserving safe proof screenshots.
- [ ] Keep screenshots/evidence before cleanup.
- [ ] Do not delete CloudShield local Docker volumes.
- [ ] Do not run `docker compose down -v`.
- [ ] Do not run Prisma reset or migration reset.
- [ ] Do not perform AWS cleanup from this repository release task.

## 10. Release

- [ ] CI passes for the release PR into `main`.
- [ ] Release notes and known limitations remain accurate.
- [ ] README no longer contains stale v0.5 unverified language.
- [ ] Docs do not claim real customers, production deployment, SOC 2, ISO 27001,
      CIS certification, autonomous remediation, or Terraform apply.
- [ ] Create and push the release tag only after the merge commit and final approval.

# Local Release Checklist

Use this checklist before committing or tagging CloudShield v0.5.0.

Release classification:

`CLOUDSHIELD_AWS_UNVERIFIED_RELEASE_CANDIDATE_v0.5.0`

This release does not claim real AWS validation, production deployment, formal audit, SLA, or disaster-recovery proof.

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

- [ ] `AWS_CONNECTOR_MODE`, `AWS_INVENTORY_SCANNER_MODE`, and `AWS_CHANGE_EXECUTION_MODE` default to `disabled`.
- [ ] No real AWS validation or mutation is performed during release validation.
- [ ] No External ID, temporary credential, or raw provider payload is returned by an API.
- [ ] Governed mutation-capable code remains disabled and approval-gated.
- [ ] Automatic remediation and Terraform apply remain unavailable.

## 8. Release

- [ ] CI passes for the release PR into `main`.
- [ ] Release notes and known limitations remain accurate.
- [ ] Create and push the release tag only after the merge commit and final approval.

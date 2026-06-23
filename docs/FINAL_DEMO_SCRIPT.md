# Final CloudShield Demo Script

Audience: recruiters, interviewers, engineering reviewers, or portfolio viewers.

Goal: show CloudShield as a serious cloud governance platform while keeping the
safety story crisp: real AWS proof was read-only, sandboxed, and locked down
after validation.

## 0. Pre-Demo Safety Check

Before screen sharing, run:

```powershell
pnpm.cmd production:preflight
```

Talking point:

> I start with the safety proof. This preflight checks the local backend,
> readiness, frontend, and sanitized runtime guardrails. It does not call AWS,
> trigger inventory, run remediation, mutate cloud resources, or print secrets.

Expected result: `Preflight status: GREEN`.

## 1. Opening

Open `http://localhost:3100`.

Script:

> CloudShield is an AWS security posture, compliance evidence, and governance
> workflow platform. The key engineering challenge was to prove real cloud value
> without creating cloud risk. This demo includes a real read-only AWS sandbox
> validation path, but the runtime is now locked: inventory is disabled,
> execution is disabled, and no executor role is configured.

Boundaries to state early:

- No production customer deployment is claimed.
- AWS usage was sandboxed and read-only.
- Compliance language is CIS-inspired and SOC2-inspired, not official
  certification.
- Remediation and Terraform apply are intentionally disabled.

## 2. Login

Open `http://localhost:3100/login` and sign in with the local demo account.

Script:

> The console uses authenticated, tenant-scoped access. Mutating requests use
> CSRF protection, and settings do not accept or expose runtime secrets.

## 3. Executive Dashboard

Open `/dashboard`.

Show:

- account posture summary;
- security score;
- evidence and compliance posture;
- safety/status panels;
- separation between real AWS_SYNC and sample/demo data.

Script:

> The executive view turns technical inventory and findings into governance
> posture. For the real Track 2 sandbox, CloudShield calculated an 88/100 account
> security score and a 72/100 executive governance score from stored evidence.
> These are internal governance scores, not official compliance certifications.

## 4. Accounts Page

Open `/dashboard/accounts`.

Script:

> This is the AWS account registry. The Track 2 Sandbox account is the real
> read-only validation target. The registry stores governance metadata and role
> placeholders; it does not store AWS secret keys or External ID values.

Point out:

- Track 2 Sandbox account.
- AWS account ID `745055721647`.
- Region `ap-south-1`.
- Connection status `VALIDATION_SUCCEEDED`.
- Scanner mode locked back to disabled after proof.

## 5. Track 2 Sandbox Account Detail

Open the Track 2 Sandbox account detail page.

Script:

> This detail view is where the real proof comes together: STS validation,
> inventory status, synced resources, findings, and report export access. The
> real governance proof JSON endpoint is database-only; generating it does not
> call AWS or trigger another scan.

Show:

- real AWS_SYNC resource counts;
- validation/inventory context;
- governance proof JSON/export links if visible.

## 6. Inventory

Open `/dashboard/inventory`.

Script:

> The completed read-only sync persisted six real AWS resources: one VPC, three
> subnets, and two security groups. This is intentionally a narrow Phase 1
> EC2/VPC slice, not a claim of full AWS coverage.

Point out:

- `source=AWS_SYNC`;
- real/sample separation;
- no raw AWS provider responses shown.

## 7. Security Findings

Open `/dashboard/security`.

Script:

> The local rules engine evaluated the synced resources and generated 12 LOW
> findings: six missing owner tags and six missing environment tags. These are
> low-risk governance hygiene issues, which is why the account score remains
> high at 88/100.

Show filters/counts:

- 12 AWS_SYNC findings.
- `MISSING_OWNER_TAG`: 6.
- `MISSING_ENVIRONMENT_TAG`: 6.
- Severity: LOW.
- Status: OPEN.

## 8. Compliance Evidence

Open `/dashboard/compliance`.

Script:

> Each finding is mapped into evidence snapshots for internal governance. The
> real Track 2 sandbox has 12 evidence snapshots and 100% evidence coverage for
> the evaluated controls. The wording is intentionally CIS-inspired and
> SOC2-inspired rather than claiming official certification.

Show:

- evidence coverage;
- control language;
- evidence generated from CloudShield DB records.

## 9. Governance and Risk Workflow

Open `/dashboard/governance` or a finding detail workflow.

Script:

> CloudShield supports the governance workflow around findings: ownership,
> review, planning, approval evidence, and audit trail. In this release, that
> workflow remains non-executing. It can document plans, but it does not run AWS
> mutation or Terraform apply.

Safety line:

> The platform is designed so visibility and governance can mature before any
> production execution path is enabled.

## 10. Reports and Governance Proof JSON

Open the account governance proof endpoint or use the download link:

```http
GET /api/v1/reports/aws/accounts/cmqq8z30d000hpg0z1kpjgpp4/governance-proof
GET /api/v1/reports/aws/accounts/cmqq8z30d000hpg0z1kpjgpp4/governance-proof?download=1
```

Saved proof path:

```text
C:\CloudShield-Secrets\track2-readonly\track2-governance-proof-20260623-214814.json
```

Script:

> The report is a database-only governance proof package. It records the account
> identity, STS proof metadata, inventory scan proof, resource counts, finding
> counts, compliance evidence posture, score explanations, and safety flags. It
> does not include secrets and does not call AWS during generation.

Do not open or commit secrets directories during a public demo. If showing the
saved JSON, verify first that it contains only safe exported evidence.

## 11. Production Preflight Proof

Return to terminal and show:

```powershell
pnpm.cmd production:preflight
```

Script:

> This is the release lock. Backend health is green, readiness and Postgres
> migrations are green, the frontend is reachable, scanner mode is disabled,
> change execution is disabled, the executor role is not configured, and secrets
> are not returned. This is the state I would use for a portfolio or stakeholder
> demo.

## 12. Closing Explanation

Script:

> CloudShield proves a careful path from cloud inventory to governance evidence:
> real read-only AWS validation, normalized resource inventory, deterministic
> findings, evidence snapshots, governance scoring, and exportable proof. The
> safety controls are as important as the features: no production customer claim,
> no broad AWS coverage claim, no official certification claim, and no enabled
> cloud mutation path.

## Recruiter and Interviewer Talking Points

- Built a TypeScript monorepo with Fastify backend, Next.js frontend, Prisma,
  PostgreSQL, Redis/BullMQ worker flows, Zod contracts, Docker Compose, and
  production-readiness scripts.
- Implemented a real read-only AWS sandbox validation milestone using STS and a
  narrow EC2/VPC inventory slice.
- Persisted 6 real AWS resources, generated 12 findings, and created 12
  evidence snapshots with 100% evidence coverage.
- Designed explicit runtime safety gates: scanner disabled by default, change
  execution disabled, executor role disabled, and no secrets in responses.
- Added governance proof export and release preflight evidence suitable for a
  portfolio-grade engineering walkthrough.

## Fast Two-Minute Demo Path

1. Run `pnpm.cmd production:preflight`.
2. Open `/dashboard`.
3. Open `/dashboard/accounts`.
4. Open Track 2 Sandbox detail.
5. Open `/dashboard/security`.
6. Open `/dashboard/compliance`.
7. Open governance proof JSON/export link.
8. Close with safety boundaries and future work.

## Stop Conditions

Stop the demo if any of these appear:

- scanner mode is not `disabled`;
- change execution mode is not `disabled`;
- executor role is configured;
- any secret, token, External ID, credential file, or raw provider payload is
  visible;
- a workflow attempts AWS mutation, Terraform apply, remediation execution, or
  inventory sync without separate approval.

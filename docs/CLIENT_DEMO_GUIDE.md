# Client Demo Guide

CloudShield is enterprise-client-ready for local consulting demos. It is not deployed to a real customer and must not be described as such.

## Run Locally

```powershell
pnpm install
docker compose up -d --build
$env:DATABASE_URL="postgresql://cloudshield:cloudshield_local_password@localhost:55432/cloudshield"
pnpm --filter @cloudshield/database prisma:deploy
pnpm --filter @cloudshield/database seed
```

Open `http://localhost:3100`.

## Demo Login

```text
Email: demo@cloudshield.local
Password: CloudShieldDemo123!
```

These credentials are local sample/demo credentials only.

## Pages To Show

- `/dashboard`: executive cloud posture
- `/dashboard/accounts`: AWS account governance and read-only connector posture
- `/dashboard/inventory`: sample asset inventory foundation
- `/dashboard/security`: cloud risk register
- `/dashboard/cost`: cost governance signals
- `/dashboard/compliance`: compliance evidence center
- `/dashboard/recommendations`: review-only remediation recommendations

## What To Explain

- CloudShield models a company IT-level AWS governance control plane.
- Data is tenant-scoped by organization.
- Current data is sample/demo data.
- Read-only AWS connector defaults to disabled.
- STS identity validation is the only real AWS API path currently supported when explicitly configured.
- Recommendations are advisory and non-executable.

## What Not To Claim

- Do not claim real AWS scanning is enabled.
- Do not claim official CIS or SOC2 certification.
- Do not claim deployment to a real customer.
- Do not claim automatic remediation.
- Do not claim Terraform apply.

## How To Explain Sample Data

The seed data demonstrates governance workflows: accounts, resources, findings, evidence, and recommendations. It is clearly labeled sample/demo data and should not be presented as real AWS inventory.

## Future Scanner Roadmap

Future scanner work should use allowlisted read-only APIs only, remain disabled by default until explicitly enabled, and never include mutation or automatic remediation.

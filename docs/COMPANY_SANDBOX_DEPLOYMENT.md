# Company Sandbox Deployment

Status: implemented foundation, real AWS validation pending authorization.

This milestone targets a dedicated non-production AWS sandbox account. It does not claim production deployment, customer deployment, or production mutation readiness.

## Deployment Model

Recommended pilot model: Docker Compose on a dedicated sandbox EC2 host.

Included components:

- CloudShield frontend
- CloudShield backend API
- CloudShield worker
- PostgreSQL with persistent volume
- Redis with persistent volume
- TLS termination through an external reverse proxy or load balancer
- Backend `/health`, `/ready`, and `/api/v1/platform/sandbox-readiness`
- Restart policies through `docker-compose.sandbox.yml`

Use:

```powershell
docker compose -f docker-compose.yml -f docker-compose.sandbox.yml up -d --build
```

## Network Rules

- PostgreSQL must not be exposed publicly.
- Redis must not be exposed publicly.
- Backend exposure must be restricted to the frontend, reverse proxy, or approved administrator network.
- SSH must not be open to `0.0.0.0/0`; prefer SSM Session Manager.
- TLS termination is required before any company pilot access.

## Runtime Secrets

Do not commit `.env` files or credentials. Inject these values through the host environment, a secret manager, or the deployment platform:

- `DATABASE_URL`
- `JWT_SECRET`
- `POSTGRES_PASSWORD`
- `AWS_ROLE_ARN`
- `AWS_EXTERNAL_ID`
- `AWS_EXECUTOR_ROLE_ARN`
- `AWS_EXECUTOR_EXTERNAL_ID`
- `AWS_ALLOWED_ACCOUNT_IDS`
- `AWS_ALLOWED_REGIONS`

External IDs and temporary credentials must never be logged or returned to the frontend.

## Validation Status

- Implemented: sandbox-safe configuration, readiness reporting, scanner/executor role separation, EC2 read-only inventory foundation, governed EC2 tagging foundation.
- Locally validated: typechecks, tests, frontend build after this branch validation.
- Sandbox validated: pending explicit authorization.
- Production blocked: `AWS_CHANGE_EXECUTION_MODE=production` is rejected by the governed worker.

# CloudShield Public Read-Only Demo Deployment

This guide prepares CloudShield for a public demo deployment without changing the platform safety model.

## Deployment Classification

This is a public read-only demo deployment profile.

It does not claim production customer deployment, official certification, autonomous remediation, Terraform apply, or live AWS mutation capability.

## Safety Defaults

The public demo compose file keeps AWS connector, inventory scanner, change execution, AWS role ARN, and external ID disabled or empty.

Do not add real AWS credentials to the repository.

## Files

- docker-compose.public-demo.yml
- .env.public-demo.example
- apps/frontend/Dockerfile.public-demo
- apps/backend/Dockerfile.public-demo
- apps/worker/Dockerfile.public-demo

## Local Public-Demo Validation

1. Copy .env.public-demo.example to .env.public-demo.
2. Set a long random POSTGRES_PASSWORD.
3. Build with: docker compose --env-file .env.public-demo -f docker-compose.public-demo.yml build
4. Start DB and Redis with: docker compose --env-file .env.public-demo -f docker-compose.public-demo.yml up -d postgres redis
5. Run migrations with: docker compose --env-file .env.public-demo -f docker-compose.public-demo.yml run --rm backend pnpm --filter @cloudshield/database prisma:deploy
6. Start full stack with: docker compose --env-file .env.public-demo -f docker-compose.public-demo.yml up -d

## VPS Deployment Shape

Use a small Linux VPS with Docker and Docker Compose, set .env.public-demo values, then place Nginx, Caddy, or Cloudflare in front with HTTPS.

## Important

This deployment profile is for public demonstration and recruiter review. Keep AWS write, mutation, remediation execution, and Terraform apply disabled unless a separate security review and production deployment plan are completed.

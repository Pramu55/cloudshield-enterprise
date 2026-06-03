FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/frontend ./apps/frontend

RUN corepack enable && pnpm install --frozen-lockfile=false
RUN pnpm --filter @cloudshield/contracts build

EXPOSE 3100

CMD ["pnpm", "--filter", "@cloudshield/frontend", "dev"]

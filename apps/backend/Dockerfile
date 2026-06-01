FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/backend ./apps/backend

RUN corepack enable && pnpm install --frozen-lockfile=false
RUN pnpm --filter @cloudshield/contracts build \
  && pnpm --filter @cloudshield/utils build \
  && pnpm --filter @cloudshield/logger build \
  && pnpm --filter @cloudshield/config build \
  && pnpm --filter @cloudshield/security build \
  && pnpm --filter @cloudshield/database build

EXPOSE 4000

CMD ["pnpm", "--filter", "@cloudshield/backend", "dev"]

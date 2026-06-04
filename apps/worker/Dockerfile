FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker

RUN corepack enable && pnpm install --frozen-lockfile=false
RUN pnpm --filter @cloudshield/contracts build \
  && pnpm --filter @cloudshield/utils build \
  && pnpm --filter @cloudshield/logger build \
  && pnpm --filter @cloudshield/config build \
  && pnpm --filter @cloudshield/database build

CMD ["pnpm", "--filter", "@cloudshield/worker", "dev"]

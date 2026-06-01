FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN corepack enable && pnpm install --frozen-lockfile=false
RUN pnpm --filter @cloudshield/types build \
  && pnpm --filter @cloudshield/utils build \
  && pnpm --filter @cloudshield/logger build

EXPOSE 4000

CMD ["pnpm", "--filter", "@cloudshield/api", "dev"]

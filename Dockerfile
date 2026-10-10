FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy manifests first — maximises Docker layer cache hits on dependency install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/core/package.json ./apps/core/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm turbo run build --filter=@gami/core --filter=@gami/shared

FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/core/package.json ./apps/core/
COPY packages/shared/package.json ./packages/shared/

# pnpm resolves workspace:* references and creates the correct symlinks so that
# compiled @gami/shared output (copied below) is found at runtime.
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/apps/core/dist ./apps/core/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "apps/core/dist/index.js"]

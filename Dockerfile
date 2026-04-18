# ─────────────────────────────────────────────────────────────────────────────
# Production Dockerfile — multi-stage build
#
# Stage 1 (builder): installs all deps, compiles TypeScript for all packages.
# Stage 2 (runner):  re-installs production-only deps, copies compiled output.
#
# Build:
#   docker build -t gami-core .
#
# Run:
#   docker run --env-file .env -p 3000:3000 gami-core
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy manifests first — maximises Docker layer cache hits on dependency install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/core/package.json ./apps/core/
COPY packages/shared/package.json ./packages/shared/

RUN pnpm install --frozen-lockfile

# Copy full source and compile
COPY . .
RUN pnpm build

# ── Stage 2: Production runner ────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy manifests and lock file for production dependency installation
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/core/package.json ./apps/core/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies only.
# pnpm resolves workspace:* references and creates the correct symlinks so that
# compiled @gami/shared output (copied below) is found at runtime.
RUN pnpm install --frozen-lockfile --prod

# Copy compiled TypeScript output from the builder stage
COPY --from=builder /app/apps/core/dist ./apps/core/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

EXPOSE 3000

# NODE_ENV tells the application it is running in production mode
ENV NODE_ENV=production

CMD ["node", "apps/core/dist/index.js"]

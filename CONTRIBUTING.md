# Contributing to Gami DigiDouble Core

## Prerequisites

- [Node.js 22 LTS](https://nodejs.org/) (or use [nvm](https://github.com/nvm-sh/nvm): `nvm use`)
- [pnpm 9+](https://pnpm.io/installation) — `npm install -g pnpm`
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) for local infrastructure

## VS Code Setup

Install the recommended extensions when prompted, or manually:

- **Prettier - Code formatter** (`esbenp.prettier-vscode`) — formatter
- **ESLint** (`dbaeumer.vscode-eslint`) — inline lint errors

Then add the following to your local `.vscode/settings.json` (not committed — kept personal):

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true
}
```

This enables format-on-save using the project's `.prettierrc.json`.

## First-time Setup

```bash
# Clone
git clone https://github.com/your-org/gami-digidouble-core.git
cd gami-digidouble-core

# Install dependencies and set up pre-commit hooks
pnpm install

# Copy and fill in environment variables
cp .env.example .env
```

Key `.env` variables to review before starting:

| Variable                                                            | Required                      | Notes                                                  |
| ------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------ |
| `DATABASE_URL`                                                      | Yes                           | Already set for the default local stack                |
| `REDIS_URL`                                                         | Yes                           | Already set for the default local stack                |
| `API_KEY_SECRET`                                                    | Yes                           | Change from the default before using any endpoint      |
| `LLM_PROVIDER`                                                      | No                            | Defaults to `null` — no LLM key needed for local dev   |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `MISTRAL_API_KEY`          | Only if `LLM_PROVIDER` is set | Provider credentials                                   |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_BASE_URL` | No                            | Optional observability (see Langfuse self-hosted docs) |

```bash
# Start local infrastructure (postgres + redis)
pnpm infra:up

# Start the dev server
pnpm dev
```

## Docker

The project ships two Docker Compose files:

| File                     | Purpose                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `docker-compose.yml`     | **Development stack** — postgres, redis, and the app with hot reload via `tsx`. Loads `.env` from disk.             |
| `docker-compose.e2e.yml` | **Stack E2E stack** — builds the production image, injects env vars from the shell. Used for `pnpm test:stack-e2e`. |

### Development Stack (`docker-compose.yml`)

```bash
# Start only infra (recommended — run app locally for hot reload)
pnpm infra:up              # postgres + redis in the background

# Start full stack in containers (app + infra)
pnpm infra:up:all          # docker compose up -d

# Useful while running
pnpm infra:logs            # tail all container logs

# Teardown
pnpm infra:down            # stop containers, keep volumes
pnpm infra:reset           # stop + wipe all volumes (fresh DB)
```

### Stack E2E (`docker-compose.e2e.yml`)

```bash
# Build the production image and start the full stack
docker compose -f docker-compose.e2e.yml up -d --build --wait

# Run the stack E2E tests against the running stack
APP_URL=http://localhost:3000 pnpm test:stack-e2e

# Tear down and wipe volumes when done
docker compose -f docker-compose.e2e.yml down -v
```

The `docker-compose.e2e.yml` stack uses a fixed `API_KEY_SECRET` (`e2e-stack-secret`) already known by the test suite. LLM provider keys and Langfuse credentials are injected from the shell environment when available; by default `LLM_PROVIDER=null` so the suite runs without any real provider.

### Coolify Single Project (`docker-compose.coolify.yml`)

```bash
# Deploy the full Coolify project in one application
# Use `docker-compose.coolify.yml` as the Compose file in Coolify.
```

Required Coolify env vars:

- `API_KEY_SECRET`

Optional Coolify env vars:

- `CORS_ORIGIN`
- `LLM_PROVIDER`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `MISTRAL_API_KEY`
- `XAI_API_KEY`
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL`

The stack includes PostgreSQL and Redis as internal services, and also serves the public web app from the same Coolify project.

Required Coolify env vars:

- `API_KEY_SECRET`
- `VITE_API_URL` (example: `https://api.example.com`)

The web service builds `apps/web` and serves static assets through nginx on port 80.
During the Coolify build, `VITE_API_KEY` is derived from `API_KEY_SECRET` so the project only needs one secret value.

## Daily Workflow

```bash
# Start infra (if not already running)
pnpm infra:up

# Start app in dev mode (hot reload via tsx)
pnpm dev

# Stop infra when done
pnpm infra:down
```

Console package (manual test UI) during EPIC 2.4 development:

```bash
pnpm --filter @gami/console dev
```

Reference scenario seed (AI Guided Discovery):

```bash
pnpm --filter @gami/core seed:ai-guided-discovery
```

Public web app (EPIC 7.1) local workflow:

```bash
# 1) Start infra
pnpm infra:up

# 2) Start core API (Terminal A)
pnpm --filter @gami/core dev

# 3) (Optional but recommended) Seed a ready-to-play scenario and avatars
pnpm --filter @gami/core seed:ai-guided-discovery

# 4) Start the public web app (Terminal B)
VITE_API_URL=http://localhost:3000 VITE_API_KEY=your-api-key-secret pnpm --filter @gami/web dev
```

Then open `http://localhost:5173`.

Manual smoke test for the public web app:

1. Create a local identity and refresh the page (identity should be restored from browser storage).
2. Reset identity (onboarding should appear again).
3. Select a scenario and confirm only available avatars are shown.
4. Start a chat, send a message, and confirm optimistic user message + visible processing state.
5. Confirm avatar response appears in the active thread.

## Quality Commands

These are the core quality commands used by CI gates. Always verify locally before pushing.

```bash
pnpm format         # Format all files with Prettier
pnpm format:check   # Check formatting without writing (runs in CI)
pnpm lint           # ESLint with typescript-eslint strict rules
pnpm typecheck      # TypeScript strict typecheck across all packages
pnpm test           # Run all unit tests via Vitest
pnpm --filter @gami/core test:coverage         # Coverage thresholds (80%) for @gami/core
pnpm --filter @gami/core test:integration-e2e  # Integration and in-process E2E suites
pnpm test:stack-e2e                            # Full-stack E2E (requires docker-compose.e2e.yml stack + APP_URL)
```

Single-package scope (faster feedback during development):

```bash
pnpm --filter @gami/core test
pnpm --filter @gami/core test:coverage
pnpm --filter @gami/core test:integration-e2e
pnpm --filter @gami/core typecheck
pnpm --filter @gami/core exec eslint src
pnpm --filter @gami/web test
pnpm --filter @gami/web typecheck
pnpm --filter @gami/web lint
pnpm --filter @gami/web build
pnpm --filter @gami/console lint
pnpm --filter @gami/console typecheck
pnpm --filter @gami/console build
```

## CI Behavior

- **Pull requests / push:** format, lint, typecheck, fast test suite, coverage floor, and security checks (dependency review on PR + gitleaks scan)
- **Push to `main` / `master`:** all PR checks plus explicit integration and E2E suites
- **Nightly schedule:** real-provider smoke path (via existing gated tests) and secrets scan, with TODO placeholders for mutation/regression/performance suites once scripts exist

## Pre-commit Hook

A pre-commit hook is installed automatically during `pnpm install`.

It runs formatting and linting on staged files before each commit.

If you need to bypass it in an emergency:

```bash
git commit --no-verify -m "your message"
```

Note: this skips the hook locally but CI will still catch any issues.

To reinstall hooks after a fresh clone:

```bash
pnpm simple-git-hooks
```

## Code Conventions

- **TypeScript strict mode** — no `any`, no implicit types
- **Layer discipline** — API → Application → Domain → Infrastructure (no shortcuts)
- **LLM calls** — always through `ILlmAdapter`, never via provider SDKs directly
- **API responses** — always use `ok()` / `fail()` from `@gami/shared`
- **Commits** — use [Conventional Commits](https://www.conventionalcommits.org/):
  `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- **Epic references** — include epic ID in commits when applicable:
  `feat(avatar): add persona prompt builder [EPIC-2.1]`

## Troubleshooting

### Reset the database from scratch

If the local DB is in a bad state (schema drift, corrupted data, failed migration), wipe all Docker volumes and restart:

```bash
pnpm infra:reset   # docker compose down -v  — stops containers AND deletes all volumes
pnpm infra:up      # recreates postgres + redis with a clean DB (init.sql is applied automatically)
```

`infra/postgres/init.sql` is the single source of truth for the schema — it is executed by the `postgres` container on first start against an empty volume.

---

## Useful References

- [API_GUIDE.md](API_GUIDE.md) — curl examples, integration flow, and frontend notes
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — layer map and module responsibilities
- [docs/PRINCIPLES.md](docs/PRINCIPLES.md) — 19 guiding principles
- [docs/API_CONTRACT.md](docs/API_CONTRACT.md) — API envelope and endpoint contracts
- [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) — current implementation state
- [AGENTS.md](AGENTS.md) — full agent coding instructions

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
# Edit .env — add DATABASE_URL, REDIS_URL, API_KEY_SECRET, and any LLM provider keys

# Start local infrastructure (postgres + redis)
pnpm infra:up

# Start the dev server
pnpm dev
```

## Daily Workflow

```bash
# Start infra (if not already running)
pnpm infra:up

# Start app in dev mode (hot reload via tsx)
pnpm dev

# Stop infra when done
pnpm infra:down
```

## Quality Commands

These are the exact same commands that run in CI. Always verify locally before pushing.

```bash
pnpm format         # Format all files with Prettier
pnpm format:check   # Check formatting without writing (runs in CI)
pnpm lint           # ESLint with typescript-eslint strict rules
pnpm typecheck      # TypeScript strict typecheck across all packages
pnpm test           # Run all tests via Vitest
```

Single-package scope (faster feedback during development):

```bash
pnpm --filter @gami/core test
pnpm --filter @gami/core typecheck
pnpm --filter @gami/core exec eslint src
```

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

## Useful References

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — layer map and module responsibilities
- [docs/PRINCIPLES.md](docs/PRINCIPLES.md) — 19 guiding principles
- [docs/API_CONTRACT.md](docs/API_CONTRACT.md) — API envelope and endpoint contracts
- [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) — current implementation state
- [AGENTS.md](AGENTS.md) — full agent coding instructions

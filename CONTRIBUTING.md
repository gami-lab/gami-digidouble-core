# Contributing

## Prerequisites and setup

- Node.js 22 (`.nvmrc`)
- pnpm
- Docker Compose

```bash
pnpm install
cp .env.example .env
pnpm infra:up
pnpm dev
```

Use `pnpm infra:reset` only when a fresh local database is needed. The canonical schema is
`infra/postgres/init.sql`; it is applied only to an empty volume.

Review `.env` before first run: `DATABASE_URL`/`REDIS_URL` are already set for the default local
stack; `API_KEY_SECRET` must be changed before calling any endpoint; `LLM_PROVIDER` defaults to
`null`, so no provider key is needed to exercise the API locally (the Avatar replies with a fixed
stub); Langfuse variables are optional. The `docker-compose.e2e.yml` stack uses a separate, fixed
key (`e2e-stack-secret`) already known by the test suite.

A pre-commit hook (via `simple-git-hooks` + `lint-staged`) is installed automatically on
`pnpm install` and formats/lints staged files before each commit. Bypass it only in an emergency
with `git commit --no-verify` — CI still enforces the same checks. Reinstall hooks after a fresh
clone with `pnpm simple-git-hooks`.

## Useful commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm test:integration-e2e
pnpm test:stack-e2e
pnpm build
```

Run package-scoped commands with `pnpm --filter <package> <script>` (e.g.
`pnpm --filter @gami/core test:coverage`, `pnpm --filter @gami/web build`) for faster feedback than
the full workspace run. Stack E2E requires the `docker-compose.e2e.yml` stack and an available
`APP_URL`; provider/database checks are explicitly environment-gated.

CI runs format/lint/typecheck and the fast test suite plus a coverage floor on every PR and push;
pushes to `main`/`master` additionally run the extended integration and E2E suites. A nightly job
runs a real-provider smoke test — it is allowed to fail without blocking, since transient provider
outages shouldn't fail the build.

To run the public web app (`apps/web`) against a local Core API:

```bash
pnpm infra:up
pnpm --filter @gami/core dev                      # Terminal A
pnpm --filter @gami/core seed:ai-guided-discovery  # optional: seed a ready-to-play scenario
pnpm --filter @gami/web dev                        # Terminal B, http://localhost:5173
```

Smoke-test it manually: create a local identity (persisted in browser storage), reset it and
confirm onboarding reappears, pick a scenario and confirm only unlocked avatars show, then send a
message and confirm the optimistic user bubble and avatar reply both appear.

## Before changing code

Read [docs/README.md](docs/README.md), then the relevant architecture, contract, data-model, and
testing documents. Check [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) and work within a
backlog item from [docs/EPICS.md](docs/EPICS.md).

Keep `API -> Application -> Domain -> Infrastructure` boundaries. Add ports for external systems;
never call provider SDKs or persistence directly from Domain/Application logic. Put shared public
DTOs in `packages/shared`, and map them explicitly at boundaries.

## Change workflow

1. State assumptions and define a small, verifiable success criterion.
2. Make the smallest surgical change that satisfies the request.
3. Add deterministic tests for domain/policy changes and contract tests for API changes.
4. Run the narrowest relevant checks, then the full quality gates when practical.
5. Update only the durable documentation affected by the behavior change.

## Conventions

- Strict TypeScript: no `any` or implicit types.
- Validate external input at API boundaries.
- Use standard `ApiResponse<T>` errors.
- Keep diagnostics bounded and redact secrets, prompts, provider payloads, raw vectors, and raw audio.
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Include an epic reference when the change belongs to one.
- Never commit `.env` files, credentials, or generated artifacts.

## Deployment and recovery

Use [docs/COOLIFY_DEPLOYMENT_SPECIFICATION.md](docs/COOLIFY_DEPLOYMENT_SPECIFICATION.md) for
Coolify/fresh-volume rules and [docs/EMBEDDING_OPERATIONS.md](docs/EMBEDDING_OPERATIONS.md) for
vector profile changes and reindexing. Preserve old deployment data until a fresh-schema deployment
has been verified.

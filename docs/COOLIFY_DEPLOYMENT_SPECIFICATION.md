# Coolify Deployment Specification

## Purpose

Define the production deployment shape for Gami DigiDouble Core on Coolify.

This document covers:

1. Backend deployment (`core` + PostgreSQL + Redis)
2. Public frontend deployment (`web`)
3. Admin frontend deployment (`admin`)
4. Environment variable ownership and domain routing

---

## Decision (Current)

### Repository model

Use one monorepo.

- `apps/core` -> backend API runtime
- `apps/web` -> public user frontend
- `apps/admin` -> operator scenario-builder frontend
- `apps/console` -> local debug UI only (never deployed to production)
- `packages/shared` -> shared contracts/types

### Coolify model

Use one Coolify project per environment.

That project contains both the backend stack and the public web app.

---

## Why One Project

One-project deployment keeps the current production surface simple while still separating concerns by service.

Benefits:

- Single project to manage in Coolify
- One deployment history for the current runtime surface
- Clear service separation inside the compose file
- Simpler initial setup and fewer moving parts

Tradeoff:

- Backend and web are deployed together

---

## Deployment Topology

### Single production project

Compose file: `docker-compose.coolify.yml`

Services:

- `app` (`core` API)
- `web` public frontend
- `admin` operator frontend
- `postgres`
- `redis`
- `db-init` one-shot schema initializer

Domain:

- `api.example.com` -> `app` service
- `app.example.com` -> `web` service
- `app.example.com/admin` -> `admin` service

---

## File Mapping

Project files:

- `docker-compose.coolify.yml`
- `Dockerfile`
- `Dockerfile.web`
- `Dockerfile.admin`
- `infra/nginx/web.conf` (`web`)
- `infra/nginx/admin.conf` (`admin`)

---

## Environment Variable Ownership

### Backend runtime (`core`)

Required:

- `API_KEY_SECRET`
- `OPENAI_API_KEY` (required by the default production embedding provider)

Managed internally by compose:

- `DATABASE_URL`
- `REDIS_URL`

Optional:

- `CORS_ORIGIN`
- `LLM_PROVIDER`
- `EMBEDDING_PROVIDER`
- `EMBEDDING_MODEL`
- `EMBEDDING_DIMENSIONS`
- `EMBEDDING_BATCH_SIZE`
- `DEEPGRAM_API_KEY` (required for provider-backed voice transcription; omit to keep voice safely unavailable)
- `DEEPGRAM_MODEL` (default `nova-3`)
- `DEEPGRAM_TIMEOUT_MS` (default `30000`)
- `DEEPGRAM_DEFAULT_LANGUAGE` (default `en`, BCP-47 format)
- `ANTHROPIC_API_KEY`
- `MISTRAL_API_KEY`
- `XAI_API_KEY`
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL`

Embedding deployment notes:

- Keep `EMBEDDING_PROVIDER=openai`, `EMBEDDING_MODEL=text-embedding-3-small`, and
  `EMBEDDING_DIMENSIONS=16` together with the deployed `VECTOR(16)` schema.
- A provider/model/dimension change requires the matching canonical schema revision and a complete
  staged reindex through the authenticated admin routes before the new profile can become active.
- Review [EMBEDDING_OPERATIONS.md](EMBEDDING_OPERATIONS.md) for the start, status, retry, and
  restart-recovery procedure.

### Web runtime (`web`)

Required build arguments:

- `VITE_API_URL`
- `VITE_API_KEY` (derived from `API_KEY_SECRET` in the compose file)

Important:

- `VITE_*` values are embedded at build time in Vite static builds.
- `VITE_API_KEY` is client-visible in browser bundles. The current deployment reuses `API_KEY_SECRET` as the source value so Coolify only needs one configured secret.

### Admin runtime (`admin`)

Required build arguments:

- `VITE_API_URL`
- `VITE_API_KEY` (derived from `API_KEY_SECRET` in the compose file, same as `web`)

Same build-time/client-visibility notes as the web runtime apply.
The admin build is path-prefixed and emitted for `/admin/`.

**CORS caveat:** `apps/core/src/api/server.ts` registers `@fastify/cors` with `origin: config.corsOrigin` — a single string, not a list. If `CORS_ORIGIN` is set to one exact origin (e.g. `app.example.com`), requests from the `admin` domain will be blocked by the browser. Until the backend supports multiple allowed origins, either set `CORS_ORIGIN=*` or pick one exact origin that covers your actual usage.

---

## Coolify Configuration Notes

This recommendation follows Coolify concepts and compose behavior:

- Domains route traffic to specific services/resources through the reverse proxy.
- In Docker Compose deployments, only services defined in the compose file can be exposed.

References:

- https://coolify.io/docs/get-started/concepts
- https://coolify.io/docs/knowledge-base/docker/compose

---

## Deployment Steps

### 1. Deploy the single Coolify project

- Use `docker-compose.coolify.yml`
- Configure domains for `app`, `web`, and `admin` services in the same project (Coolify only lists a "Domains for X" field for services present in the compose file — after adding a new service, redeploy once before the domain field appears)
- Set required env vars `API_KEY_SECRET` and `VITE_API_URL`
- Deploy and verify `/health` (API), `/` (web), and `/admin` (admin)

### 2. CORS alignment

Set backend `CORS_ORIGIN` so browser requests from `app.example.com` to `api.example.com` are allowed. See the CORS caveat under [Admin runtime](#admin-runtime-admin) if serving both `web` and `admin` from different origins.

---

## Schema Changes and Resets

`infra/postgres/init.sql` is the single canonical fresh-database bootstrap. There is no runtime
schema alignment and no migration framework. PostgreSQL runs the bootstrap only when its data
directory is empty, so changing `init.sql` does not update an existing database volume. Existing
volumes are outside the supported deployment contract for this clean-slate schema.

### Fresh-volume procedure

Provision a new PostgreSQL volume whenever the canonical schema changes or when deploying this
clean-slate baseline for the first time. Preserve the old volume as a backup until the new stack
has been verified; do not attach both volumes to the same service.

1. Back up any data that must be retained from the old database.
2. Push the updated `infra/postgres/init.sql` and `docker-compose.coolify.yml`.
3. Redeploy with the `postgres_data_canonical` volume key. The changed key provisions a new empty
   volume, and `db-init` applies the complete schema from `/schema/init.sql`.
4. Check the deploy logs for successful PostgreSQL health, `db-init`, and application startup.
5. Verify `/health` and spot-check the current tables, including `gm_states` and
   `knowledge_chunks` vector constraints.
6. Keep the old volume detached as a rollback reference or remove it only after an explicit
   operator decision.

### Fresh-content verification order

After the new API is healthy, seed canonical content in this order:

1. Run `pnpm seed:murder-party:api:prod` with the new API URL and API key. The seed creates or
   updates the Scenario with its required language, then Avatars with structured prompt sections
   and canonical availability data.
2. Register the `world`, `avatar_knowledge`, and `media` sources with explicit visibility policy.
3. Wait for each ingestion job to complete successfully.
4. Run the Avatar-trait preparation step and verify that every active Avatar has `computedTraits`
   before serving traffic.
5. Verify `/health`, the active Scenario and Avatar summaries, and the current schema contract
   (including `gm_states`, `knowledge_sources.visibility_policy`, and vector profile/dimension
   constraints).

The API seed is the supported fresh-content path; it does not read or rewrite historical content.
Do not attach an old PostgreSQL volume, seed legacy knowledge types, or activate incomplete
Avatars/Scenarios. For local verification, the equivalent sequence is:

```bash
docker compose down
docker volume create gami-digidouble-core_postgres_data_canonical
docker compose up -d postgres redis
pnpm --filter @gami/core test:integration-e2e
docker compose up -d --build app
curl --fail http://localhost:3000/health
MURDER_PARTY_API_BASE_URL=http://localhost:3000 \
MURDER_PARTY_API_KEY=your-local-key \
pnpm seed:murder-party:api:local
pnpm --filter @gami/core test:stack-e2e
```

The E2E compose flow provisions an isolated empty database for each run and can be verified with
`docker compose -f docker-compose.e2e.yml up -d --build --wait`; tear down only those temporary
resources with `docker compose -f docker-compose.e2e.yml down -v` after verification.

For local Docker development, use `docker compose down` followed by a fresh canonical volume (the
local compose file uses `postgres_data_canonical`) before starting PostgreSQL again. The E2E compose
flow is also expected to use a fresh database for each run and already tears its resources down with
`docker compose -f docker-compose.e2e.yml down -v`.

---

## Non-Negotiable Rule

`apps/console` is local-only tooling and must not be deployed in Coolify production.

---

## Admin App

`apps/admin` is deployed as the `admin` service in this same compose stack (see `Dockerfile.admin`), sharing this project's deployment history and rollback path with `app` and `web`. The production build is emitted for the `/admin/` path and the admin nginx config serves `/admin`, `/admin/`, and `/admin/assets/*` from the same static bundle. This was a deliberate simplicity tradeoff over an independent Coolify resource — revisit if admin's release cadence or blast-radius needs diverge enough to justify splitting it out.

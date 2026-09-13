# Coolify deployment

## Shape

Use one Coolify project per environment with `docker-compose.coolify.yml`:

- `app` — Core API
- `web` — public player app
- `admin` — scenario-builder app
- `postgres` — PostgreSQL/pgvector
- `redis` — runtime coordination/cache
- `db-init` — one-shot fresh-schema initializer

`apps/console` is local-only and is never deployed.

### Why one project

One Coolify project holding the whole stack (rather than a project per service) keeps the
production surface simple: one deployment history, one rollback path, fewer moving parts, while
still separating concerns per service in the compose file. The tradeoff is that backend and both
frontends deploy together. `admin` sharing the `app`/`web` project and release cadence is a
deliberate simplicity choice too — revisit it if admin's release cadence or blast radius needs to
diverge enough to justify its own Coolify resource.

Domain routing example: `api.example.com` -> `app`, `app.example.com` -> `web`,
`app.example.com/admin` -> `admin`. Only services defined in the compose file can get a domain; if
you add a new service, Coolify's "Domains for X" field only appears after redeploying once.

## Configuration

Keep API secrets server-side. Browser `VITE_*` values are build-time and client-visible; treat
`VITE_API_KEY` as public exposure of the chosen Phase A API key. This deployment deliberately
derives `VITE_API_KEY` from `API_KEY_SECRET` in the compose file so Coolify only needs one
configured secret, at the cost of that key being visible in the browser bundle.

Required: `API_KEY_SECRET`, `OPENAI_API_KEY` (default embedding provider), plus database/Redis
connection values (managed internally by compose). Optional depending on enabled capabilities:
`CORS_ORIGIN`, `LLM_PROVIDER`, the `EMBEDDING_*` variables, `DEEPGRAM_*` (voice transcription —
omit to keep voice safely unavailable), other model provider keys, and `LANGFUSE_*`. See compose
files and `.env.example` for the exact current variable list.

**CORS gotcha:** `apps/core/src/api/server.ts` registers `@fastify/cors` with a single
`config.corsOrigin` string, not a list. If `CORS_ORIGIN` is set to one exact origin (e.g.
`app.example.com`), browser requests from a different origin (e.g. an `admin` domain on a separate
host) will be blocked. Until the backend supports multiple allowed origins, either set
`CORS_ORIGIN=*` or pick the one exact origin that covers your actual usage.

Keep the embedding profile (`EMBEDDING_PROVIDER`/`EMBEDDING_MODEL`/`EMBEDDING_DIMENSIONS`) aligned
with the deployed `VECTOR(1536)` schema. A profile change needs a matching schema revision and a
complete staged reindex before it can go active — see the procedure in
[EMBEDDING_OPERATIONS.md](EMBEDDING_OPERATIONS.md); do not just flip the env var.

## Fresh schema rule

`infra/postgres/init.sql` is the canonical schema bootstrap. There is no runtime schema alignment
or migration framework in this clean-slate deployment — PostgreSQL only runs the bootstrap when its
data directory is empty, so editing `init.sql` never updates an existing volume.

A schema change therefore requires provisioning a genuinely new, empty PostgreSQL volume (the
compose volume key is `postgres_data_canonical` — changing/recreating that key is what forces a
fresh volume). Preserve the old volume as a rollback backup until the new stack is verified; never
attach both volumes to the same service.

## Release checklist

1. Deploy the compose file and verify database, Redis, `app /health`, web `/`, and admin `/admin`.
2. Confirm CORS and API-key behavior from both browser apps (see the CORS gotcha above).
3. Seed/update the Scenario and Avatars with canonical content: run `pnpm seed:murder-party:api:prod`
   (or `:local` against a local stack) with the target API URL/key — it creates or updates the
   Scenario plus Avatars with their structured prompts, and is safe to rerun (it does not read or
   rewrite historical content).
4. Register `world`, `avatar_knowledge`, and `media` sources with explicit visibility, and wait for
   each ingestion job to complete.
5. Run the Avatar-trait preparation step and confirm every active Avatar has `computedTraits` before
   serving traffic.
6. Verify retrieval (see [AVATAR_RAG_SETUP_GUIDE.md](AVATAR_RAG_SETUP_GUIDE.md)) and spot-check the
   schema contract (`gm_states`, `knowledge_sources.visibility_policy`, vector profile/dimension)
   before serving traffic.
7. Run the applicable deterministic and stack checks
   (`pnpm --filter @gami/core test:integration-e2e` / `test:stack-e2e`).

Do not attach an old/unsupported volume, seed removed knowledge types, or activate incomplete
Scenarios/Avatars.

### Local equivalent

For local verification of the same fresh-volume flow:

```bash
docker compose down
docker volume create gami-digidouble-core_postgres_data_canonical
docker compose up -d postgres redis
pnpm --filter @gami/core test:integration-e2e
docker compose up -d --build app
curl --fail http://localhost:3000/health
pnpm seed:murder-party:api:local
pnpm --filter @gami/core test:stack-e2e
```

`docker-compose.e2e.yml` provisions its own isolated, empty database per run and already tears
itself down (`docker compose -f docker-compose.e2e.yml down -v`) — no manual volume management
needed for that flow.

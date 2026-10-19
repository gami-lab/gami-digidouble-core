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

Keep secrets server-side. Browser `VITE_*` values are build-time and public; the web and admin
builds take only `VITE_API_URL`. CI scans the built bundles for secrets
(`pnpm check:bundle-secrets`).

Operator environment for EPIC 12.1 (set before deploying):

| Variable                                                                | Notes                                                    |
| ----------------------------------------------------------------------- | -------------------------------------------------------- |
| `ADMIN_PASSWORD_HASH`                                                   | output of `pnpm --filter @gami/core hash-admin-password` |
| `ADMIN_SESSION_SECRET`, `ADMIN_SERVICE_KEY`, `PLAYER_TOKEN_SECRET`      | random, at least 32 characters each                      |
| `ADMIN_ORIGINS`                                                         | admin app origin, e.g. `https://app.example.com`         |
| `PLAYER_ORIGINS`                                                        | player web origin(s)                                     |
| `TRUST_PROXY_HOPS`                                                      | `1` behind Coolify's Traefik (compose default)           |
| `ADMIN_SESSION_TTL_SECONDS`, `PLAYER_TOKEN_TTL_SECONDS`, `RATE_LIMIT_*` | optional overrides                                       |

Remove `API_KEY_SECRET` and `CORS_ORIGIN`; Core no longer reads them. The seed script and the
evaluation tool take `ADMIN_SERVICE_KEY`.

Also required: `OPENAI_API_KEY` (default embedding provider), plus database/Redis connection values
(managed internally by compose). Optional depending on enabled capabilities:
`RATE_LIMIT_*`, `LLM_PROVIDER`, the `EMBEDDING_*` variables, `DEEPGRAM_*` (voice transcription —
omit to keep voice safely unavailable), other model provider keys, and `LANGFUSE_*`. See compose
files and `.env.example` for the exact current variable list.

**CORS:** set `PLAYER_ORIGINS` to the player web origin and `ADMIN_ORIGINS` to the admin origin
(comma-separated lists). Admin routes only answer the admin origins, with credentials, and the
admin cookie is `SameSite=Strict`, so Core and the admin app must share a registrable domain
(`api.example.com` and `app.example.com`). Keep `TRUST_PROXY_HOPS=1` behind Coolify's Traefik so
rate limits see the client IP.

Keep the embedding profile (`EMBEDDING_PROVIDER`/`EMBEDDING_MODEL`/`EMBEDDING_DIMENSIONS`) aligned
with the deployed `VECTOR(1536)` schema. A profile change needs a matching schema revision and a
complete staged reindex before it can go active — see the procedure in
[EMBEDDING_OPERATIONS.md](EMBEDDING_OPERATIONS.md); do not just flip the env var.
The Coolify compose fallback is `EMBEDDING_DIMENSIONS=1536`. On a fresh database, Core creates and
promotes the initial empty corpus during startup, so operators do not need to run a bootstrap
reindex before using Admin UI ingestion.

## Fresh schema rule

`infra/postgres/init.sql` is the canonical schema bootstrap. There is no runtime schema alignment
or migration framework in this clean-slate deployment — PostgreSQL only runs the bootstrap when its
data directory is empty, so editing `init.sql` never updates an existing volume.

A schema change therefore requires provisioning a genuinely new, empty PostgreSQL volume (the
compose volume key is `postgres_data_canonical` — changing/recreating that key is what forces a
fresh volume). Preserve the old volume as a rollback backup until the new stack is verified; never
attach both volumes to the same service.

Uploaded media files live on the separate `media_data` volume (`MEDIA_STORAGE_DIR=/data/media`).
A fresh database leaves the old files unreferenced and unreachable; recreate `media_data` with the
database volume to reclaim the space, then re-upload media through the admin library.

## Release checklist

1. Deploy the compose file and verify database, Redis, `app /health`, web `/`, and admin `/admin`.
2. Sign in to the admin app, open the web player, and confirm both work from their origins (see
   CORS above); a player token must get `403` on `/v1/admin/*`.
3. Seed/update the Scenario and Avatars with canonical content: run `pnpm seed:murder-party:api:prod`
   (or `:local` against a local stack) with the target API URL and `ADMIN_SERVICE_KEY` — it creates or updates the
   Scenario plus Avatars with their structured prompts, and is safe to rerun (it does not read or
   rewrite historical content).
4. Register `world` and `avatar_knowledge` sources with explicit visibility, and wait for
   each ingestion job to complete. Core initializes the empty active corpus automatically on the
   first startup.
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

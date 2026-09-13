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

## Configuration

Keep API secrets server-side. Browser `VITE_*` values are build-time and client-visible; treat
`VITE_API_KEY` as public exposure of the chosen Phase A API key. Configure the backend CORS origin
for every browser origin that must call the API.

Required production configuration includes `API_KEY_SECRET`, database/Redis connection values, and
the configured embedding credential/profile. LLM, Langfuse, Deepgram, Gradium, and CORS settings are
optional according to the enabled capabilities. See compose files and `.env.example` for the exact
current variable list.

Keep the embedding profile aligned with the deployed `VECTOR(16)` schema. Use the reindex procedure
in [EMBEDDING_OPERATIONS.md](EMBEDDING_OPERATIONS.md) before activating a new vector space.

## Fresh schema rule

`infra/postgres/init.sql` is the canonical schema bootstrap. There is no runtime schema alignment or
migration framework in the current clean-slate deployment. A schema change requires a new empty
PostgreSQL volume; preserve the old volume as a rollback backup until verification is complete.

## Release checklist

1. Deploy the compose file and verify database, Redis, `app /health`, web `/`, and admin `/admin`.
2. Confirm CORS and API-key behavior from both browser apps.
3. Seed/update the Scenario and Avatars with canonical language and prepared traits.
4. Register `world`, `avatar_knowledge`, and `media` sources with explicit visibility.
5. Wait for ingestion and verify retrieval before serving traffic.
6. Run the applicable deterministic and stack checks.

Do not attach an old unsupported volume, seed removed contracts, or activate incomplete content.

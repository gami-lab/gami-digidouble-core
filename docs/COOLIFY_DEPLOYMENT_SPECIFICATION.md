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

Managed internally by compose:

- `DATABASE_URL`
- `REDIS_URL`

Optional:

- `CORS_ORIGIN`
- `LLM_PROVIDER`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `MISTRAL_API_KEY`
- `XAI_API_KEY`
- `LANGFUSE_PUBLIC_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_BASE_URL`

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

`infra/postgres/init.sql` is the single canonical schema — there are no migration files. It uses `CREATE TABLE IF NOT EXISTS` and `ALTER ... ADD COLUMN IF NOT EXISTS`, which only ever add. It cannot drop columns, rename things, or change types on an existing database, and Postgres only runs its bootstrap script (`01-init.sql`) against an empty data volume. A normal redeploy after editing `init.sql` will **not** retroactively apply breaking schema changes to production — the old schema stays as-is.

To fully replace the production schema with a new, non-backward-compatible one (all data is lost — there is no rollback):

Coolify's dashboard treats compose volumes as read-only (Storages tab is view-only for compose-based resources — you cannot delete `postgres_data` from the UI), and this instance does not expose a per-resource or per-server Terminal tab. Reset the schema in place instead, using one of the two methods below.

### Method A — Pre-deployment command (preferred, no SSH needed)

Coolify resources have a **Pre-deployment Command** field (Configuration → General, under "Pre/Post Deployment Commands") that runs a command inside a named container before the new stack is brought up. Pre-deployment (not post-deployment) is required: it runs against the _currently running_ `postgres` container before `db-init` executes as part of the same deploy, so the rebuild happens automatically afterward. A post-deployment command would run too late — `db-init` and `app` would already be up against the old schema.

1. Push the updated `infra/postgres/init.sql` to the branch Coolify deploys from.
2. In the resource's Configuration → General, set:
   - **Pre-deployment command:** `psql -U postgres -d gami_core -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"`
   - **Container Name:** `postgres`
   - Click **Save**.
3. Click **Redeploy**. The pre-deployment command drops every table (and the `vector`/`pgcrypto` extensions) on the live database, then `db-init` runs against the now-empty `public` schema and rebuilds everything from the new canonical schema.
4. Check the deploy logs to confirm the pre-deployment step and `db-init` both completed, then verify `/health` and spot-check the new tables.
5. **Immediately clear the Pre-deployment command field and Save again.** It is a standing setting — left in place, it drops the schema on _every_ future deploy, including routine app-code pushes.

### Method B — SSH fallback

If the Pre-deployment Command field isn't available, SSH into the host Coolify manages this server through (see the server's **Private Key** section in Coolify for the key, and its **General** tab for the IP/user/port) and run the reset directly:

```
ssh root@<server-ip>
docker ps | grep postgres
docker exec -it <postgres-container-name> psql -U postgres -d gami_core -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

Then click **Redeploy** in Coolify so `db-init` rebuilds the schema from `init.sql`.

---

## Non-Negotiable Rule

`apps/console` is local-only tooling and must not be deployed in Coolify production.

---

## Admin App

`apps/admin` is deployed as the `admin` service in this same compose stack (see `Dockerfile.admin`), sharing this project's deployment history and rollback path with `app` and `web`. The production build is emitted for the `/admin/` path and the admin nginx config serves `/admin`, `/admin/`, and `/admin/assets/*` from the same static bundle. This was a deliberate simplicity tradeoff over an independent Coolify resource — revisit if admin's release cadence or blast-radius needs diverge enough to justify splitting it out.

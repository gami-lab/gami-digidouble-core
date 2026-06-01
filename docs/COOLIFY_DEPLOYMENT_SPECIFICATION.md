# Coolify Deployment Specification

## Purpose

Define the production deployment shape for Gami DigiDouble Core on Coolify.

This document covers:

1. Backend deployment (`core` + PostgreSQL + Redis)
2. Public frontend deployment (`web`)
3. Environment variable ownership and domain routing

---

## Decision (Current)

### Repository model

Use one monorepo.

- `apps/core` -> backend API runtime
- `apps/web` -> public user frontend
- `apps/console` -> local debug UI only (never deployed to production)
- `packages/shared` -> shared contracts/types

### Coolify model

Use two separate Coolify projects per environment.

- Project A: Backend stack
- Project B: Public web app

This is the approved deployment model for current scope.

---

## Why Two Projects

Two-project deployment gives clearer runtime ownership and safer rollouts than a single all-in-one project.

Benefits:

- Independent deploy/rollback history for API and Web
- Clear domain ownership (`api` vs `app`)
- Reduced operational coupling between backend and frontend releases
- Simpler troubleshooting boundaries

Tradeoff:

- Some environment variables are duplicated between projects by design

---

## Deployment Topology

### Project A: Backend stack

Compose file: `docker-compose.coolify.yml`

Services:

- `app` (`core` API)
- `postgres`
- `redis`
- `db-init` one-shot schema initializer

Domain:

- `api.example.com` -> `app` service

### Project B: Public web app

Compose file: `docker-compose.coolify.web.yml`

Service:

- `web` static app container (nginx)

Domain:

- `app.example.com` -> `web` service

---

## File Mapping

Backend project files:

- `docker-compose.coolify.yml`
- `Dockerfile`

Web project files:

- `docker-compose.coolify.web.yml`
- `Dockerfile.web`
- `infra/nginx/web.conf`

---

## Environment Variable Ownership

### Backend project (`core`)

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

### Web project (`web`)

Required build arguments:

- `VITE_API_URL`
- `VITE_API_KEY`

Important:

- `VITE_*` values are embedded at build time in Vite static builds.
- `VITE_API_KEY` is client-visible in browser bundles. This is acceptable only if that key is intentionally public-scoped.

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

### 1. Deploy backend project first

- Create/update Project A using `docker-compose.coolify.yml`
- Configure domain for `app` service (API domain)
- Set required env var `API_KEY_SECRET`
- Deploy and verify `GET /health`

### 2. Deploy web project second

- Create Project B using `docker-compose.coolify.web.yml`
- Configure domain for `web` service (public app domain)
- Set `VITE_API_URL` to backend public domain
- Set `VITE_API_KEY` to the API key expected by backend
- Deploy and open web domain root (`/`)

### 3. CORS alignment

Set backend `CORS_ORIGIN` so browser requests from `app.example.com` to `api.example.com` are allowed.

---

## Non-Negotiable Rule

`apps/console` is local-only tooling and must not be deployed in Coolify production.

---

## Future Extension (Admin App)

If `apps/admin` is introduced later, deploy it as an independent runtime surface (own Coolify application or project), with its own domain and rollback path.

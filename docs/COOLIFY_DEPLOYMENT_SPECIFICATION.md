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
- `postgres`
- `redis`
- `db-init` one-shot schema initializer

Domain:

- `api.example.com` -> `app` service
- `app.example.com` -> `web` service

---

## File Mapping

Project files:

- `docker-compose.coolify.yml`
- `Dockerfile`
- `Dockerfile.web`
- `infra/nginx/web.conf`

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
- Configure domains for both `app` and `web` services in the same project
- Set required env vars `API_KEY_SECRET` and `VITE_API_URL`
- Deploy and verify both `/health` (API) and `/` (web)

### 2. CORS alignment

Set backend `CORS_ORIGIN` so browser requests from `app.example.com` to `api.example.com` are allowed.

---

## Non-Negotiable Rule

`apps/console` is local-only tooling and must not be deployed in Coolify production.

---

## Future Extension (Admin App)

If `apps/admin` is introduced later, deploy it as an independent runtime surface (own Coolify application or project), with its own domain and rollback path.

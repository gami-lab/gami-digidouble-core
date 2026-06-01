# Coolify Deployment Specification

## Purpose

Define the production deployment shape for Gami DigiDouble Core when using Coolify, and define the recommended repository structure for the future frontend split.

This document answers two questions:

1. How should the current backend be deployed in Coolify?
2. How should the repo host three deployable apps in the same monorepo without turning the debug console into a production dependency?

---

## Repository Analysis

Current repository state:

- Backend API lives in `apps/core`
- Manual debug console lives in `apps/console`
- Shared code lives in `packages/shared`
- PostgreSQL schema lives in `infra/postgres/init.sql`
- Monorepo tooling already supports multiple apps through pnpm workspaces and Turborepo

Relevant existing conventions:

- The backend is the production runtime
- The debug console is a local/manual test surface, not a customer-facing product
- The repo already assumes Docker Compose for backend deployment
- The core app expects `DATABASE_URL`, `REDIS_URL`, and `API_KEY_SECRET`

Conclusion:

- The repo is already structured as a monorepo that can host multiple deployable apps
- The best production model is not one giant frontend, but multiple independently deployed apps inside the same repo

---

## Recommendation

### Use one monorepo, not three repositories

Keep all backend and frontend code in one repository so shared contracts, types, and API clients stay synchronized.

### Use one Coolify project per environment

For production, create one Coolify project that contains the services for that environment.

### Use three application resources inside that project

Create three deployable app resources in the same Coolify project:

- `core` — backend API
- `admin` — internal/admin frontend
- `web` — public user frontend

This is the best balance of isolation and operational simplicity.

---

## Why This Is the Best Setup

### Why not 3 Coolify projects?

Three separate projects would work, but they create avoidable overhead:

- duplicate environment variables
- duplicate domain and proxy setup
- harder coordination of releases across backend and both frontends
- more places for drift in shared API contracts

### Why not one single deployable app?

A single app would couple unrelated concerns:

- backend release cadence would be tied to frontend release cadence
- admin and public UI would compete for the same build and runtime shape
- the debug console would be tempting to deploy accidentally

### Why one project with three apps is better

- each app can be deployed independently
- each app can have its own domain and build settings
- all apps still share the same repo, contracts, and CI logic
- the production footprint stays understandable

---

## Current and Future App Layout

### Current layout

- `apps/core` — backend API, production deployment target
- `apps/web` — public user frontend (Phase A implementation in progress)
- `apps/console` — debug/manual test console, local only

### Target layout

- `apps/core` — backend API
- `apps/admin` — admin frontend
- `apps/web` — public user frontend
- `apps/console` — remains local-only debug tooling

### Rule

`apps/console` must not be deployed in Coolify.

It is a debugging and manual test surface, not a production product surface.

---

## Deployment Topology

### Production Coolify project

One production project should contain:

- `core` app service
- `admin` app service
- `web` app service
- optional infrastructure services if not externally managed

### Infrastructure services

For the current backend architecture, PostgreSQL and Redis should be deployed alongside the backend when using a self-contained stack.

If later moved to managed infrastructure, keep the app services the same and only change their connection strings.

---

## Service Ownership

| Service    | Responsibility                                                          | Coolify Resource Type     |
| ---------- | ----------------------------------------------------------------------- | ------------------------- |
| `core`     | API, runtime orchestration, scenarios, sessions, memory, knowledge      | Application               |
| `admin`    | operational/admin UI, debugging, content management, session inspection | Application               |
| `web`      | public user experience UI                                               | Application               |
| `postgres` | persistent relational storage                                           | Service / Compose service |
| `redis`    | cache, session, temporary runtime state                                 | Service / Compose service |

---

## Suggested Repo Structure

The repository should evolve toward this shape:

```text
apps/
  core/      -> backend API
  admin/     -> admin frontend
  web/       -> public user frontend
  console/    -> debug console, local only
packages/
  shared/    -> shared contracts, DTOs, utilities
  ui/        -> optional shared UI primitives later
  config/    -> optional shared lint/ts/vite config later
```

### Notes

- `apps/admin` and `apps/web` can share packages from `packages/shared`
- `apps/console` should remain isolated from production routing and deployment
- If the two frontends share UI primitives later, extract them to `packages/ui`

---

## Build and Runtime Model

### Backend

- Build from `Dockerfile`
- Runtime command: `node apps/core/dist/index.js`
- Exposes port `3000`
- Requires `DATABASE_URL`, `REDIS_URL`, `API_KEY_SECRET`

### Admin frontend

- Build as a static frontend app
- Output should be served by a static host or a minimal web server container
- Runtime should only need frontend env variables
- Must talk to `core` through the public API domain

### Public frontend

- Build as a static frontend app
- Output should be served by a static host or a minimal web server container
- Runtime should only need frontend env variables
- Must talk to `core` through the public API domain

### Debug console

- Build and run locally only
- Should not be added to Coolify production routing
- Can stay useful for manual testing and development

---

## Coolify Deployment Model

### One Coolify project per environment

Use one project for production and, if needed later, one project for staging.

### Three app resources inside the project

Each frontend/backend should be its own Coolify application resource.

This allows:

- separate deployments
- separate rollback history
- separate domains
- separate environment variables
- separate scaling decisions later

### Recommended domain layout

- `api.example.com` -> `core`
- `admin.example.com` -> `admin`
- `app.example.com` -> `web`

The exact domain names can vary, but the separation should stay the same.

---

## Environment Variable Ownership

### `core`

Required:

- `DATABASE_URL`
- `REDIS_URL`
- `API_KEY_SECRET`

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

### `admin`

Required:

- `VITE_API_URL`
- `VITE_API_KEY`

Optional:

- feature flags for admin-only UI behavior

### `web`

Required:

- `VITE_API_URL`

Optional:

- public feature flags
- analytics keys

### `console`

Local only:

- `VITE_API_URL`
- `VITE_API_KEY`

Do not set up `apps/console` as a Coolify production application.

---

## Shared Contract Strategy

The key reason to keep one monorepo is to share contracts safely.

### Shared items should live in `packages/shared`

Examples:

- API DTOs
- route request/response types
- reusable validation contracts
- enum values and shared constants

### Frontends should not re-declare backend contracts

Both `admin` and `web` should consume shared types or generated API clients, not copy/paste request shapes.

This reduces drift and makes contract changes visible during typecheck/build.

---

## Build Isolation Rules

Each app must be buildable on its own.

### Required rule

A build failure in `admin` must not block `web` unless they truly share code that changed.

### Required rule

The backend must not import frontend-only code.

### Required rule

The debug console must not be required for production deploys.

---

## Suggested Coolify App Mapping

### `core` app

- Source: same repository
- Build pack: Docker Compose or Dockerfile depending on the deployment shape
- Public exposure: yes
- Domain: API domain

### `admin` app

- Source: same repository
- Build pack: Dockerfile or static frontend deployment depending on chosen frontend framework
- Public exposure: yes, but restricted to internal/admin users at the product layer
- Domain: admin domain

### `web` app

- Source: same repository
- Build pack: Dockerfile or static frontend deployment depending on chosen frontend framework
- Public exposure: yes
- Domain: public app domain

### `console` app

- Source: same repository
- Deployment: none in Coolify
- Use locally only for manual testing and debugging

---

## Naming Convention

Use names that distinguish runtime purpose, not implementation detail.

Recommended names:

- `core`
- `admin`
- `web`
- `console`

Avoid names like:

- `frontend1`
- `frontend2`
- `ui-new`
- `debug-ui-prod`

---

## Operational Notes

### Deploy order

1. Deploy infrastructure if needed
2. Deploy `core`
3. Deploy `admin`
4. Deploy `web`

### Dependency rule

`admin` and `web` depend on `core` only through the public API, not through direct service-to-service coupling.

### Rollback rule

Rollback should be possible per app.

---

## Decision Summary

### Recommended answer to the project-vs-app question

- Use **one monorepo**
- Use **one Coolify project per environment**
- Use **three app resources** inside the project for the production surfaces
- Keep `apps/console` out of Coolify

### Why

This gives the best tradeoff between:

- shared code reuse
- independent deployments
- clean rollback boundaries
- operational simplicity
- keeping the debug console out of production

---

## Open Items

This spec assumes the future frontend split will be implemented later.

The next implementation decision is whether `admin` and `web` are:

1. two separate Vite apps
2. two Next.js apps
3. one app with role-based routing and separate deployment targets

For Coolify and deployment simplicity, they should still be separate deployable apps even if they share UI packages.

# Build Local Docker Stack for App, PostgreSQL, and Redis

## Context

EPIC 1.1 requires a reproducible local runtime that every developer can start quickly. This prompt establishes the infrastructure baseline that later EPICs rely on for persistence, caching, and integration testing.

## Scope

What must be implemented now:
- Add local Docker Compose stack for app service, PostgreSQL with pgvector capability, and Redis.
- Define local networking, health checks, and startup dependencies.
- Add environment variable contract for local development.
- Ensure one-command startup and teardown workflow.

What is out of scope:
- Production-grade orchestration.
- Cloud deployment manifests.
- Full security hardening beyond local baseline.
- Advanced autoscaling or high-availability concerns.

## Relevant Docs

- `docs/EPICS.md` (EPIC 1.1 includes Docker local stack)
- `docs/TECH_STACK.md` (PostgreSQL + pgvector + Redis)
- `docs/ARCHITECTURE.md` (replaceable infrastructure, modular monolith)
- `docs/DATA_MODEL.md` (database assumptions)
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Create `docker-compose.yml` (or equivalent) with three services: app, postgres, redis.
- Use explicit container names, ports, volumes, and health checks to avoid hidden behavior.
- Ensure postgres image/setup supports pgvector extension initialization.
- Add environment template (`.env.example`) with required variables and safe defaults.
- Provide local lifecycle scripts (for example `infra:up`, `infra:down`, `infra:logs`).
- Make startup deterministic: app should wait for dependency readiness.
- Keep app container config minimal; avoid adding unrelated dev tools in image.

Testing guidance:
- Validate service reachability from app runtime.
- Validate postgres and redis data persistence behavior for local restarts.

## Constraints

Respect:
- Architecture separation (infra concerns isolated from domain logic).
- KISS and local-first reliability.
- DRY environment configuration.
- Backward compatibility with future CI and integration-test usage.
- Explicit contracts for environment variables and service ports.

## Deliverables

- Docker Compose stack with app + postgres + redis.
- Environment contract file and setup notes.
- Local scripts for infra start/stop/logs.
- Verified pgvector readiness path for future RAG EPICs.

## Mandatory Final Step — Documentation Update

After implementation, review and update:
- `docs/PROJECT_STATUS.md`
- Any impacted outdated docs, especially:
  - `docs/TECH_STACK.md`
  - `docs/DATA_MODEL.md`
  - `docs/ARCHITECTURE.md`
  - `README.md`

If no doc changes are needed, explicitly verify docs are still accurate.

## Acceptance Criteria

- `docker compose up` brings all required services up locally.
- App can connect to PostgreSQL and Redis with documented env vars.
- pgvector capability is initialized or initialization path is documented and testable.
- Developers can stop and restart stack without manual cleanup steps.
- Documentation accurately describes local infra usage.

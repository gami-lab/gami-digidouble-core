# 01 — Scenario Domain and Endpoint

## Context

The `Scenario` domain type already exists at `domain/scenario/scenario.types.ts`, but there is
no persistence port, no in-memory implementation, no use case, and no HTTP endpoint for it.

EPIC 2.2 requires that an operator can create a Scenario via API before attaching an Avatar to it.
The Scenario is the container entity — Avatar and Session both reference it by `scenarioId`.

This is the first step because the Avatar creation use case (Prompt 02) will validate that
the referenced scenario exists, requiring `IScenarioRepository` to be in place.

---

## Scope

**In scope:**

- `IScenarioRepository` application port — `create` and `findById`
- `InMemoryScenarioRepository` implementing that port
- `CreateScenarioUseCase` — validates input, generates ID, persists, returns scenario
- `POST /v1/scenarios` Fastify route plugin (`scenariosRoute`)
- `IScenarioRepository` added to `ServerAdapters` in `api/server.ts`
- `scenariosRoute` registered in `createServer()` under `/v1/scenarios`
- `scenarios.test.ts` — unit/API inject tests
- `scenarios.stack-e2e.test.ts` — auth, validation, and **full 200 happy path** (no pre-seeded
  data needed — create is self-contained)

**Out of scope:**

- `GET /v1/scenarios` (list) — deferred; not required for EPIC 2.2 DoD
- `GET /v1/scenarios/:scenarioId` (get single) — deferred; only needed if back-office reads it
- `PUT /v1/scenarios/:scenarioId` (update) — deferred
- Slug uniqueness enforcement — deferred; no scenario list yet
- Any knowledge source or feature flag wiring
- PostgreSQL repository — in-memory only for Sprint 2

---

## Relevant Docs

- `docs/API_CONTRACT.md` §8 — `POST /v1/scenarios` request and response shapes
- `docs/DATA_MODEL.md` §2 — Scenario entity fields
- `docs/ARCHITECTURE.md` — 4-layer separation (no domain logic in routes, no infra in domain)
- `apps/core/src/domain/scenario/scenario.types.ts` — existing domain type
- `apps/core/src/application/ports/ISessionRepository.ts` — model to follow for new port
- `apps/core/src/infrastructure/db/in-memory-session.repository.ts` — model to follow for in-memory impl
- `apps/core/src/api/routes/messages.ts` — model to follow for Fastify plugin structure
- `apps/core/src/api/routes/exchange.stack-e2e.test.ts` — model for stack-e2e test structure

---

## Implementation Guidance

### 1. IScenarioRepository Port

Create `application/ports/IScenarioRepository.ts`.

Required methods:

- `create(params: CreateScenarioParams): Promise<Scenario>`
- `findById(scenarioId: string): Promise<Scenario | null>`

`CreateScenarioParams` should carry: `name`, `slug`, `status?` (default `'draft'`), `config?`.

Import `Scenario` from `domain/scenario/scenario.types.ts`.

### 2. InMemoryScenarioRepository

Create `infrastructure/db/in-memory-scenario.repository.ts`.

- Implements `IScenarioRepository`
- Backed by a `Map<string, Scenario>`
- Constructor accepts `Scenario[]` initial data (same pattern as InMemorySessionRepository)
- `create()` generates ID `scenario_${crypto.randomUUID()}`, sets `createdAt`/`updatedAt` to `new Date().toISOString()`
- `findById()` returns `null` if not found

### 3. CreateScenarioUseCase

Create `application/use-cases/create-scenario/create-scenario.types.ts` and
`application/use-cases/create-scenario/create-scenario.use-case.ts`.

Input DTO:

```
name: string        — required, non-empty
slug: string        — required, non-empty, lowercase alphanumeric + hyphens only
status?: string     — optional, defaults to 'draft'
config?: object     — optional, passed through
```

Validation rules:

- Blank `name` or `slug` → throw `DomainError('VALIDATION_ERROR', '...')`
- `slug` must match `/^[a-z0-9-]+$/` → throw `DomainError('VALIDATION_ERROR', '...')`
- `status` if provided must be `'draft' | 'active' | 'archived'` → throw on invalid value

Output DTO mirrors `ScenarioSummary` from API_CONTRACT: `scenarioId`, `name`, `slug`, `status`,
`createdAt`, `updatedAt`, plus `config`.

The use case constructor takes `IScenarioRepository` as its only dependency.

### 4. scenariosRoute Fastify Plugin

Create `api/routes/scenarios.ts`.

Mount `POST /` with:

- `authenticateApiKey` pre-handler (same pattern as `messagesRoute`)
- Fastify JSON schema body validation: `name` (string, minLength 1), `slug` (string, minLength 1,
  pattern `^[a-z0-9-]+$`), `status` (enum optional), `config` (object optional)
- `CreateScenarioUseCase` wiring
- On `DomainError` with code `VALIDATION_ERROR` → `400`
- On success → `201` with `ApiResponse<CreateScenarioResponse>`

Note: Use `201 Created` for this endpoint, not `200`.

Route options type follows the same pattern as `MessagesRouteOptions` in `messages.ts`, injecting
config + adapter overrides.

### 5. server.ts Updates

In `ServerAdapters`, add:

```
scenarioRepository?: IScenarioRepository
```

In `createServer()`, pass `scenarioRepository` into `scenariosRoute` options.
Register `scenariosRoute` under prefix `/v1/scenarios`.

When no `scenarioRepository` is provided, default to `new InMemoryScenarioRepository()`.

### 6. scenarios.test.ts

Create `api/routes/scenarios.test.ts` using `createServer()` + `app.inject()`.

Test blocks:

- **Auth** — no key → 401, wrong key → 401
- **Validation** — missing `name` → 400, missing `slug` → 400, invalid `slug` pattern → 400,
  unknown `status` value → 400
- **Success** — valid body → 201, response envelope has `data.scenario.scenarioId`, `data.error === null`

### 7. scenarios.stack-e2e.test.ts

Create `api/routes/scenarios.stack-e2e.test.ts`.

Unlike most stack-e2e tests, this one **can include a full 200/201 happy-path test** because
scenario creation needs no pre-seeded data.

Sections:

- **Auth** — no key → 401, wrong key → 401
- **Validation** — missing `name` → 400, missing `slug` → 400, invalid `slug` → 400
- **Success** — valid create → 201, assert `data.scenario.scenarioId` starts with `scenario_`,
  assert `data.scenario.status === 'draft'`

Follow `exchange.stack-e2e.test.ts` for test structure, `APP_URL`/`API_KEY` setup, and
`describe` naming convention.

---

## Constraints

- Domain layer only uses other domain types — no infrastructure imports
- Use case layer only imports from `application/ports/` and `domain/` — no infrastructure
- Route imports only from `application/` and `infrastructure/` — never from `domain/` directly
- TypeScript strict mode — no `any`, no implicit types
- `IScenarioRepository` must be an interface, not a class — it defines the port boundary
- `CreateScenarioUseCase` must not import `InMemoryScenarioRepository`
- Stack-e2e tests are real HTTP calls — no `app.inject()`, no mocks

---

## Deliverables

- `application/ports/IScenarioRepository.ts`
- `infrastructure/db/in-memory-scenario.repository.ts`
- `application/use-cases/create-scenario/create-scenario.types.ts`
- `application/use-cases/create-scenario/create-scenario.use-case.ts`
- `api/routes/scenarios.ts`
- `api/routes/scenarios.test.ts`
- `api/routes/scenarios.stack-e2e.test.ts`
- `api/server.ts` updated (`scenarioRepository` in `ServerAdapters`, route registration)

---

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — mark `IScenarioRepository` and `POST /v1/scenarios` as done
- `docs/API_CONTRACT.md` §8 — verify Create Scenario section is still accurate; add any Sprint 2
  implementation notes (e.g., slug uniqueness not yet enforced)
- `docs/DATA_MODEL.md` §2 — confirm Scenario fields match the implemented `Scenario` type

If no doc changes are needed, explicitly verify docs are still accurate.

---

## Acceptance Criteria

- [ ] `IScenarioRepository` port exists with `create` and `findById`
- [ ] `InMemoryScenarioRepository` implements the port; constructor accepts initial data
- [ ] `CreateScenarioUseCase` validates name, slug, and status; throws `DomainError` on invalid input
- [ ] `POST /v1/scenarios` returns `201` on success with `data.scenario.scenarioId`
- [ ] `POST /v1/scenarios` returns `401` with no or wrong API key
- [ ] `POST /v1/scenarios` returns `400` on missing/invalid body fields
- [ ] `scenarioRepository` is in `ServerAdapters` and wired through `createServer()`
- [ ] `scenarios.test.ts` covers auth, validation, and success
- [ ] `scenarios.stack-e2e.test.ts` covers auth, validation, and 201 happy path
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass

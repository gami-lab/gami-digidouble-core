# 04 — Stack-E2E Contract Tests for Admin Endpoints

## Context

EPIC 2.6 introduces two new HTTP endpoints under `/v1/admin/sessions`. Per the project's
non-negotiable rule, every new endpoint must have a `*.stack-e2e.test.ts` file covering auth,
schema validation, resource-not-found, and at least one happy-path case.

This prompt covers the full stack-e2e test file for both admin endpoints created in prompts 02 and 03.

## Scope

### In scope

- New file: `apps/core/src/api/routes/admin-sessions.stack-e2e.test.ts`
- Auth tests (no key, wrong key → `401`) for both endpoints
- Schema / query param validation tests (`400`) for events `limit` param
- Not-found tests (`404`) for both endpoints with unknown session IDs
- Happy-path tests that seed a minimal session + GM event and verify response shape
- Verify that the response for `/inspect` contains no raw message content
- Verify that `/events` only returns `gm_triggered` / `gm_skipped` type events

### Out of scope

- Full conversation/GM trigger flows — happy-path seeds minimal data directly
- Load / performance tests
- Console UI tests

## Relevant Docs

- `docs/API_CONTRACT.md` — endpoint contracts added in prompts 02 and 03
- `apps/core/src/api/routes/exchange.stack-e2e.test.ts` — pattern to follow
- `apps/core/src/api/routes/sessions-admin.stack-e2e.test.ts` — seeding pattern to follow
- `docs/TEST_STRATEGY.md` — stack-e2e test rules

## Implementation Guidance

### Test file location

```
apps/core/src/api/routes/admin-sessions.stack-e2e.test.ts
```

### Structure

Use the same pattern as `sessions-admin.stack-e2e.test.ts`:

- `beforeAll` / `afterAll` to start/stop the Fastify server with real infrastructure adapters
- Shared `seed` helper to create a scenario, avatar, and session
- Separate `describe` blocks per endpoint

### Auth tests (both endpoints)

```ts
describe('GET /v1/admin/sessions/:id/inspect — auth', () => {
  it('returns 401 when API key is missing', ...)
  it('returns 401 when API key is wrong', ...)
})

describe('GET /v1/admin/sessions/:id/events — auth', () => {
  it('returns 401 when API key is missing', ...)
  it('returns 401 when API key is wrong', ...)
})
```

### Not-found tests

```ts
describe('GET /v1/admin/sessions/:id/inspect — not found', () => {
  it('returns 404 for unknown sessionId', ...)
})

describe('GET /v1/admin/sessions/:id/events — not found', () => {
  it('returns 404 for unknown sessionId', ...)
})
```

### Validation tests (events endpoint)

```ts
describe('GET /v1/admin/sessions/:id/events — validation', () => {
  it('returns 400 when limit is not a valid integer', ...)
  it('returns 400 when limit is negative', ...)
})
```

### Happy-path tests

For `/inspect`:

- Seed a session with a known `scenarioId` and `userId`
- Call the endpoint
- Assert `inspect.session.sessionId` matches seeded session
- Assert `inspect.gmState` is `null` (no GM run yet) or a valid GM state shape
- Assert `inspect.transitionHistory` is an array
- Assert response contains no `content` field (no message text)

For `/events`:

- Seed a session; if it is impractical to trigger a real GM run, insert a raw event via the
  repository adapter during test setup
- Call the endpoint
- Assert events ordered newest-first
- Assert event type is `gm_triggered` or `gm_skipped`
- Assert `limit` param is respected (seed >1 events, request `?limit=1`, assert length 1)

### Seeding note

If seeding a GM event during tests is complex, use a `// TODO(EPIC-2.6): happy-path deferred`
comment only for the `/events` happy-path. Do not defer auth, not-found, or validation tests.

## Constraints

- Follow file naming convention: `<route-name>.stack-e2e.test.ts`
- Must be excluded from `vitest.config.ts` include pattern (add to `test.exclude` and
  `coverage.exclude` if not already matched by the existing `*.stack-e2e.test.ts` exclude)
- Verify the file is excluded — check `vitest.config.ts` and `vitest.stack-e2e.config.ts`
- Max function length: 100 lines — split long test helpers into named functions

## Deliverables

- `apps/core/src/api/routes/admin-sessions.stack-e2e.test.ts`
- Confirm stack-e2e exclusion in vitest config files if not already covered

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/PROJECT_STATUS.md` — note stack-e2e test coverage added for EPIC 2.6 admin endpoints

## Acceptance Criteria

- [ ] Auth tests exist for both endpoints
- [ ] Not-found tests exist for both endpoints
- [ ] Validation test for `limit` param exists on events endpoint
- [ ] Happy-path test (or `TODO` comment) exists for both endpoints
- [ ] File excluded from standard `vitest.config.ts` run
- [ ] File included in `vitest.stack-e2e.config.ts`
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass (stack-e2e file not run by default)

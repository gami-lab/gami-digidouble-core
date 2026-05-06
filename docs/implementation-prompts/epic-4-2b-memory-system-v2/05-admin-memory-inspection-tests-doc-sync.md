# Admin Memory Inspection, Hardening, And Documentation Sync

## Context

By the end of the previous prompts, Memory v2 exists internally. This final slice makes it
operable and closes the EPIC with consumer-visible inspection, hardening, tests, and doc sync.

The current admin surface only exposes `GET /v1/admin/sessions/{sessionId}/memory` with a compact
summary. That is not enough to inspect layered memory independently.

## Scope

**In scope:**

- add or evolve an admin memory inspection surface that exposes layered memory explicitly
- keep existing summary behavior backward compatible
- add route tests, stack-e2e coverage, and hardening checks
- close the EPIC with full documentation sync

**Out of scope:**

- player-facing UX for memory
- RAG / Context Engine v2 / replay tooling

## Relevant Docs

- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/PROJECT_STATUS.md`
- current admin route references:
  - `apps/core/src/api/routes/admin-memory.ts`
  - `apps/core/src/api/routes/admin-memory.test.ts`
  - `apps/core/src/api/routes/admin-session-memory.stack-e2e.test.ts`

## Mandatory Pre-Implementation Check

1. Identify touched entities/contracts:
   - existing `SessionMemorySummary`
   - any new admin DTO for layered memory inspection
   - route options / server adapter wiring
2. Search for duplicated admin response shapes in route tests, console code, or shared package.
3. Confirm the canonical owner of every API-facing memory DTO.
4. Reuse existing shared DTO ownership where possible.
5. If a richer endpoint requires a new shared type, create one instead of repeating inline shapes.

## Implementation Guidance

1. Keep `GET /v1/admin/sessions/{sessionId}/memory` backward compatible. It should continue to
   return the compact summary contract, but it should now derive from the canonical Memory v2
   stores rather than only `sessions.memory_summary`.

2. Add one dedicated admin inspection endpoint for layered memory details, for example:
   - `GET /v1/admin/sessions/{sessionId}/memory-layers`

   Exact naming is up to implementation, but keep it explicit and admin-scoped.

3. The detailed admin response should expose enough to inspect the pyramidal system without leaking
   raw transcripts or prompt internals. A practical response shape is:
   - short-term preview (bounded recent exchanges)
   - session working memory summary
   - avatar working memories for the session
   - long-term user facts (bounded or full list, whichever the admin contract chooses explicitly)

4. If the detailed route introduces a new HTTP endpoint, add:
   - route/unit tests
   - `*.stack-e2e.test.ts` covering at minimum:
     - missing API key → 401
     - wrong API key → 401
     - validation / malformed sessionId if applicable → 400
     - unknown session → 404
     - happy path → 200 with correct `ApiResponse<T>` envelope

5. Add hardening tests for:
   - session reset clears session/avatar working memory
   - session reset does not delete `user_memory_facts`
   - long conversations still bound short-term memory to 2 exchanges
   - memory maintenance failure does not break send-message / close flows
   - GM and Avatar memory assembly stay in sync on layer ownership

6. Run the required quality gates:
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm test:coverage` (or the repo-equivalent coverage command)

## Constraints

- keep existing admin summary route backward compatible
- any new endpoint must ship with stack-e2e coverage in this EPIC
- admin inspection should expose memory layers, not raw full transcripts
- no prompt or credential leakage in admin responses
- code, tests, and docs move together; no silent drift

## Deliverables

- backward-compatible summary route behavior on top of Memory v2 storage
- one detailed admin memory inspection route for layered memory
- route tests and stack-e2e coverage for any new endpoint
- hardening tests for reset and failure isolation
- full doc sync across status, model, API, GM contract, and coverage plan

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md` if tier expectations changed
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md` only if EPIC wording/progress notes need alignment

If no doc changes are needed for any item above, explicitly verify that the current docs are still
accurate.

## Acceptance Criteria

- [ ] existing admin memory summary remains backward compatible
- [ ] layered memory can be inspected through an explicit admin surface
- [ ] any new endpoint has route tests and stack-e2e coverage
- [ ] reset semantics for working vs long-term memory are verified by tests
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and coverage checks pass
- [ ] docs are fully synced and EPIC 4.2b is marked accurately in project status when complete

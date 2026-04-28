# EPIC 2.6 — GM Debug Panel v1 + Observability APIs

## Objective

Make Game Master orchestration visible and testable during Scenario Test Bench sessions.

Add three admin-safe HTTP endpoints exposing session inspection, GM state, and event history.
Add a GM Debug Panel to the console's Scenario Test Bench that displays trigger history, unlocks,
transitions, GM notes, and active avatar state after each turn.

## Generated

April 28, 2026

## Prompt Files — Ordered Execution List

| #   | File                      | Description                                                                     | Depends On |
| --- | ------------------------- | ------------------------------------------------------------------------------- | ---------- |
| 1   | `01-events-repository.md` | Extend `IEventLogRepository` with `findBySessionId`, update all implementations | —          |
| 2   | `02-inspect-endpoint.md`  | `GET /v1/admin/sessions/{sessionId}/inspect` endpoint + use case                | 1          |
| 3   | `03-events-endpoint.md`   | `GET /v1/admin/sessions/{sessionId}/events` endpoint + use case                 | 1          |
| 4   | `04-stack-e2e-tests.md`   | Stack-e2e contract tests for all new admin endpoints                            | 2, 3       |
| 5   | `05-console-gm-panel.md`  | GM Debug Panel component in Scenario Test Bench console                         | 2, 3       |
| 6   | `06-doc-sync.md`          | Update API_CONTRACT.md, GAME_MASTER_CONTRACT.md, PROJECT_STATUS.md              | 1–5        |

## Dependencies Between Prompts

- Prompt 1 is a prerequisite for prompts 2 and 3 (both use the extended repository port)
- Prompts 2 and 3 are independent of each other and can be implemented in parallel
- Prompt 4 requires prompts 2 and 3 to be complete (tests call both endpoints)
- Prompt 5 requires prompts 2 and 3 to exist (console calls both APIs)
- Prompt 6 (doc sync) must be done last

## Suggested Execution Order

1 → 2 → 3 → 4 → 5 → 6

## Definition of Done (Full EPIC)

- [ ] `IEventLogRepository.findBySessionId(sessionId, opts?)` implemented in all three adapters (interface, in-memory, Postgres)
- [ ] `GET /v1/admin/sessions/{sessionId}/inspect` returns session summary + GM state snapshot + transition history
- [ ] `GET /v1/admin/sessions/{sessionId}/events` returns GM events ordered newest-first with optional `limit` param
- [ ] Both endpoints enforce API key auth (`401` on missing/wrong key)
- [ ] Both endpoints return `404` for unknown session IDs
- [ ] Stack-e2e tests cover auth, schema validation, not-found, and happy-path for both endpoints
- [ ] No sensitive prompt content or raw user messages in any API response
- [ ] GM Debug Panel visible in Scenario Test Bench; refreshes after each turn
- [ ] Panel displays: active avatar, unlocked avatars, GM notes, transition history, recent GM events
- [ ] `docs/API_CONTRACT.md` updated with both new endpoint contracts
- [ ] `docs/GAME_MASTER_CONTRACT.md` §14 updated to mark endpoint as implemented
- [ ] `docs/PROJECT_STATUS.md` updated with EPIC 2.6 completion
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm test:coverage` all pass

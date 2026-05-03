# 02 — Explicit Conversation End Endpoint

## Context

EPIC 2.2b requires a reliable explicit end signal so operators/clients can close a conversation deterministically. This is the anchor event for memory compaction and lifecycle state transitions.

## Scope

In scope:

- Implement/complete explicit close flow for conversation end API.
- Ensure lifecycle state updates are consistent:
  - conversation `status` to closed
  - `endedAt` timestamp set
  - close `reason` persisted
  - session/conversation last-activity semantics preserved
- Ensure API responses use canonical `ApiResponse<T>` envelope and shared DTOs.
- Add/extend unit + integration tests for close behavior.
- Add/extend stack-e2e route tests for auth/validation/not-found and happy path where feasible.

Out of scope:

- Implicit end heuristics.
- Deep compaction algorithm (handled in next prompt).

## Relevant Docs

- `docs/API_CONTRACT.md` (conversation lifecycle endpoints)
- `docs/DATA_MODEL.md` (session/conversation fields)
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Check current endpoint path and align implementation exactly with contract.
- Route layer responsibilities:
  - schema validation
  - auth hook enforcement
  - error mapping to envelope codes
- Application layer responsibilities:
  - validate state transition (`active` -> `closed` only)
  - idempotency policy (define and test: either no-op success or deterministic error)
- Repository updates should be minimal and explicit; do not leak route concerns into repositories.
- Ensure close reason vocabulary is bounded and documented.
- Prefer extension of existing conversation lifecycle use-case structure over introducing parallel handlers.

## Constraints

- Keep endpoint contract backward compatible unless docs are explicitly updated in same change.
- No provider-specific logic in lifecycle flow.
- Deterministic state transitions and timestamps.

## Deliverables

- End-conversation route/use-case/repository wiring.
- Unit tests for state transition correctness and failure paths.
- Integration tests for API envelope and persistence effect.
- Stack-e2e file for endpoint behavior.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

## Acceptance Criteria

- [ ] Explicit close endpoint behavior matches documented contract.
- [ ] Auth/validation/not-found/state-transition behavior is tested.
- [ ] Stack-e2e test file exists and covers required baseline cases.
- [ ] Persistence reflects closed state (`status`, `endedAt`, `reason`).
- [ ] Contracts reused from canonical owners (no new duplication).

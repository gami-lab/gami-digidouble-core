# 03 — Compaction Trigger and Session Memory Update

## Context

Closing a conversation must trigger memory compaction so future turns rely on bounded context. This prompt wires compaction trigger execution to conversation closure and persists updated summary state.

## Scope

In scope:

- Add a compaction trigger hook in the close conversation flow.
- Implement/extend compaction orchestration use-case/port boundary.
- Persist compacted result to canonical session memory field(s) (for Phase A, typically `Session.memorySummary`).
- Define failure behavior:
  - close should remain reliable
  - compaction failure should be observable (event/log/metric) and non-destructive
- Add tests proving state transition + persistence side effects.

Out of scope:

- Full pyramidal memory implementation (EPIC 4.2b).
- Advanced retrieval ranking.

## Relevant Docs

- `docs/EPICS.md` (EPIC 2.2b and memory ordering notes)
- `docs/DATA_MODEL.md` (session memory fields)
- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Keep compaction behind application/domain ports; avoid route-level compaction logic.
- If compaction already exists elsewhere, reuse that component and only add lifecycle trigger wiring.
- Persist compaction output atomically with clear ordering expectations.
- Add instrumentation for trigger start/success/failure with correlation/session identifiers.
- Test behavior, not internals:
  - observable close result
  - session memory summary updated
  - fallback behavior when compaction fails

## Constraints

- Preserve async non-blocking principles where possible, but ensure consistency guarantees are explicit.
- No direct infrastructure calls from domain logic.
- Keep implementation minimal and deterministic.

## Deliverables

- Compaction trigger path integrated into close lifecycle flow.
- Port/interface updates if needed.
- Unit/integration tests validating persistence and failure behavior.
- Observability hook(s) for compaction trigger outcomes.

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

- [ ] Conversation close triggers compaction through a clear boundary.
- [ ] Session memory summary persists compaction output.
- [ ] Compaction failure behavior is deterministic and tested.
- [ ] Lifecycle close remains robust even when compaction fails.
- [ ] Observability for compaction outcomes is present.

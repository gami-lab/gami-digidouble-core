# 04 — Implicit End Detection

## Context

EPIC 2.2b calls for explicit or implicit end signals. After explicit closure is stable, add a bounded heuristic path that can close stale/completed conversations automatically through the same canonical close pipeline.

## Scope

In scope:

- Implement implicit end detection rules (time-based inactivity and/or semantic end marker policy defined in contract).
- Ensure implicit closures call the same application close use-case as explicit endpoint.
- Add scheduler/trigger hook at appropriate boundary (request-time check, background job, or GM-adjacent hook), keeping complexity minimal.
- Add tests proving implicit close correctness and non-regression.

Out of scope:

- Rich ML/NLP intent classification for end detection.
- Multi-stage workflow engines.

## Relevant Docs

- `docs/EPICS.md` (EPIC 2.2b behavior)
- `docs/API_CONTRACT.md` (end reason semantics)
- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Keep rule set small and explainable; prefer deterministic heuristics.
- Add a bounded reason taxonomy for implicit closure (e.g., `inactivity_timeout`, `auto_terminal_signal`) and document it.
- Reuse explicit close transition + compaction pipeline; do not duplicate close logic.
- Add defensive guards to prevent closing already closed/archived conversations.
- Ensure any background check path is observable and can be disabled/configured for tests.

## Constraints

- Same close semantics regardless of trigger source (explicit vs implicit).
- No duplicate lifecycle state machines.
- Keep runtime overhead low.

## Deliverables

- Implicit end detection implementation and wiring.
- Tests for rule triggering, no-op paths, and idempotency.
- Contract updates for implicit end reasons and behavior.

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

- [ ] Implicit end rules are deterministic and documented.
- [ ] Implicit close reuses canonical close + compaction path.
- [ ] Already-closed conversation handling is safe and tested.
- [ ] Observability exists for implicit closure decisions.

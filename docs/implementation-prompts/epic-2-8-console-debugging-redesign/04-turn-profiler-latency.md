# Turn Profiler And Latency Breakdown

## Context

Debugging runtime quality requires seeing where time is spent per exchange. The console should expose per-turn technical timing so operators can identify slow stages quickly.

## Scope

Implement now:

- Add a turn profiler section with per-exchange timing breakdown.
- Show, for each turn where available:
  - total turn latency
  - avatar latency
  - GM latency
  - overhead/other latency
  - token volume indicators
- Enable sorting/filtering by slowest turns and GM-involved turns.

Out of scope:

- New observability backend platform.
- Cost analytics beyond currently available metrics.

## Relevant Docs

- docs/VISION.md
- docs/PRINCIPLES.md
- docs/ARCHITECTURE.md
- docs/API_CONTRACT.md
- docs/TEST_STRATEGY.md
- docs/TEST_COVERAGE_PLAN.md
- docs/PROJECT_STATUS.md

## Implementation Guidance

- Reuse existing session metrics endpoint and event timeline data.
- Align turn rows with conversation timeline where possible.
- Ensure missing optional metrics degrade gracefully (no UI breakage).
- Favor concise high-signal visualization over dense tables.

## Constraints

- No local duplicated metric contract definitions.
- Keep performance acceptable on typical local debug sessions.
- Do not over-engineer charting; simple reliable rendering is preferred.

## Deliverables

- Turn profiler UI with latency breakdown and filtering.
- Tests for rendering, null-safe metric handling, and sorting/filtering behavior.
- Contract updates/tests only if new bounded fields are strictly needed.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- docs/PROJECT_STATUS.md
- docs/API_CONTRACT.md (if response shape changed)
- docs/TEST_STRATEGY.md (if testing approach changed materially)

If no doc changes are needed, explicitly verify docs are still accurate.

## Acceptance Criteria

- [ ] Operators can inspect per-turn latency composition.
- [ ] Slow turns are easy to identify and inspect.
- [ ] Optional/missing metric fields are handled safely.
- [ ] Tests cover profiler behavior and data edge cases.
- [ ] Documentation is synchronized.

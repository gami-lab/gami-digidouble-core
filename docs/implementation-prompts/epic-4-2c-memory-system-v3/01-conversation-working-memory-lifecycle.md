# 01 — Conversation Working Memory Lifecycle

## Context

Memory v3 requires conversation-scoped working memory that is rewritten (not appended) and refreshed asynchronously on explicit lifecycle triggers. This replaces partial session-level behavior with a bounded conversation model aligned with `MEMORY_SYSTEM_SPEC.md`.

## Scope

Implement now:

- conversation working-memory model and repository contract
- refresh policy: every 3 exchanges, on conversation close, on avatar switch, and admin trigger
- rewrite pipeline input/output contract for working-memory refresh
- async fire-and-forget refresh orchestration with failure isolation

Out of scope:

- episodic persistence/hydration
- GM selection heuristics beyond consuming refreshed working memory

## Relevant Docs

- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Introduce conversation-scoped persistence (new table or adapted schema) instead of conflating with session-only memory.
- Keep short-term memory assembly separate: recent verbatim exchanges are assembled from messages, not stored as a dedicated memory entity.
- Reuse the existing async maintenance boundary pattern (`IMemoryMaintenancePort`) and keep avatar response path non-blocking.
- Ensure refresh output is bounded and includes:
  - rewritten summary
  - unresolved threads
  - candidate facts for episodic stage
- Preserve compatibility for existing admin/session inspection surfaces where possible.

## Constraints

- No transcript replay dependency for long conversations.
- No provider-specific logic in domain/application layers.
- Keep migrations backward-safe and explicit.
- Keep orchestration deterministic when running with mocked LLM adapters.

## Deliverables

- working-memory lifecycle implementation
- repository and migration updates
- unit + integration tests for refresh triggers and persistence behavior
- updated operational hooks for manual refresh actions

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
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_COVERAGE_PLAN.md` (if test responsibilities change)

If no doc changes are needed, explicitly verify docs are still accurate.

## Acceptance Criteria

- [ ] Conversation working memory is scoped by conversation (not raw transcript replay).
- [ ] Refresh runs on all required triggers.
- [ ] Refresh failures do not block message response flow.
- [ ] Persistence behavior is covered by deterministic tests.
- [ ] Build gates pass and docs are synced.

# Title

Integrate Context Engine Into Avatar And GM Assembly Flows

# Context

Context assembly currently spans multiple services/use cases. EPIC 5.2 requires Context Engine to become the central orchestrator so Avatar and GM consume one coherent context source with predictable differences.

# Scope

Implement now:

- route existing Avatar and GM context assembly through Context Engine
- replace duplicated assembly glue where it now diverges
- ensure Avatar and GM projections are derived from the same assembled payload
- preserve async GM behavior and non-blocking response guarantees
- align runtime/session context inspectors with new context assembly outputs

Out of scope:

- new conversation transport modes
- new memory persistence models
- non-context feature additions

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Keep existing provider services (memory selection, typed retrieval) as dependencies feeding engine input.
- Ensure explicit mapping from assembled context to Avatar prompt input and GM reasoning input.
- Preserve existing safety constraints: no credential leakage, no raw prompt leakage in inspectable outputs.
- Validate that removing one context layer produces expected behavior deltas, not random drift.
- Keep transition logic and GM policies separate from context assembly itself.

# Constraints

- Maintain async GM non-blocking contract.
- Respect module boundaries and existing port abstractions.
- KISS, YAGNI, DRY.
- No direct provider SDK calls in context integration logic.

# Deliverables

- integrated Context Engine usage in Avatar/GM context paths
- removal or reduction of redundant assembly code
- regression tests showing consistent Avatar/GM context assembly behavior
- no runtime contract break for existing inspector consumers

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/ARCHITECTURE.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Avatar and GM context are produced from one shared Context Engine assembly pass.
- [ ] Existing async GM non-blocking behavior is preserved.
- [ ] Context layer inclusion/removal shows deterministic output changes.
- [ ] Regression tests protect integration paths.
- [ ] `docs/PROJECT_STATUS.md` is updated.

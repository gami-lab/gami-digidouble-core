# Title

Type-Specific Retrieval Pipelines (Memory, World, Media)

# Context

EPIC 5.1 value comes from not treating all knowledge as a flat bucket. This slice implements distinct retrieval flows per knowledge domain and returns typed retrieval outputs ready for context assembly.

# Scope

Implement now:

- retrieval entrypoint that accepts scenario/session/user/conversation context
- type-specific retrieval paths for:
  - `memory`
  - `world`
  - `media`
- per-type filtering and scoring policy
- deterministic merge of per-type results into a typed retrieval payload
- retrieval trace metadata for diagnostics (source IDs, scores, reasons)

Out of scope:

- full context prioritization/precedence engine (EPIC 5.2)
- avatar prompt redesign (EPIC 2.1b)
- GM deep context upgrade (EPIC 4.1b)

# Relevant Docs

- `docs/EPICS.md`
- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Keep retrieval orchestration in Application layer with infrastructure-backed vector/query adapters.
- Return typed retrieval structure (not plain string arrays) so downstream context consumers can avoid domain mixing.
- Enforce source-type filtering before ranking to prevent cross-domain contamination.
- Keep ranking deterministic and testable with fixed fixtures.
- Thread retrieval outputs into existing context assembly extension points without redesigning entire context engine.
- Add unit tests for ranking/selection logic and integration tests for repository-backed retrieval queries.

# Constraints

- Respect modular boundaries and existing async GM model.
- Avoid prompt-level heuristics masquerading as retrieval policy.
- Keep retrieval payload bounded and explainable.
- No new endpoint contract drift from local inline DTO copies.

# Deliverables

- retrieval service/use case with three pipelines
- typed retrieval output contracts
- integration with context assembly inputs
- tests validating domain separation and selection correctness

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

- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Retrieval returns separate typed sections for `memory`, `world`, and `media`.
- [ ] Type filtering prevents unrelated source mixing.
- [ ] Retrieval outputs include traceable source/score metadata.
- [ ] Retrieval behavior is deterministic under fixed fixtures.
- [ ] Context assembly receives typed RAG data without breaking existing flows.
- [ ] Documentation reflects retrieval contracts and behavior.

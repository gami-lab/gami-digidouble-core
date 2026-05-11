# Title

Implement Deterministic Context Precedence And Token Budgeting

# Context

EPIC 5.2 explicitly requires source prioritization, conflict resolution, and token budget enforcement. Without deterministic precedence and trimming, context quality degrades and behavior becomes non-explainable.

# Scope

Implement now:

- define precedence policy across context layers:
  - short-term memory
  - working memory
  - long-term facts
  - typed retrieval (`memory`, `world`, `media`)
  - scenario context
  - GM directives
  - user persona
- implement deterministic conflict-resolution rules
- implement token budget policy and trimming strategy with stable ordering
- include machine-readable selection/trimming trace in engine output for debugging

Out of scope:

- UI redesign
- new retrieval algorithms
- model/provider switching work

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

- Make prioritization explicit with a deterministic policy object/config owned in core.
- Keep policy logic pure and testable; avoid hidden heuristics in route/use-case glue.
- Use conservative token accounting for each context segment and trim from least-important segments first.
- Preserve protected segments (for example, critical GM directives or mandatory system-level scenario constraints) per explicit policy.
- Emit trace fields that explain what was kept, trimmed, and why.

# Constraints

- Determinism over cleverness.
- KISS, YAGNI, DRY.
- Backward compatibility for existing runtime inspector consumers where possible.
- No prompt-only "magic" precedence; policy must be visible in code and tests.

# Deliverables

- deterministic precedence policy implementation
- token budget/trimming implementation integrated into Context Engine
- unit tests for precedence, conflict resolution, and trimming edge cases
- trace metadata included in assembled context output

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
- `docs/TEST_STRATEGY.md`
- `docs/GAME_MASTER_CONTRACT.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Context precedence is deterministic and documented in code.
- [ ] Token budget enforcement is deterministic and covered by tests.
- [ ] Conflict-resolution outcomes are predictable under fixed fixtures.
- [ ] Trace metadata explains kept/trimmed context segments.
- [ ] `docs/PROJECT_STATUS.md` is updated.

# Title

Define Context Engine Domain Contracts And Core Module

# Context

The project already assembles context in use-case-level code paths, but EPIC 5.2 requires context assembly to become a first-class deterministic orchestrator. A dedicated Context Engine contract and module boundary are required before policy logic is added.

# Scope

Implement now:

- create Context Engine domain/application contract boundaries:
  - engine input model
  - engine output model (Avatar and GM consumable views)
  - trace metadata model for explainability
- define extension points for memory, typed retrieval, scenario state, user persona, and GM directives
- add a dedicated Context Engine service/module with explicit dependencies through ports/services
- update context assembly call sites to use the engine contract (without full policy complexity yet)

Out of scope:

- final precedence strategy details
- final token trimming heuristics
- admin observability API changes

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

- Keep the Context Engine deterministic and side-effect free for its assembly step.
- Use existing memory and typed retrieval services as data providers; do not reimplement them inside the engine.
- Define an explicit assembled context object that includes:
  - selected inputs
  - selected outputs
  - trace/selection rationale envelope
- Ensure Avatar and GM outputs are derived from one assembly pass to avoid divergence.
- Keep engine contract internal to core domain/application layers; map to shared DTOs at API boundaries.

# Constraints

- Respect architecture boundaries and single responsibility.
- KISS, YAGNI, DRY.
- No provider-specific logic inside Context Engine.
- No hidden coupling to route-layer DTOs.

# Deliverables

- new Context Engine contracts and service skeleton
- integration point from existing session context path to Context Engine
- deterministic unit tests for contract shape and baseline assembly behavior
- no behavior regression in existing session context output

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
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Context Engine contracts are explicit, deterministic, and type-safe.
- [ ] One assembly path can produce both Avatar and GM context projections.
- [ ] Existing context features still function through the new engine boundary.
- [ ] Unit tests validate contract invariants and deterministic output composition.
- [ ] `docs/PROJECT_STATUS.md` is updated.

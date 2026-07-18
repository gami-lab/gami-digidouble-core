# Title

Separate Game Master Role, Policy, And Output Rules

# Context

The current Game Master prompt mixes role definition, orchestration objectives, runtime policies, and JSON output instructions in one compact block. That makes the prompt harder to inspect and increases the chance that implementation details compete with actual decision priorities.

This slice should keep the GM's product behavior intact while making the prompt easier for the model to execute consistently.

# Scope

Implement now:

- review the current GM prompt and its inputs
- refactor the GM prompt so it clearly separates:
  - Game Master role and responsibility
  - decision priorities
  - orchestration policies and guardrails
  - runtime discussion/context input framing
  - output/formatting rules
- reduce duplicated documentation of the output contract where possible
- encourage evidence-based state changes rather than unnecessary updates

Out of scope:

- redesigning GM state semantics
- changing async GM orchestration architecture
- adding new GM output capabilities unrelated to the EPIC

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Start from:
  - `apps/core/src/domain/game-master/gm-prompt.service.ts`
  - `apps/core/src/domain/game-master/game-master.types.ts`
  - `apps/core/src/application/use-cases/run-game-master/**`
  - any context-engine projection used to feed GM input
- Keep the output contract owned by types and validators first, not by repeated prose in the prompt. The prompt can reinforce critical requirements, but it should not become the only definition of the schema.
- Make the GM's decision order explicit before format rules. For example: observe evidence -> decide whether state should change -> decide whether unlock/suggestion/switch is warranted -> produce bounded JSON.
- Separate static scenario/policy framing from recent-discussion evidence so the GM has a clearer reasoning stack.
- Preserve strict JSON-only behavior and validation expectations already relied on by the use case.
- If prompt refactoring exposes missing validator or normalization gaps, fix only the minimum required in the same slice.

# Constraints

- Respect current async GM model and layer boundaries.
- KISS, YAGNI, DRY.
- Do not add prompt-only behavior that bypasses deterministic validation.
- Keep JSON enforcement and downstream parsing robust.
- Avoid changing user-facing orchestration semantics unless tests prove the change is intentional and documented.

# Deliverables

- refactored GM prompt assembly with clearer internal sections
- any minimal supporting validator/normalization adjustments needed to match the clearer structure
- deterministic tests covering key GM prompt invariants and state-update conservatism

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step - Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/GAME_MASTER_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] GM prompt structure clearly separates role, policy, runtime evidence, and formatting rules.
- [ ] Output contract documentation is not unnecessarily duplicated between prompt prose and code validators.
- [ ] GM remains JSON-only and compatible with current parsing/normalization flow.
- [ ] Tests cover conservative state updates and critical contract invariants.
- [ ] `docs/PROJECT_STATUS.md` is updated.

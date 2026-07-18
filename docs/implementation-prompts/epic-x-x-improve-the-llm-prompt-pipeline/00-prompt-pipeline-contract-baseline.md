# Title

Create A Prompt Pipeline Contract Baseline Before Behavioral Changes

# Context

EPIC X.X touches existing Avatar, Game Master, working-memory, and admin/console inspection surfaces that already share overlapping concepts: persona content, runtime context, working-memory summaries, GM notes, and prompt-adjacent diagnostics.

If implementation starts by changing prompts directly, the likely result is more duplicated shapes, more local inline adapters, and more drift between domain contracts, API DTOs, and console consumers. This slice establishes canonical ownership first.

# Scope

Implement now:

- inventory prompt-pipeline contracts touched by the EPIC:
  - avatar persona authoring and runtime representation
  - avatar prompt assembly inputs
  - GM prompt assembly inputs and output-shape helpers
  - working-memory compaction input/output structures
  - admin/runtime inspection DTOs that expose prompt-adjacent context
- search for duplicated type definitions and repeated inline shapes across:
  - `apps/core/src/domain/**`
  - `apps/core/src/application/**`
  - `apps/core/src/api/**`
  - `apps/console/src/**`
  - `packages/shared/src/**`
- define canonical ownership for each touched contract
- remove obvious duplicates before new fields or structures are introduced

Out of scope:

- persona-authoring UX redesign
- prompt wording optimization
- working-memory behavior changes
- new endpoint behavior

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Start from the real owners already present in the repo:
  - Avatar/domain contracts in `apps/core/src/domain/avatar/**`
  - GM/domain contracts in `apps/core/src/domain/game-master/**`
  - memory/domain contracts in `apps/core/src/domain/memory/**`
  - API/shared DTOs in `packages/shared/src/**`
- Audit where `personaPrompt`, working-memory summaries, and prompt-adjacent diagnostics are duplicated in route schemas, use-case-local types, console page state, or mapper outputs.
- Keep internal/domain contracts separate from HTTP/admin DTOs. Use explicit boundary mappers instead of leaking internal prompt-pipeline types into the API layer.
- Add short ownership comments only where future drift is likely; do not add broad commentary everywhere.
- Prefer refactoring existing duplicated shapes into one canonical export instead of creating a new abstraction layer unless no canonical owner exists.

# Constraints

- Respect API -> Application -> Domain -> Infrastructure boundaries.
- KISS, YAGNI, DRY.
- Do not change product behavior in this slice except where needed to remove contract duplication.
- Preserve backward compatibility for existing public/admin API payloads unless the EPIC explicitly requires a contract change.
- TypeScript strict mode only; no `any`.

# Deliverables

- a prompt-pipeline contract ownership map implemented in code imports and canonical exports
- duplicate type cleanup for touched prompt-pipeline shapes
- adjusted route/console mappers that consume canonical DTOs instead of local copies
- updated tests/imports for the cleaned contract graph

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

- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] No duplicated API-facing or console-facing prompt-pipeline DTO remains in touched modules.
- [ ] Canonical ownership is explicit for persona, prompt-input, working-memory, and inspection contracts.
- [ ] Existing API/admin contracts remain stable unless intentionally changed and documented.
- [ ] `pnpm typecheck` passes with the cleaned contract graph.
- [ ] `docs/PROJECT_STATUS.md` is updated.

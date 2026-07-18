# Title

Finalize The Prompt Pipeline With Regression Hardening And Documentation Sync

# Context

EPIC X.X changes one of the highest-risk parts of the system: the information pipeline between runtime state and three different LLM responsibilities. The final slice must prove the new prompt organization is stable, contract-safe, and documented as implemented.

# Scope

Implement now:

- finish regression coverage across Avatar, GM, and working-memory prompt paths
- verify that shared DTOs, domain contracts, repositories, routes, and console consumers remain aligned
- run full quality gates
- perform complete documentation sync for prompt-pipeline behavior and any changed contracts

Out of scope:

- new feature work beyond EPIC X.X
- speculative prompt experimentation not required to complete the EPIC

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

- Keep tests consumer-oriented. Assert what downstream consumers observe:
  - Avatar prompt assembly ordering and omission behavior
  - GM prompt invariants and JSON contract safety
  - working-memory output structure and downstream GM/admin consumption
  - backward compatibility for existing avatars and runtime flows
- Add or extend tests in the correct tier:
  - unit for deterministic prompt assembly and parsing logic
  - integration when repository mappings or adapters collaborate
  - E2E/stack-e2e only when HTTP contracts changed
- Run and record:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm test:coverage`
- If any HTTP endpoint was added in earlier slices, ensure the required `*.stack-e2e.test.ts` files exist and cover auth, validation, and not-found behavior.
- Update docs in the same change set. Do not leave prompt-pipeline behavior documented only in code.

# Constraints

- No unverified assumptions.
- KISS, YAGNI, DRY.
- Do not merge with failing quality gates.
- Documentation is a required deliverable, not optional cleanup.

# Deliverables

- completed regression coverage for the full prompt pipeline
- passing quality gates
- synchronized docs reflecting the real implementation
- concise summary of resolved risks and any intentionally deferred follow-up work

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
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Prompt-pipeline behavior is covered by deterministic regression tests at the right tiers.
- [ ] Contract owners and consumers stay aligned across core, shared, and console layers.
- [ ] Required quality gates pass (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`).
- [ ] Any changed HTTP contract has matching E2E and stack-e2e coverage where required.
- [ ] Documentation reflects implemented behavior, not just intended design.
- [ ] `docs/PROJECT_STATUS.md` is updated.

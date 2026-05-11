# Title

Hardening, Regression Coverage, And Full Documentation Sync

# Context

EPIC 5.2 changes a core orchestration layer. Finalization requires regression safety, contract verification, and documentation alignment across architecture, APIs, data model assumptions, and roadmap status.

# Scope

Implement now:

- add/finish regression tests around Context Engine behavior:
  - deterministic precedence
  - token trimming
  - layer exclusion behavior
  - Avatar/GM projection consistency
  - observability trace structure
- run full quality gates
- perform full doc synchronization for changed behavior/contracts

Out of scope:

- additional feature work beyond EPIC 5.2
- unrelated refactors

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

- Keep tests consumer-oriented: assert observable context behavior, not internal implementation details.
- Validate both positive and negative paths (missing context layer, empty retrieval, tight token budget).
- Verify no drift between shared DTO contracts and route outputs.
- Run and record:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm test:coverage`
- Update docs in the same change set.

# Constraints

- No unverified assumptions; every critical EPIC claim needs test evidence.
- KISS, YAGNI, DRY.
- Do not merge with failing gates.
- Docs are mandatory deliverables, not optional cleanup.

# Deliverables

- regression test suite updates for Context Engine v2
- passing quality gates
- synchronized docs reflecting real implementation
- concise summary of resolved/deferred risks in EPIC artifacts if used by team workflow

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
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Deterministic context behavior is protected by unit/regression tests.
- [ ] Quality gates pass (`lint`, `typecheck`, `test`, `test:coverage`).
- [ ] API/shared contracts and implementation remain aligned.
- [ ] EPIC/docs status reflects delivered behavior and remaining risks.
- [ ] `docs/PROJECT_STATUS.md` is updated.

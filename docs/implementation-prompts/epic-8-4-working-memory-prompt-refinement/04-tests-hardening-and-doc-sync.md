# Close Tests, Hardening, And Documentation Sync

## Context

The final slice makes the EPIC real: regression coverage, quality gates, and source-of-truth documentation updates. EPIC 8.4 changes a shared runtime model, so “feature done” without tests and docs would leave the repo in drift immediately.

## Scope

Implement now:

- add or update deterministic unit tests for working-memory prompt output, normalization, persistence mapping, GM memory input, and inspector/debug surfaces;
- run the relevant quality gates;
- review and update source-of-truth docs so `coveredTopics` and refined working-memory behavior are documented accurately;
- remove any test-only or documentation drift left by earlier slices.

Out of scope:

- follow-on feature work beyond EPIC 8.4;
- speculative benchmarks or evaluation infrastructure;
- unrelated console redesign.

## Relevant Docs

- `docs/PROJECT_STATUS.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- all tests touched by prompts `00` through `03`

## Implementation Guidance

- Favor deterministic unit coverage. Likely areas:
  - compaction parser/normalizer behavior in `memory-maintenance.service.ts`
  - repository round-trip tests for `coveredTopics`
  - GM memory-input tests in `run-game-master.memory-input.use-case.test.ts`
  - admin/context route tests
  - console component tests for runtime inspector and GM impact trace
- Update integration tests only where persistence shape changed.
- No new endpoint is introduced, so do not create a new stack-e2e file unless scope expanded during implementation.
- Run at minimum the gates that honestly validate the touched surface, typically:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - targeted integration tests if repository persistence changed
- Documentation review should cover both behavior and contract shape:
  - `MEMORY_SYSTEM_SPEC.md` for working-memory semantics
  - `GAME_MASTER_CONTRACT.md` for GM memory input shape
  - `DATA_MODEL.md` if the persisted table shape changed
  - `API_CONTRACT.md` if admin/inspector response shapes changed
  - `PROJECT_STATUS.md` for the completed EPIC slice

## Constraints

Respect:

- test the contract, not prose quality;
- no hand-wavy “docs unchanged” claim without verification;
- no unrelated cleanup outside the EPIC’s touched surface.

## Deliverables

- deterministic regression tests for refined working-memory behavior;
- quality-gate results recorded in the PR/task notes;
- updated docs that accurately describe the final runtime behavior and contract shape;
- final cleanup of any stale fixtures or assertions made obsolete by the EPIC.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs move together.

## Acceptance Criteria

- [ ] Deterministic tests cover prompt refinement, normalization, persistence, GM consumption, and inspector/debug visibility.
- [ ] Required quality gates pass, or any blocked gate is explicitly documented with the real reason.
- [ ] Source-of-truth docs describe `coveredTopics` and the refined working-memory behavior accurately.
- [ ] `docs/PROJECT_STATUS.md` is updated before the EPIC is marked complete.
- [ ] No leftover contract drift remains from the earlier slices.

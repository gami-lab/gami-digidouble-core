# Final Hardening: Seed Parity, Tests, and Documentation Sync

## Context

EPIC 6.1 is complete only when manual admin workflows are reliable enough to replace or update seeded content with confidence. This final slice consolidates test guarantees and documentation integrity.

## Scope

In scope:

- close remaining test gaps across admin app and core APIs
- verify parity between seed-script behavior and admin-created/updated data
- add missing stack-e2e files for any endpoint introduced in prompts 01-04
- perform documentation sync across status, contracts, architecture, and data model

Out of scope:

- new feature expansion beyond EPIC 6.1 commitments

## Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Build a parity checklist comparing seeded scenario constructs vs admin-created constructs.
- Ensure new or changed endpoints all have stack-e2e tests under `apps/core/src/api/routes/`.
- Ensure each stack-e2e includes auth (`401`), validation (`400`), and not-found (`404`) cases.
- Add any deferred happy-path stack-e2e tests when prerequisites now exist.
- Run quality gates for touched workspaces (`lint`, `typecheck`, unit/integration/e2e/stack-e2e where applicable).
- Remove temporary scaffolding or TODO markers that are no longer needed.

## Constraints

Respect:

- architecture boundaries
- KISS, YAGNI, DRY
- no hidden contract drift
- explicit documentation ownership

## Deliverables

- complete test coverage set for EPIC 6.1 scope
- seed parity verification notes/checklist in repo docs (if project uses such artifact)
- all mandatory docs updated and consistent with implementation
- final EPIC status reflected in project status and roadmap docs

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` (required)
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/EPICS.md` (if progression status/checklists changed)

If no doc changes are needed for a file, explicitly confirm it was reviewed and remains accurate.

## Acceptance Criteria

- [ ] all EPIC 6.1 new endpoints have required stack-e2e files and minimum assertions
- [ ] seed-script parity is verified for scenario/avatar/knowledge/model configuration
- [ ] no unresolved contract duplication remains
- [ ] full quality gates pass for touched areas
- [ ] mandatory documentation updates/reviews are completed

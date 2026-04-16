# EPIC Prompt Pack — EPIC 1.1 Core Platform Bootstrap

## EPIC Name

EPIC 1.1 — Core Platform Bootstrap

## Objective

Create the technical foundation for all future work by establishing the monorepo, local runtime environment, Docker stack, modular monolith skeleton, and developer workflow.

## Generated Date

2026-04-16

## Prompt Files

1. `01-repo-monorepo-bootstrap.md`
2. `02-local-infra-docker-stack.md`
3. `03-core-module-skeleton.md`
4. `04-dev-workflow-guardrails.md`
5. `05-foundation-validation-doc-sync.md`

## Dependencies Between Prompts

- Prompt 01 is required before all others.
- Prompt 02 depends on Prompt 01.
- Prompt 03 depends on Prompt 01 and should be validated against Prompt 02 runtime assumptions.
- Prompt 04 depends on Prompts 01 to 03.
- Prompt 05 depends on all previous prompts and closes the EPIC.

## Suggested Execution Order

1. `01-repo-monorepo-bootstrap.md`
2. `02-local-infra-docker-stack.md`
3. `03-core-module-skeleton.md`
4. `04-dev-workflow-guardrails.md`
5. `05-foundation-validation-doc-sync.md`

## Definition of Done for Full EPIC

- Repository is structured as a TypeScript-first pnpm + Turborepo monorepo.
- Local docker stack is operational with app, PostgreSQL (pgvector), and Redis.
- Base modular monolith structure exists and matches architecture boundaries.
- Developer bootstrap, lint/test/typecheck scripts, and basic CI checks are in place.
- A new developer can run the stack locally with clear setup instructions.
- Mandatory documentation is synchronized with implemented reality:
  - `docs/PROJECT_STATUS.md`
  - `docs/ARCHITECTURE.md` (if structure changed)
  - `docs/TECH_STACK.md` (if stack decisions changed)
  - `docs/DATA_MODEL.md` (if DB bootstrap/migration assumptions changed)
  - `docs/TEST_STRATEGY.md` (if test workflow assumptions changed)
  - `docs/EPICS.md` (if progress or scope interpretation changed)

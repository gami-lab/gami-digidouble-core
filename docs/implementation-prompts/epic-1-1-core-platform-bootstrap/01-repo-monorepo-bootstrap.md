# Bootstrap Repository and Monorepo Layout

## Context

EPIC 1.1 starts by establishing a stable development foundation. Without a clean monorepo baseline, later EPICs will accumulate friction and inconsistent project structure.

This task creates the minimum repository skeleton and workspace tooling needed to support modular growth.

## Scope

What must be implemented now:

- Initialize pnpm + Turborepo workspace structure.
- Add root TypeScript baseline configuration for strict mode.
- Add workspace-level package boundaries (for example app and shared packages).
- Add root scripts for build, dev, lint, test, and typecheck orchestration.

What is out of scope:

- Implementing business logic.
- Defining API endpoints.
- Integrating LLM providers.
- Full production CI/CD deployment.

## Relevant Docs

- `docs/EPICS.md` (EPIC 1.1 scope)
- `docs/ARCHITECTURE.md` (modular monolith boundaries)
- `docs/TECH_STACK.md` (pnpm, Turborepo, TypeScript strict)
- `docs/PRINCIPLES.md` (KISS, clarity, iteration speed)
- `docs/PROJECT_STATUS.md` (initial baseline)

## Implementation Guidance

- Create a root workspace config compatible with pnpm workspaces and Turborepo pipeline execution.
- Establish clear top-level directories for runtime app and future shared modules.
- Add strict TypeScript defaults at root; child packages should extend root config rather than diverge.
- Keep scripts predictable and discoverable (`dev`, `build`, `test`, `lint`, `typecheck`).
- Add minimal project metadata and engine version constraints matching Node LTS.
- Ensure the structure can host the architecture layers described in `docs/ARCHITECTURE.md` without restructuring later.

Do not provide implementation shortcuts that lock the codebase to one future interface (for example only HTTP assumptions).

## Constraints

Respect:

- Existing architecture boundaries and headless-core direction.
- KISS, YAGNI, DRY.
- TypeScript strictness (no `any`, no implicit types by default policy).
- Backward compatibility with planned modular expansion.
- Explicit and readable workspace contracts.

## Deliverables

- Root workspace configuration files for pnpm + Turborepo.
- Root `package.json` scripts aligned with team workflows.
- Root TypeScript strict configuration.
- Initial app/package skeleton directories.
- Brief bootstrap instructions in project readme sections if missing.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- Any impacted outdated docs, especially:
  - `docs/ARCHITECTURE.md`
  - `docs/TECH_STACK.md`
  - `docs/EPICS.md`
  - `README.md`

If no doc changes are needed, explicitly verify docs are still accurate.

## Acceptance Criteria

- `pnpm install` runs successfully from repository root.
- Monorepo task runner recognizes workspace packages.
- Root scripts execute without missing-workspace errors.
- TypeScript strict baseline is active across packages.
- Folder layout is clear and aligned with architecture intent.
- Documentation reflects the actual repository bootstrap state.

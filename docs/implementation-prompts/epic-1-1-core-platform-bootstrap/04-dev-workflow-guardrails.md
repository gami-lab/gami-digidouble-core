# Establish Developer Workflow, Quality Gates, and Baseline CI

## Context

A platform bootstrap is only useful if contributors can work consistently. This prompt adds workflow guardrails so future EPIC delivery remains fast, predictable, and low-friction.

## Scope

What must be implemented now:
- Add formatting/linting/typecheck/test commands into standard workflow.
- Add pre-commit or pre-push quality gates suitable for a small team.
- Add baseline CI workflow to run install, lint, typecheck, and tests.
- Add contributor-oriented onboarding instructions.

What is out of scope:
- Sophisticated release automation.
- Multi-environment deployment pipelines.
- Heavy policy engines or enterprise governance tooling.

## Relevant Docs

- `docs/EPICS.md` (developer workflow in EPIC 1.1 scope)
- `docs/PRINCIPLES.md` (clarity, learning speed, measurable quality)
- `docs/TEST_STRATEGY.md` (testing philosophy and minimal pyramid alignment)
- `docs/TECH_STACK.md` (tooling expectations)
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Define clear scripts and ensure CI calls the same scripts developers run locally.
- Keep quality gates lightweight and deterministic.
- Ensure typecheck and lint failures are actionable with readable output.
- Add basic repository contribution guide section (quick start, common commands, expected checks).
- If pre-commit hooks are added, keep install/setup simple and optional fallback documented.

Testing guidance:
- Add at least one minimal test command path that can run in CI from clean checkout.

## Constraints

Respect:
- KISS and low maintenance overhead.
- DRY between local scripts and CI configuration.
- Backward compatibility with monorepo growth.
- Explicit and reproducible workflows.

## Deliverables

- Working quality scripts at repository root.
- Baseline CI configuration for pull requests.
- Contributor workflow documentation updates.

## Mandatory Final Step — Documentation Update

After implementation, review and update:
- `docs/PROJECT_STATUS.md`
- Any impacted outdated docs, especially:
  - `docs/TEST_STRATEGY.md`
  - `docs/TECH_STACK.md`
  - `README.md`
  - `docs/EPICS.md` (if interpretation of EPIC completion changed)

If no doc changes are needed, explicitly verify docs are still accurate.

## Acceptance Criteria

- A clean checkout can run install + lint + typecheck + test via documented commands.
- CI executes and reports those checks for pull requests.
- Workflow docs let a new developer become productive quickly.
- Quality gates do not introduce unnecessary complexity.
- Documentation accurately reflects guardrails and CI behavior.

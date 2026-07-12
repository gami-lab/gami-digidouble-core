# Code Audit — EPIC 6.1 Scenario Builder v1

## Scope audited

EPIC scope audited from:

- `docs/implementation-prompts/epic-6-1-scenario-builder-v1/README.md`
- `apps/admin` scenario-builder implementation
- `apps/core` scenario, avatar, knowledge, and model-selection routes/use cases touched by EPIC 6.1
- `packages/shared` contracts used by the admin app
- related tests and documentation updates

Project alignment references reviewed:

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

## Executive Summary

EPIC 6.1 delivered the dedicated `apps/admin` workspace, scenario and avatar editing, and scenario-scoped model selection with generally clean layering and green mandatory quality gates.

The EPIC is not functionally complete against its own README. Two core knowledge-management behaviors are materially broken or missing:

- pasted-text knowledge creation from the admin app cannot succeed
- avatar-scoped knowledge visibility cannot actually be authored from the admin app

There is also a backend visibility-rule bug: `visibilityPolicy` and `visibleToAvatarIds` are not enforced as one coherent contract, so invalid or stale combinations can silently broaden or narrow access. Tests missed these consumer-visible failures.

## Final Grade

**D**

## Build Health

- lint: PASS
- typecheck: PASS
- tests: PASS
- coverage: PASS (`pnpm test:coverage`; @gami/core overall coverage report shows 85.82% statements, 83.92% branches, 96.31% functions, 85.82% lines)

Executed commands:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:coverage`

Not executed in this audit:

- `pnpm test:integration-e2e`
- `pnpm test:stack-e2e`

## Feature Confidence Matrix

| Feature                                      | Expected Behavior                                                                                | Evidence                                                                                                                                                                                                                                              | Confidence (High/Medium/Low) | Notes                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------- |
| Dedicated admin app foundation               | First-class admin workspace with scenario list and detail shell                                  | `apps/admin/src/App.tsx`, `apps/admin/src/scenarios/ScenarioListPage.tsx`, `apps/admin/src/scenarios/ScenarioDetailPage.tsx`                                                                                                                          | High                         | Delivered and behavior-tested at page level                                                     |
| Scenario editing                             | Admin can create/update scenario name, status, objectives, world context                         | `apps/admin/src/scenarios/ScenarioCreatePage.tsx`, `ScenarioEditForm.tsx`, `apps/core/src/api/routes/scenarios.ts`, route/use-case tests                                                                                                              | High                         | Core workflow present and covered                                                               |
| Avatar editing                               | Admin can create/update avatar persona prompt and initial visibility                             | `apps/admin/src/scenarios/ScenarioAvatarForms.tsx`, `ScenarioDetailPage.tsx`, `apps/core/src/api/routes/avatars.ts`, tests                                                                                                                            | Medium                       | Initial visibility toggle is covered; broader runtime implications are not deeply proven here   |
| Knowledge source creation via pasted text    | Admin can create knowledge via pasted text                                                       | `docs/implementation-prompts/epic-6-1-scenario-builder-v1/README.md:38`, `apps/admin/src/scenarios/ScenarioKnowledgeSourceForms.tsx:458-466`, `apps/core/src/application/use-cases/create-knowledge-source/create-knowledge-source.use-case.ts:12-20` | Low                          | Broken: admin sends `uriOrPath: ''`, backend rejects it                                         |
| Knowledge source creation via PDF/TXT upload | Admin can upload file-backed knowledge and persist it                                            | `apps/admin/src/scenarios/ScenarioKnowledgeSourceForms.tsx:412-433`, `apps/core/src/api/routes/knowledge.ts`, `apps/core/src/api/routes/knowledge-sources-management.test.ts`                                                                         | Medium                       | Backend flow exists; admin consumer path lacks save-behavior tests                              |
| Knowledge visibility rules                   | Admin can author world/all-avatar, avatar-scoped, subset, and GM-only visibility                 | `README.md:39`, `docs/TEST_COVERAGE_PLAN.md:335`, `apps/admin/src/scenarios/ScenarioKnowledgeSourceForms.tsx:264-278`                                                                                                                                 | Low                          | UI exposes policy enum only; no avatar picker or subset ownership editing                       |
| Runtime model selection                      | Admin can configure scenario default, GM override, and avatar override using canonical contracts | `apps/admin/src/scenarios/ModelSelectionFields.tsx`, `ScenarioFormFields.tsx`, avatar forms, `packages/shared/src/model-catalog.ts`                                                                                                                   | Medium                       | Feature exists and is validated, but test discipline is weakened by a mislabeled stack-e2e file |
| Seed replacement parity                      | Admin workflows can replace current seed-script content                                          | `README.md:41`, `docs/TEST_COVERAGE_PLAN.md:323-345`, `apps/core/src/seed/murder-party/setup-via-api.seed.ts:158-178`, `apps/admin/src/scenarios/ScenarioFormFields.tsx`                                                                              | Low                          | Documented parity claim is overstated; scenario `config` content still remains seed/API-only    |

## Strengths

- Clean monorepo outcome: `apps/admin` is a separate consumer app, not a mode bolted into `apps/web`.
- Core layering is mostly respected: admin app calls APIs only; scenario/avatar/knowledge logic stays in core application/domain/infrastructure layers.
- Shared contract reuse is materially better than earlier repo patterns; EPIC 6.1 mostly uses `@gami/shared` instead of local DTO copies.
- Scenario-scoped model-selection ownership is explicit and reasonably well-factored.
- Mandatory build health is green.

## Findings

### Admin pasted-text knowledge creation is broken

- Severity: Critical
- Category: Functional completeness
- Problem: The admin pasted-text flow sends `uriOrPath: ''`, but backend validation requires a non-empty `uriOrPath`, so the default admin knowledge-authoring path fails.
- Why it matters: `README.md` explicitly requires "Admin can create/update knowledge sources via pasted text and PDF/TXT upload". The text path is one of the main EPIC promises and is the seed-parity path for authored knowledge content.
- Evidence:
  - `docs/implementation-prompts/epic-6-1-scenario-builder-v1/README.md:38`
  - `apps/admin/src/scenarios/ScenarioKnowledgeSourceForms.tsx:458-466`
  - `apps/core/src/application/use-cases/create-knowledge-source/create-knowledge-source.use-case.ts:12-20`
- Recommendation: Either make inline-text creation supply a meaningful synthetic `uriOrPath` value, or change the create contract so inline text does not require one. Add an admin behavior test that submits pasted text end-to-end through the page/form layer.

### Avatar-scoped knowledge visibility is not actually authorable from the admin app

- Severity: High
- Category: Functional completeness
- Problem: The admin UI exposes only the visibility policy enum. It does not let operators choose one avatar or a subset of avatars, and it never submits `visibleToAvatarIds`.
- Why it matters: The EPIC README and coverage-plan parity checklist both require avatar-scoped visibility, including subset targeting. Operators cannot perform that workflow today.
- Evidence:
  - `docs/implementation-prompts/epic-6-1-scenario-builder-v1/README.md:39`
  - `docs/TEST_COVERAGE_PLAN.md:335`
  - `apps/admin/src/scenarios/ScenarioKnowledgeSourceForms.tsx:264-278`
  - `apps/admin/src/scenarios/ScenarioKnowledgeSourceForms.tsx:426-433`
  - `apps/admin/src/scenarios/ScenarioKnowledgeSourceForms.tsx:458-466`
- Recommendation: Add explicit avatar selection UI and submit canonical `visibleToAvatarIds` for create/update flows. Cover one-avatar, subset, all-avatar, and GM-only transitions with admin behavior tests and backend route tests.

### Knowledge visibility semantics are inconsistent and can silently leak or mis-scope access

- Severity: High
- Category: Architecture / Structural maintainability
- Problem: Backend logic treats `visibilityPolicy` and `visibleToAvatarIds` as loosely related fields instead of one coherent invariant:
  - `visibilityPolicy: 'avatars'` with no `visibleToAvatarIds` becomes visible to all avatars
  - switching a source to `visibilityPolicy: 'all'` without clearing old `visibleToAvatarIds` can keep it restricted
- Why it matters: This breaks the explicit visibility contract, creates hidden coupling between fields, and makes future edits high-risk. It also undermines the GM-only/all/subset semantics operators rely on.
- Evidence:
  - `apps/core/src/application/services/knowledge/typed-retrieval.service.ts:153-165`
  - `apps/core/src/application/use-cases/create-knowledge-source/create-knowledge-source.use-case.ts:23-34`
  - `apps/core/src/application/use-cases/update-knowledge-source/update-knowledge-source.use-case.ts:57-72`
- Recommendation: Enforce invariants at the API/application boundary:
  - require non-empty `visibleToAvatarIds` when `visibilityPolicy === 'avatars'`
  - clear `visibleToAvatarIds` when `visibilityPolicy === 'all'` or `'none'`
  - make retrieval logic respect `visibilityPolicy` first, not infer everything from optional ID arrays
  - add regression tests for all policy/ID combinations

### Tests miss the admin knowledge flows that matter to operators

- Severity: Medium
- Category: Test quality
- Problem: Page-level admin tests stop at rendering the knowledge form; they do not prove pasted-text create, file upload create, or visibility-edit save behavior. A core regression escaped because of that. Test-tier discipline is also weakened by at least one `*.stack-e2e.test.ts` file using Fastify `inject()`, which the test strategy explicitly forbids.
- Why it matters: The project’s testing standard is consumer-observable behavior. The missing admin knowledge tests allowed a broken happy path to ship green. Misclassified test tiers erode trust in the test suite.
- Evidence:
  - `apps/admin/src/scenarios/ScenarioDetailPage.test.tsx:243-264`
  - `docs/TEST_STRATEGY.md:121-128`
  - `apps/core/src/api/routes/admin-model-config.stack-e2e.test.ts:1-28`
- Recommendation: Add behavior tests that actually submit knowledge create/edit flows from the admin UI and assert request payloads/outcomes. Rename or rewrite misclassified stack-e2e files so they match the declared tier semantics.

### Manual admin workflows do not fully replace current seed-script content

- Severity: Medium
- Category: Functional completeness / Documentation alignment
- Problem: The EPIC README says manual admin workflows can fully replace current seed-script content, but seed scenarios still rely on scenario-specific `config` fields such as `progressionMilestones` and `solution`, and the admin app has no editor for them.
- Why it matters: This means the EPIC’s closure claim is overstated. Operators still need seed/API-only paths for part of the production scenario definition.
- Evidence:
  - `docs/implementation-prompts/epic-6-1-scenario-builder-v1/README.md:41`
  - `docs/TEST_COVERAGE_PLAN.md:323-345`
  - `apps/core/src/seed/murder-party/setup-via-api.seed.ts:158-178`
  - `apps/admin/src/scenarios/ScenarioFormFields.tsx:1-101`
- Recommendation: Either narrow the EPIC/documentation claim to match the implemented scope, or add an explicit authoring path for required scenario `config` fields that seeded scenarios depend on.

## Architecture Review

- Boundary quality is mostly solid:
  - `apps/admin` is a thin consumer
  - core routes remain thin
  - use cases own workflow coordination
  - repositories keep persistence details out of domain logic
- No meaningful vendor leakage into domain logic was found in the EPIC-specific paths.
- The main architecture drift is around knowledge visibility semantics:
  - policy is split across UI, DTOs, use cases, repositories, and retrieval without one enforced invariant
  - that makes the knowledge contract fragile under change
- Runtime model selection is cleaner: shared catalog ownership is explicit and runtime resolution stays behind internal abstractions.

## Test Review

Strong tests:

- `apps/core/src/api/routes/scenarios.test.ts`
- `apps/core/src/api/routes/avatars.test.ts`
- `apps/core/src/api/routes/knowledge-sources-management.test.ts`
- `apps/admin/src/api/client.test.ts`
- `apps/admin/src/api/scenarios.test.ts`
- `apps/admin/src/scenarios/model-selection-form.test.ts`

Weak tests:

- `apps/admin/src/scenarios/ScenarioDetailPage.test.tsx` only proves that the knowledge form opens, not that authoring works.
- `apps/core/src/application/services/knowledge/typed-retrieval.service.test.ts` covers positive visibility filtering but not invalid contract combinations like `'avatars'` without IDs or `'all'` with stale IDs.

Missing tests:

- Admin pasted-text knowledge creation happy path
- Admin file-upload knowledge creation happy path
- Admin knowledge visibility edit/save behavior
- Backend validation for `visibilityPolicy`/`visibleToAvatarIds` invariants
- Retrieval regression tests for malformed/stale visibility combinations

Implementation-coupled or policy-violating tests:

- `apps/core/src/api/routes/admin-model-config.stack-e2e.test.ts` is named as stack-e2e but uses `createServer` and `inject()`, which conflicts with `docs/TEST_STRATEGY.md`.

## Documentation Gaps

- `docs/implementation-prompts/epic-6-1-scenario-builder-v1/README.md` overstates completion if the code remains unchanged:
  - pasted-text knowledge creation is broken
  - seed replacement is incomplete
- `docs/TEST_COVERAGE_PLAN.md:335` claims an avatar picker exists for knowledge visibility, but the admin UI does not implement one.
- `docs/PROJECT_STATUS.md` should be revised if the EPIC remains marked complete without fixing the knowledge authoring and seed-parity gaps.

## Path to A

Minimal steps required:

1. Fix pasted-text knowledge creation so the admin happy path actually works.
2. Add avatar selection/subset editing for knowledge visibility and submit canonical `visibleToAvatarIds`.
3. Enforce `visibilityPolicy`/`visibleToAvatarIds` invariants in backend validation and retrieval logic.
4. Add behavior-first admin tests for knowledge create/upload/edit flows and regression tests for visibility combinations.
5. Reconcile the seed-parity claim:
   - either add the missing scenario-config authoring path
   - or narrow the documented DoD and project-status completion claim

## Final Recommendation

**Rework before close**

Rationale:

- Mandatory quality gates are green.
- Architecture is mostly clean.
- But core EPIC behaviors in the knowledge-management slice are not delivered at the level the README promises, and the current tests do not prove those operator-facing workflows.

## Remediation Outcome

### Changes Made

- fixed admin pasted-text knowledge creation by generating a stable non-empty inline `uriOrPath` for authored text sources
- completed admin knowledge visibility authoring with explicit avatar subset selection for create/edit flows and clearer visibility labels in the scenario detail view
- centralized knowledge visibility normalization in core so create, update, retrieval, and repository reads apply one consistent contract:
  - `visibleToAvatarIds` without a policy normalizes to `visibilityPolicy: 'avatars'`
  - `visibilityPolicy: 'all' | 'none'` clears stale avatar IDs
  - `visibilityPolicy: 'avatars'` without avatar IDs is rejected
- renamed `admin-model-config.stack-e2e.test.ts` to `admin-model-config.test.ts` so test naming matches the actual Fastify `inject()` tier
- clarified EPIC docs and seed-parity scope so scenario-specific orchestration config remains intentionally seed/API-owned rather than silently implied as admin-editable

### Findings Resolved

- resolved: admin pasted-text knowledge creation is broken
- resolved: avatar-scoped knowledge visibility is not actually authorable from the admin app
- resolved: knowledge visibility semantics are inconsistent and can silently leak or mis-scope access
- resolved: tests miss the admin knowledge flows that matter to operators
- resolved by documentation alignment: manual admin workflows do not fully replace current seed-script content

### Findings Deferred

- none within EPIC 6.1 scope

### Build Gates

- lint: PASS
- typecheck: PASS
- tests: PASS
- coverage: PASS (`pnpm test:coverage`; @gami/core overall coverage report shows 86.25% statements, 84.49% branches, 96.48% functions, 86.25% lines)

### Final Feature Confidence

- knowledge source creation via pasted text: High
- knowledge source creation via PDF/TXT upload: High
- knowledge visibility authoring (`all` / avatar subset / GM-only): High
- visibility enforcement in retrieval and updates: High
- admin scenario and avatar editing: High
- runtime model selection: High

### Final Grade

**A**

### Remaining Risks

- scenario-specific orchestration config (`scenario.config`, e.g. progression/solution fields) remains intentionally outside the EPIC 6.1 admin surface and must continue to be managed via seed/API workflows

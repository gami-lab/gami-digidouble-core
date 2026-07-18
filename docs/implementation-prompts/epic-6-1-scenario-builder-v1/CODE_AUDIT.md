# Code Audit — EPIC 6.1 Scenario Builder v1

## Scope audited

Audited against:

- `docs/implementation-prompts/epic-6-1-scenario-builder-v1/README.md`
- `docs/implementation-prompts/epic-6-1-scenario-builder-v1/03-knowledge-sources-and-visibility.md`
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

Implementation reviewed:

- `apps/admin`
- `apps/core`
- `packages/shared`
- `infra/postgres/init.sql`

## Executive Summary

EPIC 6.1 is largely delivered: the dedicated `apps/admin` workspace exists, scenario and avatar authoring are usable, knowledge creation works for pasted text and PDF/TXT upload, visibility rules are normalized, and scenario/avatar runtime model selection is wired through shared contracts with green lint, typecheck, test, and coverage gates.

The EPIC is not fully complete against its own README and prompt scope. The missing piece is knowledge-source updating from the admin app: operators can rename a source and change visibility, but they cannot update source content or change source type from the UI, even though the EPIC README and slice prompt both say create/update flows must cover pasted text and PDF/TXT knowledge management. There is also a serious rollout risk: EPIC 6.1 introduced schema changes through a one-time Postgres init script instead of a real migration mechanism, which makes upgrades unsafe for already-initialized environments.

## Final Grade

**C**

## Build Health

- lint: PASS
- typecheck: PASS
- tests: PASS
- coverage: PASS (`pnpm test:coverage` for `@gami/core`: 86.24% statements, 84.52% branches, 96.48% functions, 86.24% lines)

Commands executed:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:coverage`

## Feature Confidence Matrix

| Feature                             | Expected Behavior                                                                              | Evidence                                                                                                                                                                                                                                           | Confidence (High/Medium/Low) | Notes                                                                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| Dedicated admin app                 | First-class admin workspace with scenario list and detail flows                                | `apps/admin/src/App.tsx`, `apps/admin/src/scenarios/ScenarioListPage.tsx`, `apps/admin/src/scenarios/ScenarioDetailPage.tsx`                                                                                                                       | High                         | Cleanly separated from `apps/web` and `apps/console`                                 |
| Scenario editing                    | Admin can create/update scenario name, status, objectives, and world context                   | `apps/admin/src/scenarios/ScenarioCreatePage.tsx`, `apps/admin/src/scenarios/ScenarioEditForm.tsx`, `apps/core/src/api/routes/scenarios.ts`, related tests                                                                                         | High                         | Behavior is proven in admin tests and route tests                                    |
| Avatar editing + initial visibility | Admin can create/update avatars and control initial visibility                                 | `apps/admin/src/scenarios/ScenarioAvatarForms.tsx`, `apps/admin/src/scenarios/ScenarioDetailPage.tsx`, `apps/core/src/api/routes/avatars.ts`, related tests                                                                                        | High                         | Good end-to-end evidence for the supported flow                                      |
| Knowledge creation                  | Admin can create knowledge from pasted text and PDF/TXT upload                                 | `apps/admin/src/scenarios/ScenarioKnowledgeSourceForms.tsx`, `apps/core/src/api/routes/knowledge.ts`, `apps/admin/src/scenarios/ScenarioDetailPage.test.tsx`, `apps/core/src/api/routes/knowledge.stack-e2e.test.ts`                               | High                         | Both authoring paths are covered                                                     |
| Knowledge updating                  | Admin can update knowledge sources via text and PDF/TXT flows                                  | `docs/implementation-prompts/epic-6-1-scenario-builder-v1/README.md:38`, `docs/implementation-prompts/epic-6-1-scenario-builder-v1/03-knowledge-sources-and-visibility.md:11`, `apps/admin/src/scenarios/ScenarioKnowledgeSourceForms.tsx:116-178` | Low                          | UI only supports rename + visibility edit; content/type update is missing            |
| Visibility rules                    | Avatar-scoped, all-avatar, and GM-only visibility are represented and enforced                 | `apps/core/src/domain/knowledge/knowledge-visibility.ts`, `apps/admin/src/scenarios/ScenarioKnowledgeSourceFieldGroups.tsx`, retrieval/use-case tests                                                                                              | High                         | Normalization and enforcement are well covered                                       |
| Runtime model selection             | Scenario default, GM override, and avatar override are editable and resolved deterministically | `apps/admin/src/scenarios/ModelSelectionFields.tsx`, `apps/core/src/domain/model-config/model-resolution.service.ts`, scenario/avatar route tests                                                                                                  | High                         | Shared catalog ownership is a strength                                               |
| Seed parity for supported surfaces  | Admin workflows can replace the supported non-orchestration seed surfaces                      | `docs/TEST_COVERAGE_PLAN.md:321-345`, `apps/core/src/seed/murder-party/setup-via-api.ts`, admin forms                                                                                                                                              | Medium                       | Create flows align well, but update gaps on knowledge content/type reduce confidence |

## Strengths

- `apps/admin` is a proper first-class app, not a mode bolted onto the player app.
- Shared DTO ownership is materially improved. Scenario, avatar, knowledge, and model-selection transports mostly flow through `@gami/shared`.
- The admin app is a thin consumer; business logic remains in `apps/core`.
- Knowledge visibility normalization is centralized and well tested.
- The test suite proves a lot of observable behavior at the page, route, use-case, and stack-e2e levels.
- Mandatory quality gates are green.

## Findings

### Knowledge-source update workflows are incomplete in the admin app

- Severity: High
- Category: Functional completeness
- Problem: The EPIC requires create/update knowledge flows for pasted text and PDF/TXT, but the admin edit form only updates `name` and `visibilityPolicy`. It disables knowledge type changes and exposes no content/file replacement path.
- Why it matters: This leaves a core EPIC workflow incomplete. Operators cannot update existing source content from the admin app; they must delete/recreate the source or call the API directly.
- Evidence:
  - `docs/implementation-prompts/epic-6-1-scenario-builder-v1/README.md:38`
  - `docs/implementation-prompts/epic-6-1-scenario-builder-v1/03-knowledge-sources-and-visibility.md:11`
  - `apps/admin/src/scenarios/ScenarioKnowledgeSourceForms.tsx:116-178`
- Recommendation: Extend `KnowledgeSourceEditForm` to support content updates for inline text and file-backed sources, and decide explicitly whether source type is editable after creation. Add admin behavior tests for both update paths.

### Postgres schema evolution is unsafe for already-initialized environments

- Severity: High
- Category: Operational quality
- Problem: EPIC 6.1 added persistence fields such as `visibility_policy` through `infra/postgres/init.sql`, but that file is a one-time bootstrap script rather than a repeatable migration mechanism.
- Why it matters: Existing environments with a persisted Postgres volume can miss new columns introduced by the EPIC, causing runtime 500s after deployment even when tests are green.
- Evidence:
  - `infra/postgres/init.sql:2-4`
  - `infra/postgres/init.sql:82-85`
  - `apps/core/src/infrastructure/db/test-helpers.ts:19-26`
- Recommendation: Introduce a real migration path for schema evolution, or at minimum add an explicit startup migration step that is rerunnable against existing databases.

### File upload parsing duplicates ingestion responsibilities in the API layer

- Severity: Medium
- Category: Architecture quality
- Problem: The upload endpoint imports `pdf-parse`, decodes base64, and extracts text inside the route, while the production content loader already owns file/PDF loading behavior.
- Why it matters: This splits one responsibility across API and infrastructure layers, duplicates PDF parsing logic, and increases the chance of drift between upload ingestion and normal ingestion.
- Evidence:
  - `apps/core/src/api/routes/knowledge.ts:4`
  - `apps/core/src/api/routes/knowledge.ts:274-325`
  - `apps/core/src/infrastructure/knowledge/file-url-knowledge-source-content-loader.ts:3`
  - `apps/core/src/infrastructure/knowledge/file-url-knowledge-source-content-loader.ts:55-67`
- Recommendation: Move upload-content decoding/parsing behind a dedicated infrastructure adapter or reuse the existing content-loader abstraction so the API layer only validates and dispatches.

### Internal server errors are returned without root-cause logging

- Severity: Medium
- Category: Operational quality
- Problem: The global Fastify error handler converts unexpected failures to a generic 500 response but does not log the underlying error.
- Why it matters: This materially reduces debuggability, especially for rollout problems like missing schema columns or environment drift.
- Evidence:
  - `apps/core/src/api/server.ts:123-130`
- Recommendation: Log unexpected errors with request context before returning the generic envelope. Preserve the safe public response, but do not drop the diagnostic signal.

### EPIC documentation is internally inconsistent about delivered scope

- Severity: Low
- Category: Documentation alignment
- Problem: The EPIC README and slice prompt require update flows for knowledge sources, while `docs/EPICS.md` describes a different scope (`reusable variable editor`, `save/load config`) that does not match the implemented admin app.
- Why it matters: The audit target becomes ambiguous, and “EPIC complete” status is harder to trust when the scope differs across project documents.
- Evidence:
  - `docs/implementation-prompts/epic-6-1-scenario-builder-v1/README.md:35-43`
  - `docs/implementation-prompts/epic-6-1-scenario-builder-v1/03-knowledge-sources-and-visibility.md:11-18`
  - `docs/EPICS.md:1556-1574`
- Recommendation: Reconcile `README.md`, `03-knowledge-sources-and-visibility.md`, and `docs/EPICS.md` to one authoritative scope. Either implement the missing update behavior or narrow the documented claim.

## Architecture Review

The EPIC mostly respects the modular monolith boundaries:

- `apps/admin` is a consumer-only layer over canonical routes.
- Route handlers are generally thin and delegate to use cases.
- Scenario/avatar/model-selection logic stays out of the UI.
- Shared contract ownership is explicit enough to keep cross-app drift low.

The main architecture blemish is the knowledge upload path. Parsing binary/base64 payloads and extracting PDF text in `apps/core/src/api/routes/knowledge.ts` pulls infrastructure behavior into the API layer and duplicates content-loader behavior. That is not catastrophic, but it is clear drift from the intended API → Application → Infrastructure separation.

## Test Review

Strong tests:

- `apps/admin/src/scenarios/ScenarioCreatePage.test.tsx`
- `apps/admin/src/scenarios/ScenarioDetailPage.test.tsx`
- `apps/core/src/api/routes/scenarios.test.ts`
- `apps/core/src/api/routes/avatars.test.ts`
- `apps/core/src/api/routes/knowledge-sources-management.test.ts`
- `apps/core/src/application/services/knowledge/typed-retrieval.service.test.ts`
- `apps/core/src/api/routes/knowledge.stack-e2e.test.ts`

Weak tests:

- There is no admin behavior test for editing knowledge content or changing knowledge type, because the UI does not expose those workflows.
- There is no automated verification that a pre-existing Postgres volume upgrades safely when EPIC 6.1 columns are introduced.

Missing tests:

- Admin pasted-text knowledge edit flow
- Admin file-backed knowledge replacement flow
- Admin knowledge-type update behavior, if that workflow is intended to be supported
- Startup or deployment validation for schema drift on already-initialized databases
- Error-path logging assertions for unexpected 500s

Implementation-coupled tests:

- No severe implementation-mirroring pattern stood out in the EPIC-specific tests. Most of the important tests assert consumer-visible payloads or page behavior rather than private internals.

## Documentation Gaps

- `docs/implementation-prompts/epic-6-1-scenario-builder-v1/README.md` and `03-knowledge-sources-and-visibility.md` should be reconciled with the actual admin edit scope if knowledge-source updating remains limited.
- `docs/EPICS.md` should be corrected to match the actual EPIC scope and remove unmatched items like `reusable variable editor` / `save/load config`, unless those are intentionally still part of the target.
- If the team accepts delete-and-recreate as the intended operator pattern for knowledge content changes, that decision should be documented explicitly. Right now the docs imply true update support.

## Path to A

Minimal steps:

1. Complete the admin knowledge update workflow so operators can update source content, not only rename/change visibility.
2. Add a repeatable migration mechanism for schema evolution, then prove EPIC 6.1 columns upgrade safely on an existing database.
3. Move upload parsing/extraction behind an infrastructure boundary instead of keeping it in the route.
4. Add root-cause logging for unexpected 500s.
5. Reconcile EPIC documentation so scope, completion state, and acceptance criteria all describe the same thing.

## Final Recommendation

**Close with debt**

The EPIC is close enough to usable that a total rework is not warranted, and the core architecture/test posture is materially better than average. But I would not call it a clean close: one advertised admin workflow is incomplete, and the persistence rollout model is still operationally risky. If the project wants to treat the README and slice prompts as the source of truth, this EPIC should carry explicit follow-up debt before being considered truly done.

## Remediation Outcome

### Changes Made

- completed the admin knowledge-edit workflow:
  - inline knowledge sources now support pasted-text replacement through the existing edit form
  - file-backed PDF/TXT sources now support content replacement through the same edit form
- extended the canonical `UpdateKnowledgeSourceRequest` contract to support file replacement via `content` + `filename`
- moved uploaded-content parsing out of the knowledge route into dedicated helpers backed by the infrastructure parser, reducing API-layer parsing drift
- added rerunnable Postgres startup schema alignment and wired it into `apps/core/src/index.ts` before repository construction
- added unexpected-error logging for the global Fastify error handler and scenario/knowledge route fallback paths
- synced EPIC/status/API/test-plan docs to the delivered behavior and final scope

### Findings Resolved

- `High` — Knowledge-source update workflows are complete in the admin app for inline text and PDF/TXT-backed sources
- `High` — Postgres schema evolution now has a rerunnable startup alignment path for already-initialized environments
- `Medium` — File-upload parsing no longer lives inline in the main knowledge route; request translation now delegates to dedicated helpers backed by the infrastructure parser
- `Medium` — Unexpected internal errors now emit diagnostic logs while preserving the public `INTERNAL_ERROR` envelope
- `Low` — EPIC documentation and status docs now match the delivered scope

### Findings Deferred

- none

### Build Gates

- lint: PASS
- typecheck: PASS
- tests: PASS
- coverage: PASS (`pnpm test:coverage` for `@gami/core`: 86.3% statements, 84.56% branches, 96.53% functions, 86.3% lines)

### Final Feature Confidence

- Dedicated admin app behavior is proven through page-level tests for scenario, avatar, knowledge, and model-selection flows
- Knowledge source creation and replacement are proven for pasted text and PDF/TXT upload/replacement paths
- Visibility-policy normalization and GM-only enforcement are proven in domain, route, retrieval, and repository tests
- Startup schema alignment is proven by dedicated unit coverage and exercised by the green build gates
- Unexpected 500 handling is now observable through logging and covered by scenario-route failure tests

### Final Grade

A

### Remaining Risks

- integration-level proof of schema alignment against a legacy live Postgres volume remains in the extended DB-backed suite rather than the fast unit gate, but the production startup path is now rerunnable and covered by deterministic tests

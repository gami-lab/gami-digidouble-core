# Code Audit — EPIC 4.1c Multi-Model Runtime Configuration

## Scope audited

Audit target:

- [docs/implementation-prompts/epic-4-1c-multi-model-runtime-config/README.md](docs/implementation-prompts/epic-4-1c-multi-model-runtime-config/README.md)

Primary implementation surfaces reviewed:

- Domain model config and resolution: [apps/core/src/domain/model-config/model-config.types.ts](apps/core/src/domain/model-config/model-config.types.ts), [apps/core/src/domain/model-config/model-resolution.service.ts](apps/core/src/domain/model-config/model-resolution.service.ts)
- Persistence and API: [apps/core/src/infrastructure/db/repositories/postgres-model-config.repository.ts](apps/core/src/infrastructure/db/repositories/postgres-model-config.repository.ts), [apps/core/src/api/routes/admin-model-config.ts](apps/core/src/api/routes/admin-model-config.ts)
- Runtime wiring: [apps/core/src/application/services/model-resolution-runtime.service.ts](apps/core/src/application/services/model-resolution-runtime.service.ts), [apps/core/src/application/use-cases/send-message/send-message.use-case.ts](apps/core/src/application/use-cases/send-message/send-message.use-case.ts), [apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts](apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts), [apps/core/src/application/services/memory-maintenance.service.ts](apps/core/src/application/services/memory-maintenance.service.ts)
- Inspector and shared DTOs: [apps/core/src/application/use-cases/inspect-session/inspect-session.use-case.ts](apps/core/src/application/use-cases/inspect-session/inspect-session.use-case.ts), [packages/shared/src/runtime-inspector-types.ts](packages/shared/src/runtime-inspector-types.ts)
- Console integration: [apps/console/src/pages/ModelConfigPanel.tsx](apps/console/src/pages/ModelConfigPanel.tsx), [apps/console/src/pages/UnifiedTestingPage.tsx](apps/console/src/pages/UnifiedTestingPage.tsx), [apps/console/src/components/runtime-inspector-tab-content.tsx](apps/console/src/components/runtime-inspector-tab-content.tsx)
- Documentation alignment: [docs/API_CONTRACT.md](docs/API_CONTRACT.md), [docs/DATA_MODEL.md](docs/DATA_MODEL.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#L584), [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)

## Executive Summary

EPIC 4.1c is substantially delivered end-to-end: model config domain contracts, repository persistence with a single-row constraint, admin CRUD endpoint pair, avatar override behavior, runtime model resolution for avatar/GM/memory, inspector visibility, and console editing flows are present and exercised.

Quality is solid but not A-grade. Main blockers are structural drift and test-depth gaps around configuration paths:

- one concrete runtime wiring defect in sessions route fallback construction,
- fallback semantics mismatch between runtime and admin retrieval,
- low-depth test coverage for update-model-config use case and no focused UI tests for model config panel,
- provider-list duplication across layers creating avoidable blast radius.

## Final Grade

C

## Build Health

- lint: PASS
- typecheck: PASS
- tests: PASS
- coverage: PASS (core coverage run succeeded; All files 89.19 lines / 85.86 branches / 95.28 functions / 89.19 statements)

## Feature Confidence Matrix

| Feature                                  | Expected Behavior                                                                 | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Confidence (High/Medium/Low) | Notes                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | -------------------------------------------------------------- |
| Deterministic model resolution           | avatar override > role override > global default, field-wise fallback             | [apps/core/src/domain/model-config/model-resolution.service.ts](apps/core/src/domain/model-config/model-resolution.service.ts), [apps/core/src/domain/model-config/model-resolution.service.test.ts](apps/core/src/domain/model-config/model-resolution.service.test.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | High                         | Rule implementation and unit tests align.                      |
| Persistent runtime model config          | single-row persisted config survives reads/updates/restart                        | [infra/postgres/init.sql](infra/postgres/init.sql#L244), [apps/core/src/infrastructure/db/repositories/postgres-model-config.repository.ts](apps/core/src/infrastructure/db/repositories/postgres-model-config.repository.ts), [apps/core/src/infrastructure/db/repositories/postgres-model-config.repository.integration.test.ts](apps/core/src/infrastructure/db/repositories/postgres-model-config.repository.integration.test.ts)                                                                                                                                                                                                                                                                                                                  | High                         | DB contract and repository behavior are proven.                |
| Admin model config API                   | GET and PUT with auth/validation and envelope responses                           | [apps/core/src/api/routes/admin-model-config.ts](apps/core/src/api/routes/admin-model-config.ts), [apps/core/src/api/routes/admin-model-config.stack-e2e.test.ts](apps/core/src/api/routes/admin-model-config.stack-e2e.test.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Medium                       | Good coverage, but PUT wrong-key auth case missing.            |
| Runtime role-based adapter selection     | avatar, gameMaster, memory each resolve provider/model and emit metadata          | [apps/core/src/application/services/model-resolution-runtime.service.ts](apps/core/src/application/services/model-resolution-runtime.service.ts), [apps/core/src/application/use-cases/send-message/send-message.model-resolution.use-case.test.ts](apps/core/src/application/use-cases/send-message/send-message.model-resolution.use-case.test.ts), [apps/core/src/application/use-cases/run-game-master/run-game-master.model-resolution.use-case.test.ts](apps/core/src/application/use-cases/run-game-master/run-game-master.model-resolution.use-case.test.ts), [apps/core/src/application/services/memory-maintenance.model-resolution.service.test.ts](apps/core/src/application/services/memory-maintenance.model-resolution.service.test.ts) | High                         | Behavioral tests exist for all three roles.                    |
| Avatar-level override in API/persistence | llmOverride accepted, validated, persisted in config.llmOverride, surfaced in DTO | [apps/core/src/api/routes/avatars.ts](apps/core/src/api/routes/avatars.ts), [apps/core/src/infrastructure/db/repositories/postgres-avatar.repository.ts](apps/core/src/infrastructure/db/repositories/postgres-avatar.repository.ts), [apps/core/src/api/routes/avatars.test.ts](apps/core/src/api/routes/avatars.test.ts), [packages/shared/src/entity-types.ts](packages/shared/src/entity-types.ts)                                                                                                                                                                                                                                                                                                                                                 | High                         | Good negative and clear-path tests.                            |
| Inspector effectiveModels                | inspect endpoint includes effective resolved models for three roles               | [apps/core/src/application/use-cases/inspect-session/inspect-session.use-case.ts](apps/core/src/application/use-cases/inspect-session/inspect-session.use-case.ts), [apps/core/src/application/use-cases/inspect-session/inspect-session.use-case.test.ts](apps/core/src/application/use-cases/inspect-session/inspect-session.use-case.test.ts), [apps/core/src/api/routes/admin-sessions.stack-e2e.test.ts](apps/core/src/api/routes/admin-sessions.stack-e2e.test.ts#L220)                                                                                                                                                                                                                                                                          | High                         | End-to-end visibility is proven.                               |
| Console model configuration UX           | operator can load/edit/save global+role config                                    | [apps/console/src/pages/ModelConfigPanel.tsx](apps/console/src/pages/ModelConfigPanel.tsx), [apps/console/src/api/model-config.ts](apps/console/src/api/model-config.ts), [apps/console/src/pages/UnifiedTestingPage.tsx](apps/console/src/pages/UnifiedTestingPage.tsx#L47)                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Medium                       | Implemented but lacks focused component/API interaction tests. |

## Strengths

- Clear layered implementation for core feature paths: domain resolution stays pure and reusable.
- Runtime adoption is correctly role-scoped and non-blocking for GM flow.
- Persistence design is pragmatic and stable (single-row model_config with DB-level constraint).
- Observability metadata includes effectiveProvider/effectiveModel at LLM call boundaries.
- Documentation is broadly synchronized across API, data model, architecture, and project status.

## Findings

### Sessions Route Omits XAI In Local LLM Config Construction

- Severity: High
- Category: Functional correctness / maintainability
- Problem: Sessions route builds a local LLM config object with openai/anthropic/mistral keys but omits xai.
- Why it matters: Route-level fallback behavior diverges from system-level provider support and can break runtime behavior when xai is configured.
- Evidence: [apps/core/src/api/routes/sessions.ts](apps/core/src/api/routes/sessions.ts#L243), [apps/core/src/api/routes/sessions.ts](apps/core/src/api/routes/sessions.ts#L244)
- Recommendation: Remove per-route LLM config assembly and reuse one shared builder used by server bootstrap, or add xai path immediately and add regression test for xai route fallback.

### GET Model Config Fallback Does Not Match Runtime Fallback Semantics

- Severity: High
- Category: Contract consistency / operational correctness
- Problem: GET model config returns DEFAULT_MODEL_CONFIG when no row exists, while runtime execution can use env-derived fallback config.
- Why it matters: Operators may see configuration in admin UI that does not match the effective runtime selection used by message/GM/memory execution.
- Evidence: [apps/core/src/application/use-cases/get-model-config/get-model-config.use-case.ts](apps/core/src/application/use-cases/get-model-config/get-model-config.use-case.ts#L13), [apps/core/src/index.ts](apps/core/src/index.ts#L57)
- Recommendation: Inject runtime fallback into GetModelConfigUseCase (or API mapper) so GET returns the same effective default used by runtime.

### Test Gaps In Model Config Write Path

- Severity: Medium
- Category: Test quality
- Problem: No dedicated use-case tests for update-model-config/get-model-config logic; API tests carry most validation confidence.
- Why it matters: Validation and normalization branches in use case are weakly protected against regressions and encourage controller-coupled testing.
- Evidence: [apps/core/src/application/use-cases/update-model-config/update-model-config.use-case.ts](apps/core/src/application/use-cases/update-model-config/update-model-config.use-case.ts), [apps/core/src/application/use-cases/get-model-config/get-model-config.use-case.ts](apps/core/src/application/use-cases/get-model-config/get-model-config.use-case.ts), [apps/core/src/api/routes/admin-model-config.stack-e2e.test.ts](apps/core/src/api/routes/admin-model-config.stack-e2e.test.ts)
- Recommendation: Add focused unit tests for both use cases covering normalization, boundary lengths, and role-override shape behavior.

### Incomplete Auth Matrix In PUT Admin Model Config Stack Test

- Severity: Medium
- Category: Test coverage / API contract protection
- Problem: PUT endpoint stack-e2e tests cover missing API key but not wrong API key.
- Why it matters: Auth enforcement matrix is incomplete for a newly introduced admin endpoint.
- Evidence: [apps/core/src/api/routes/admin-model-config.stack-e2e.test.ts](apps/core/src/api/routes/admin-model-config.stack-e2e.test.ts#L55), [apps/core/src/api/routes/admin-model-config.stack-e2e.test.ts](apps/core/src/api/routes/admin-model-config.stack-e2e.test.ts#L56)
- Recommendation: Add explicit wrong-key case for PUT (expect 401 UNAUTHORIZED).

### Provider Source Of Truth Still Duplicated Across Layers

- Severity: Medium
- Category: Structural maintainability
- Problem: Provider values are duplicated in core and console constants/helpers rather than flowing from one exported canonical contract.
- Why it matters: Adding/removing a provider still requires several manual edits across core bootstrap, API validation messaging, and console options.
- Evidence: [apps/core/src/domain/model-config/model-config.types.ts](apps/core/src/domain/model-config/model-config.types.ts#L3), [apps/core/src/index.ts](apps/core/src/index.ts#L182), [apps/console/src/api/provider-options.ts](apps/console/src/api/provider-options.ts#L2)
- Recommendation: Expose provider enum/list once from shared contracts and consume in core bootstrap helpers and console options.

## Architecture Review

Overall architecture alignment is good:

- API/Application/Domain/Infrastructure boundaries are mostly respected.
- Provider SDKs stay in infrastructure adapters.
- Model resolution policy stays in domain and runtime service glue in application layer.
- Async GM remains non-blocking.

Residual drift risks:

- repeated route-level LLM config assembly patterns in routes/server increase divergence risk,
- fallback semantics split between runtime and admin retrieval introduces behavior-contract drift.

## Test Review

Strong tests:

- Resolution logic unit tests for precedence order.
- Role-specific runtime wiring tests for avatar, GM, memory.
- Admin inspect effectiveModels behavior through use-case and route tests.
- Repository integration tests for model_config single-row persistence.

Weak tests:

- No dedicated use-case unit tests for get-model-config/update-model-config.
- No focused console tests for ModelConfigPanel behavior.
- PUT admin model config auth matrix misses wrong-key scenario.

Missing tests:

- XAI path in sessions route local adapter config fallback.
- GET model-config runtime-fallback parity when DB row absent.

Implementation-coupled tests:

- Some route tests assert shape at high level but do not assert operator-observable fallback parity between admin read and runtime execution.

## Documentation Gaps

Current docs are broadly updated and coherent for EPIC 4.1c. Main gap is semantic clarity:

- clarify whether GET model-config returns static default or runtime-effective env fallback when no DB row exists, then align implementation and docs accordingly.

Relevant docs already updated:

- [docs/API_CONTRACT.md](docs/API_CONTRACT.md)
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#L584)
- [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)

## Path to A

1. Fix xai omission in sessions route fallback config and add regression test.
2. Unify runtime fallback semantics for GET model-config with execution path behavior.
3. Add unit tests for get-model-config and update-model-config use cases.
4. Add missing PUT wrong-key auth case in stack-e2e test.
5. Consolidate provider list ownership into one shared exported source used by core and console.

## Final Recommendation

Close with debt.

The EPIC is functionally substantial and operationally usable, but the identified drift and test-depth gaps should be scheduled immediately in follow-up hardening before relying on this area for rapid provider iteration at scale.

## Remediation Outcome

### Changes Made

- Added `xaiApiKey` handling in sessions route local LLM config assembly: [apps/core/src/api/routes/sessions.ts](apps/core/src/api/routes/sessions.ts).
- Introduced shared LLM config assembly helper and reused it in sessions route and bootstrap to reduce drift risk: [apps/core/src/infrastructure/llm/index.ts](apps/core/src/infrastructure/llm/index.ts), [apps/core/src/api/routes/sessions.ts](apps/core/src/api/routes/sessions.ts), [apps/core/src/index.ts](apps/core/src/index.ts).
- Aligned admin model-config GET fallback wiring with runtime-injected fallback path by passing fallback through server route options and use case injection: [apps/core/src/api/server.ts](apps/core/src/api/server.ts), [apps/core/src/api/routes/admin-model-config.ts](apps/core/src/api/routes/admin-model-config.ts), [apps/core/src/application/use-cases/get-model-config/get-model-config.use-case.ts](apps/core/src/application/use-cases/get-model-config/get-model-config.use-case.ts).
- Added focused use-case tests for model-config read/write behavior: [apps/core/src/application/use-cases/get-model-config/get-model-config.use-case.test.ts](apps/core/src/application/use-cases/get-model-config/get-model-config.use-case.test.ts), [apps/core/src/application/use-cases/update-model-config/update-model-config.use-case.test.ts](apps/core/src/application/use-cases/update-model-config/update-model-config.use-case.test.ts).
- Completed PUT admin model-config auth matrix with explicit wrong-key case and added fallback parity assertion: [apps/core/src/api/routes/admin-model-config.stack-e2e.test.ts](apps/core/src/api/routes/admin-model-config.stack-e2e.test.ts).
- Added focused ModelConfig panel mapping tests and exported pure helper mappers: [apps/console/src/pages/ModelConfigPanel.tsx](apps/console/src/pages/ModelConfigPanel.tsx), [apps/console/src/pages/ModelConfigPanel.test.ts](apps/console/src/pages/ModelConfigPanel.test.ts).
- Reduced provider-list drift in core by introducing shared `PROVIDER_NAMES` in domain model-config types and consuming it in core validation paths: [apps/core/src/domain/model-config/model-config.types.ts](apps/core/src/domain/model-config/model-config.types.ts), [apps/core/src/api/routes/avatars.ts](apps/core/src/api/routes/avatars.ts), [apps/core/src/api/routes/scenarios.ts](apps/core/src/api/routes/scenarios.ts), [apps/core/src/application/use-cases/update-model-config/update-model-config.use-case.ts](apps/core/src/application/use-cases/update-model-config/update-model-config.use-case.ts), [apps/core/src/index.ts](apps/core/src/index.ts).

### Findings Resolved

- Resolved: Sessions route XAI omission.
- Resolved: Sessions route local LLM config assembly drift by introducing a shared builder.
- Resolved: GET model-config fallback parity at server/use-case wiring level.
- Resolved: Missing unit tests for get-model-config and update-model-config use cases.
- Resolved: Missing PUT wrong-key auth case in admin model-config stack-e2e.
- Resolved: Missing focused console tests for model-config mapping behavior.

### Findings Deferred

- Deferred (partial): Provider source-of-truth duplication across core and console is reduced but not fully unified into a single cross-package exported contract yet.

### Build Gates

- `pnpm lint`: PASS
- `pnpm typecheck`: PASS
- `pnpm test`: PASS

### Final Feature Confidence

- Deterministic model resolution: High
- Persistent runtime model config: High
- Admin model-config API: High
- Runtime role-based adapter selection: High
- Avatar-level override behavior: High
- Inspector effective models: High
- Console model configuration UX: Medium-High

### Final Grade

B+

### Remaining Risks

- Provider option ownership still spans core and console modules; future provider additions can still require multi-file updates.

# Legacy and Backward-Compatibility Audit

Date: 2026-09-13  
Repository: `gami-digidouble-core`  
Revision: `a366b27d`  
Scope: production source, shared contracts, database bootstrap/alignment, seed tooling, and tests that document compatibility behavior.

## Executive summary

The codebase is not yet a clean-slate codebase. It contains several live compatibility paths for previous database schemas, API values, persisted JSON payloads, prompt contracts, and content/configuration shapes.

For the requested clean redeploy with a fresh database and fresh content, the highest-value removal targets are:

1. Runtime schema alignment and legacy database preservation logic.
2. The `knowledge_type = 'memory'` API alias and migration/quarantine tooling.
3. The `sessions.memory_summary` mirror and all fallback reads/writes.
4. Pre-current Game Master state normalization and the old GM state fields.
5. Legacy event-payload readers and compatibility-only diagnostic fields.
6. Legacy content/configuration fallbacks for Avatar traits, Scenario language, Avatar routing keys, and knowledge visibility.

The report deliberately does not recommend removing normal error fallbacks, retry behavior, localization fallbacks, or current additive features merely because they contain the word “fallback.”

## Findings

Severity:

- **P0** — Must be resolved before declaring the clean deployment contract; it affects runtime behavior or database shape.
- **P1** — Live compatibility behavior that should be removed or made strict in the clean contract.
- **P2** — Compatibility-only surface or test/documentation residue; remove as part of cleanup after the runtime contract is fixed.

### P0 — Runtime database schema compatibility

Evidence:

- [`apps/core/src/index.ts:80`](../apps/core/src/index.ts#L80) invokes `alignPostgresSchema(sql)` on every startup.
- [`apps/core/src/infrastructure/db/schema-alignment.ts:3`](../apps/core/src/infrastructure/db/schema-alignment.ts#L3) contains rerunnable `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements, constraint replacement, legacy knowledge checks, quarantine-table creation, and compatibility columns.
- [`infra/postgres/init.sql:133`](../infra/postgres/init.sql#L133) and [`infra/postgres/init.sql:284`](../infra/postgres/init.sql#L284) duplicate compatibility alignment for existing volumes.
- [`infra/postgres/init.sql:156`](../infra/postgres/init.sql#L156) nulls vectors without profile/generation identity so old vectors can be regenerated.
- [`infra/postgres/init.sql:318`](../infra/postgres/init.sql#L318) explicitly preserves old `gm_states.current_avatar_id` and `topics_covered` columns.

Assessment: this is a live migration mechanism for previously initialized volumes, not merely documentation. On a guaranteed fresh database, it is unnecessary and keeps old schema decisions executable.

Recommended clean-slate direction:

- Make `infra/postgres/init.sql` the one canonical schema for the new deployment.
- Remove the startup alignment call and the compatibility-only alignment module/statements.
- Remove old-column preservation and old-data cleanup branches from the bootstrap.
- Keep only current schema constraints and current indexes. Re-evaluate whether `IF NOT EXISTS` is still desired for operational reruns; it is not itself a legacy data-read path.

Deployment consequence: this intentionally abandons existing database volumes, matching the requested fresh-DB deployment. The current deployment documentation correctly warns that editing `init.sql` does not rewrite an existing volume; the redeploy procedure must therefore provision a new volume or explicitly recreate the database.

### P0 — Legacy static knowledge type (`memory`)

Evidence:

- [`packages/shared/src/knowledge-contract-types.ts:14`](../packages/shared/src/knowledge-contract-types.ts#L14) adds `'memory'` to `KnowledgeTypeInput` and exports `LEGACY_KNOWLEDGE_TYPE_ALIAS`.
- [`apps/core/src/api/routes/knowledge.ts:93`](../apps/core/src/api/routes/knowledge.ts#L93), [`:109`](../apps/core/src/api/routes/knowledge.ts#L109), and [`:174`](../apps/core/src/api/routes/knowledge.ts#L174) accept the alias at the HTTP boundary.
- [`apps/core/src/api/routes/knowledge-type-input.ts:13`](../apps/core/src/api/routes/knowledge-type-input.ts#L13) maps `memory` to `avatar_knowledge` and records a warning event.
- [`scripts/audit-legacy-knowledge-memory.ts:158`](../scripts/audit-legacy-knowledge-memory.ts#L158) scans database rows with `knowledge_type = 'memory'`.
- [`scripts/migrate-legacy-knowledge-memory.ts:158`](../scripts/migrate-legacy-knowledge-memory.ts#L158) migrates or quarantines those rows.
- [`apps/core/src/domain/knowledge/legacy-memory-audit.ts:3`](../apps/core/src/domain/knowledge/legacy-memory-audit.ts#L3) and [`legacy-memory-migration.ts:28`](../apps/core/src/domain/knowledge/legacy-memory-migration.ts#L28) implement the classifier and migration plan.
- The schema creates `knowledge_source_quarantines` solely for ambiguous legacy rows: [`infra/postgres/init.sql:75`](../infra/postgres/init.sql#L75).

Assessment: this is explicit API, domain, schema, and operational support for the previous static `memory` category. It should not exist in a fresh-content contract.

Recommended clean-slate direction:

- Make `KnowledgeType` and all request DTOs accept only `avatar_knowledge | world | media`.
- Delete the alias normalizer, warning event, audit/migration scripts, legacy fixture, migration domain files, and migration-only quarantine table/repository projections.
- Keep the reserved metadata-key validation (`userId`, `sessionId`, `conversationId`) as a current invariant, but move it out of the legacy audit module before deleting that module.
- Ensure all new seed/admin paths use explicit canonical types.

### P0 — `sessions.memory_summary` compatibility mirror

Evidence:

- The column is created and aligned in [`infra/postgres/init.sql:268`](../infra/postgres/init.sql#L268) and [`:288`](../infra/postgres/init.sql#L288).
- PostgreSQL reads and writes it in [`apps/core/src/infrastructure/db/repositories/postgres-session.repository.ts:19`](../apps/core/src/infrastructure/db/repositories/postgres-session.repository.ts#L19), [`:43`](../apps/core/src/infrastructure/db/repositories/postgres-session.repository.ts#L43), and [`:108`](../apps/core/src/infrastructure/db/repositories/postgres-session.repository.ts#L108).
- The domain and repository port still expose it in [`apps/core/src/domain/conversation/session.types.ts:11`](../apps/core/src/domain/conversation/session.types.ts#L11) and [`apps/core/src/application/ports/ISessionRepository.ts:38`](../apps/core/src/application/ports/ISessionRepository.ts#L38).
- New-conversation hydration uses it as a query fallback in [`apps/core/src/application/use-cases/start-conversation/start-conversation.use-case.ts:96`](../apps/core/src/application/use-cases/start-conversation/start-conversation.use-case.ts#L96) and [`apps/core/src/application/use-cases/switch-avatar/switch-avatar.use-case.ts:79`](../apps/core/src/application/use-cases/switch-avatar/switch-avatar.use-case.ts#L79).
- Session-memory inspection falls back to it in [`apps/core/src/application/use-cases/get-session-memory/get-session-memory.use-case.ts:21`](../apps/core/src/application/use-cases/get-session-memory/get-session-memory.use-case.ts#L21).
- Admin clear behavior still clears and reports it as `legacySessionSummaryCleared` in [`apps/core/src/application/use-cases/admin-runtime-actions/admin-runtime-actions.use-case.ts:146`](../apps/core/src/application/use-cases/admin-runtime-actions/admin-runtime-actions.use-case.ts#L146) and [`packages/shared/src/runtime-inspector-types.ts:519`](../packages/shared/src/runtime-inspector-types.ts#L519).

Assessment: the canonical working-memory tables now own this state, but the old session-level mirror remains operationally meaningful when the canonical row is absent.

Recommended clean-slate direction:

- Remove `memory_summary` from the schema, session entity, repository port, PostgreSQL/in-memory repositories, reset/clear flows, and admin DTOs.
- Read session memory only from `session_memories` and the current layered memory model.
- Remove tests that seed “legacy session summaries”; replace them with current missing-memory behavior if that behavior remains required.

### P0 — Pre-current Game Master state and orchestration payloads

Evidence:

- [`apps/core/src/infrastructure/db/repositories/postgres-gm-state.repository.ts:4`](../apps/core/src/infrastructure/db/repositories/postgres-gm-state.repository.ts#L4) normalizes every persisted `next_turn_orchestration` payload through the migration module.
- [`apps/core/src/domain/game-master/gm-state-migration.ts:9`](../apps/core/src/domain/game-master/gm-state-migration.ts#L9) identifies the payload as pre-8.5 and reads old fields such as `conversationMode`, `stateUpdate`, `nextAvatarId`, and `suggestedAvatarId`.
- [`apps/core/src/domain/game-master/game-master.types.ts:31`](../apps/core/src/domain/game-master/game-master.types.ts#L31) retains `topicsCovered` for schema/API compatibility even though current logic does not use it.
- [`infra/postgres/init.sql:318`](../infra/postgres/init.sql#L318) preserves old GM columns on existing volumes.

Assessment: current GM state and pre-current persisted GM state are accepted by the same repository path. With a new database, the repository can deserialize only the current shape and the schema can contain only current fields.

Recommended clean-slate direction:

- Delete `gm-state-migration.ts` and its migration tests.
- Replace repository normalization with strict parsing of the current `GameMasterOrchestrationState` shape, or a current-shape mapper that rejects invalid persisted JSON.
- Remove `topicsCovered` from domain/shared contracts and remove references to `current_avatar_id` and `topics_covered` from schema/docs/tests.
- Keep current routing/state validation and safe handling of corrupted current JSON; that is data-integrity behavior, not legacy support.

### P1 — Legacy Game Master output defaults

Evidence:

- [`apps/core/src/domain/game-master/gm-output-parser.ts:57`](../apps/core/src/domain/game-master/gm-output-parser.ts#L57) defaults an omitted `retrievalPlan` to `{ required: false }`.
- [`apps/core/src/domain/game-master/gm-output-parser.ts:63`](../apps/core/src/domain/game-master/gm-output-parser.ts#L63) defaults an omitted `progressionUpdate` to `{ progression: 'none' }`.
- [`docs/GAME_MASTER_CONTRACT.md:191`](../docs/GAME_MASTER_CONTRACT.md#L191) explicitly describes these defaults as backwards compatibility.

Assessment: the current contract says these fields are required, but the parser still accepts older output shapes.

Recommended clean-slate direction: require `retrievalPlan` and `progressionUpdate` in the parser and retain only validation/safe rejection for malformed current output. Update the GM prompt, tests, and contract together.

### P1 — Legacy event payload readers

Evidence:

- [`apps/core/src/application/use-cases/list-session-events/list-session-events.use-case.ts:194`](../apps/core/src/application/use-cases/list-session-events/list-session-events.use-case.ts#L194) accepts either current `sections` payloads or flattened legacy Avatar context payloads.
- [`apps/core/src/application/use-cases/list-session-events/list-session-events.use-case.ts:212`](../apps/core/src/application/use-cases/list-session-events/list-session-events.use-case.ts#L212) does the same for GM context payloads.
- The legacy readers are implemented at [`:541`](../apps/core/src/application/use-cases/list-session-events/list-session-events.use-case.ts#L541) and [`:582`](../apps/core/src/application/use-cases/list-session-events/list-session-events.use-case.ts#L582).
- The same reader preserves old retrieval field variants (`score`, `distance`, `similarity`) at [`:950`](../apps/core/src/application/use-cases/list-session-events/list-session-events.use-case.ts#L950).

Assessment: admin event inspection is a historical-payload compatibility reader. A fresh database has no old event rows.

Recommended clean-slate direction:

- Parse only the current event payload shape.
- Remove `readLegacyAvatarSections` and `readLegacyGmSections`.
- Decide on one current retrieval ranking field. The shared DTO documents `distance` as a compatibility ranking field at [`packages/shared/src/knowledge-contract-types.ts:270`](../packages/shared/src/knowledge-contract-types.ts#L270); remove compatibility-only ranking fields from shared DTOs and presenters if no clean client requires them.
- Remove UI labels for legacy scope-match reasons in [`apps/console/src/components/gm-impact-trace.ts:593`](../apps/console/src/components/gm-impact-trace.ts#L593).

### P1 — Avatar identity and prompt-shape compatibility

Evidence:

- [`apps/core/src/domain/avatar/persona-prompt.service.ts:73`](../apps/core/src/domain/avatar/persona-prompt.service.ts#L73) falls back to flat, pre-structured prompt options when `opts.sections` is absent.
- [`apps/core/src/domain/avatar/persona-prompt.service.ts:135`](../apps/core/src/domain/avatar/persona-prompt.service.ts#L135) explicitly preserves authored `personaPrompt` when prepared `computedTraits` are absent.
- [`apps/core/src/domain/avatar/persona-prompt.service.ts:482`](../apps/core/src/domain/avatar/persona-prompt.service.ts#L482) resolves the identity source from the compatibility path.
- The public contract allows `computedTraits: null` in [`docs/API_CONTRACT.md:92`](../docs/API_CONTRACT.md#L92).

Assessment: the current runtime prefers prepared traits but still serves avatars that have not gone through trait preparation. The clean-content assumption permits a stricter contract, but only if seed/admin workflows prepare every Avatar before activation.

Recommended clean-slate direction:

- Make structured context sections mandatory for internal prompt assembly.
- Make prepared `computedTraits` mandatory for an active Avatar, or fail activation/serving when traits are absent.
- Remove the flat-options resolver, `identitySource` compatibility fallback, nullable trait contract, and related fallback-only tests after the content pipeline is updated.

### P1 — Scenario language and voice-language compatibility

Evidence:

- [`apps/core/src/infrastructure/db/repositories/postgres-scenario.repository.ts:165`](../apps/core/src/infrastructure/db/repositories/postgres-scenario.repository.ts#L165) reads `config.language` when the canonical `scenarios.language` column is empty.
- The in-memory repository mirrors that behavior at [`apps/core/src/infrastructure/db/in-memory-scenario.repository.ts:38`](../apps/core/src/infrastructure/db/in-memory-scenario.repository.ts#L38) and [`:111`](../apps/core/src/infrastructure/db/in-memory-scenario.repository.ts#L111).
- Voice input falls back to `scenario.voiceConfig.language` in [`apps/core/src/application/use-cases/voice-turn/voice-turn.use-case.ts:197`](../apps/core/src/application/use-cases/voice-turn/voice-turn.use-case.ts#L197).
- Admin screens expose a “Legacy voice language fallback” field in [`apps/admin/src/scenarios/ScenarioFormFields.tsx:192`](../apps/admin/src/scenarios/ScenarioFormFields.tsx#L192) and [`ScenarioAvatarForms.tsx:425`](../apps/admin/src/scenarios/ScenarioAvatarForms.tsx#L425).

Assessment: current Scenario language is intended to be authoritative; the old config/voice language values are kept for records created before that field existed.

Recommended clean-slate direction:

- Require a canonical Scenario language for every new/active Scenario.
- Remove reads from `config.language` and voice-level language fallback if all fresh content carries Scenario language.
- Remove legacy wording and fields from admin UI and update the voice contract/docs.

### P1 — Avatar availability key alias

Evidence: [`apps/core/src/application/use-cases/shared/avatar-summary.ts:4`](../apps/core/src/application/use-cases/shared/avatar-summary.ts#L4) prefers `config.availabilityKey` but falls back to the old `config.routeKey` at [`:10`](../apps/core/src/application/use-cases/shared/avatar-summary.ts#L10).

Assessment: this is a direct content-schema alias. It affects summaries returned to clients and can silently preserve old content semantics.

Recommended clean-slate direction: make `availabilityKey` the only supported key and remove the `routeKey` read/fallback and its tests/fixtures.

### P1 — Knowledge visibility compatibility

Evidence:

- [`apps/core/src/domain/knowledge/knowledge-visibility.ts:30`](../apps/core/src/domain/knowledge/knowledge-visibility.ts#L30) can infer `visibilityPolicy: 'avatars'` from IDs alone when the policy is absent.
- [`apps/core/src/domain/knowledge/knowledge-visibility.ts:74`](../apps/core/src/domain/knowledge/knowledge-visibility.ts#L74) enables that inference for actual visibility checks.
- The console treats the `__GM_ONLY__` ID sentinel as a pre-`visibilityPolicy: 'none'` representation in [`apps/console/src/components/runtime-inspector-tab-content.tsx:505`](../apps/console/src/components/runtime-inspector-tab-content.tsx#L505).
- The corresponding compatibility behavior is covered by [`apps/core/src/domain/knowledge/knowledge-visibility.test.ts`](../apps/core/src/domain/knowledge/knowledge-visibility.test.ts) and the runtime-inspector tests.

Assessment: fresh content can use explicit `all`, `avatars`, or `none` policy and does not need either the IDs-only inference or the sentinel.

Recommended clean-slate direction:

- Require `visibilityPolicy` on every persisted static source.
- Remove inference from IDs and reject missing policy/invalid combinations.
- Remove `__GM_ONLY__` handling from the console and migrate all seed/admin data to `visibilityPolicy: 'none'`.

### P1 — Runtime model-resolution fallback wiring

Evidence:

- [`apps/core/src/application/services/model-resolution-runtime.service.ts:36`](../apps/core/src/application/services/model-resolution-runtime.service.ts#L36) accepts a `legacyAdapter` and returns provider/model values of `'legacy'` when the model repository or adapter registry is absent.
- The same service falls back from an absent persisted model configuration to `modelConfigFallback` or `DEFAULT_MODEL_CONFIG` at [`:57`](../apps/core/src/application/services/model-resolution-runtime.service.ts#L57).
- Production startup constructs `runtimeModelConfigFallback` from environment configuration in [`apps/core/src/index.ts:93`](../apps/core/src/index.ts#L93).

Assessment: the missing-dependency branch is compatibility with the pre-runtime-model-config wiring. The missing-row/default-config branch is partly bootstrap resilience, not necessarily legacy support.

Recommended clean-slate direction:

- Make the model repository and adapter registry required for production use cases; remove the `'legacy'` provider branch and `legacyAdapter` parameter.
- Seed a valid current `model_config` row during deployment, then decide whether a default is still wanted for local/test environments.
- Do not remove provider/model selection flexibility unless the new product contract intentionally narrows the supported model matrix.

### P2 — Unused direct-query embedding wrapper

Evidence: [`apps/core/src/application/services/knowledge/knowledge-query-embedding.service.ts:127`](../apps/core/src/application/services/knowledge/knowledge-query-embedding.service.ts#L127) exposes a “Compatibility wrapper” for a single direct query. Repository-wide production search found no caller of this method; current retrieval uses `embedVariants`.

Recommended clean-slate direction: remove the wrapper and its compatibility-only tests once external package consumers have been ruled out.

### P2 — Provider request compatibility for pre-GPT-5 models

Evidence: [`apps/core/src/infrastructure/llm/openai.adapter.ts:120`](../apps/core/src/infrastructure/llm/openai.adapter.ts#L120) selects `max_completion_tokens` for GPT-5 models and `max_tokens` for all other models.

Assessment: this is provider/model compatibility, not legacy product-data support. It should be removed only if the clean deployment explicitly supports GPT-5-family models exclusively. Otherwise it remains a valid part of the LLM-agnostic model matrix.

## Compatibility-like items not classified as legacy removal targets

These were reviewed and should not be removed solely because they use fallback terminology:

- `fallbackLng: 'en'` in the web localization setup is normal localization behavior.
- Error-message fallbacks and UI error-boundary fallbacks are failure handling.
- Episodic-memory reconstruction from messages when a canonical working-memory row is absent is resilience for a failed/incomplete current workflow, not necessarily support for an old schema.
- Retry-ingestion references to a previous job are current job lifecycle semantics.
- `POST /v1/exchange` is still used by the authenticated conversation-evaluation tooling and is therefore a current operational endpoint, not proven legacy.
- The JSON send-message route is documented as a current route; its coexistence with streaming is additive transport behavior, not by itself backward compatibility.
- Current vector profile/dimension validation and failure codes (`incompatible_profile`, `incompatible_dimension`) protect data integrity for the deployed embedding contract; they are not old-schema readers.
- Voice configuration stored under the reserved `config.voiceConfig` JSON key is the current persistence representation, despite request DTOs exposing it as a top-level field.

## Test and documentation impact

The test suite intentionally protects many compatibility paths. Removing them will require deleting or rewriting tests, not just production code. Notable groups include:

- `gm-state-migration*.test.ts`
- `legacy-memory-*.test.ts`
- legacy session-memory fallback cases in `get-session-memory.use-case.test.ts` and admin memory tests
- legacy event reader and legacy retrieval-match cases in session-event tests
- legacy Scenario language, route-key, visibility, and Avatar trait fallback cases
- model-resolution tests that expect provider `'legacy'`

The documentation also currently presents compatibility as part of the contract. At minimum, update [`docs/API_CONTRACT.md`](API_CONTRACT.md), [`docs/DATA_MODEL.md`](DATA_MODEL.md), [`docs/GAME_MASTER_CONTRACT.md`](GAME_MASTER_CONTRACT.md), [`docs/PROJECT_STATUS.md`](PROJECT_STATUS.md), [`docs/TECH_STACK.md`](TECH_STACK.md), and the deployment documentation after implementation.

The root README still advertises “WebSocket + SSE fallback” at [`README.md:72`](../README.md#L72), while the current route inventory and clients found in this audit use SSE. This is a documentation/configuration inconsistency worth resolving during the cleanup, but it was not counted as a confirmed legacy runtime path.

## Proposed implementation order for Step 2

1. Freeze the new canonical contracts: schema, current DTOs, current GM payload, current event payload, Scenario language, Avatar traits, and knowledge visibility.
2. Remove startup schema alignment and build a fresh canonical database bootstrap.
3. Remove knowledge-memory alias/migration/quarantine support while retaining reserved-key validation in a non-legacy module.
4. Remove `memory_summary` and all session-level memory fallback reads/writes.
5. Remove GM state migration and strictify GM output parsing.
6. Remove legacy event readers, score/scope compatibility projections, and related UI labels.
7. Remove content/configuration aliases and require canonical fresh content.
8. Remove compatibility-only tests and documentation, then run typecheck, lint, unit, integration, and stack checks against the fresh deployment path.

## Acceptance criteria for declaring the cleanup complete

- No production source file reads `knowledge_type = 'memory'`, `conversationMode`, `stateUpdate`, `nextAvatarId`, `suggestedAvatarId`, `current_avatar_id`, `topics_covered`, `memory_summary`, or `config.routeKey`.
- No public request schema accepts the `memory` knowledge alias or missing current visibility policy.
- No current runtime path returns provider/model `'legacy'`.
- No event reader accepts flattened pre-current context payloads.
- All active Avatars have prepared `computedTraits`, and all active Scenarios have canonical language.
- Fresh database bootstrap contains no compatibility-only tables/columns/conditional legacy checks.
- Repository-wide search finds no compatibility-only production modules or tests except explicitly retained provider/model behavior justified by the supported model matrix.
- The clean redeploy procedure is documented and verified against a new database volume and fresh seed/content run.

# Code audit: dead, duplicate, and redundant code

Date: 2026-09-14  
Scope: TypeScript source under `apps/`, `packages/`, and `tools/`  
Status: D1-D4 removal complete; R1-R7 cleanup complete.

## Executive summary

The normal quality gates are green, but the repository contains several cleanup opportunities:

- Three private-app UI modules are orphaned from their current entrypoints.
- A group of ingestion use cases and memory/context abstractions is retained by tests or historical
  references but is not wired into the running application.
- API-client, model-config, route-composition, memory, knowledge-normalization, and provider helper
  logic is duplicated across files.
- Stricter TypeScript unused-symbol checks expose four unused constructor properties/parameters and
  one unused local parameter that the current ESLint configuration does not report.

The findings below separate high-confidence dead code from intentional test doubles and from
lower-confidence duplication candidates that should be consolidated only after confirming their
boundary semantics.

## Method

The audit used four complementary checks:

1. Read the repository guidance and source-of-truth architecture/status documents.
2. Built a static relative-import graph from the runtime/package entrypoints:
   `apps/core/src/index.ts`, each browser `main.tsx`, `packages/shared/src/index.ts`, and the
   conversation-evaluation CLI/viewer entrypoints. Package-script entrypoints (seeds, retrieval
   quality, and test configurations) were checked separately so they were not falsely classified
   as dead.
3. Ran TypeScript unused checks with `--noUnusedLocals --noUnusedParameters`, plus an exact
   normalized function-body comparison across non-test source files.
4. Verified the baseline with `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test`.

The static graph is conservative: dynamic framework discovery, external consumers, and package
exports can make a symbol look unused. The private app packages reduce that risk for the app-local
findings; all deletion recommendations should still be confirmed against deployment scripts and
operator workflows.

## Findings: dead or orphaned code

### D1 — Orphaned console and admin modules

Severity: Medium  
Confidence: High  
Category: Dead source files

These modules have no production import from the current app entrypoints:

- [`apps/console/src/pages/AvatarPage.tsx`](../apps/console/src/pages/AvatarPage.tsx) — the active
  console imports [`ScenarioPage`](../apps/console/src/pages/ScenarioPage.tsx) and
  [`UnifiedTestingPage`](../apps/console/src/pages/UnifiedTestingPage.tsx) from
  [`apps/console/src/App.tsx`](../apps/console/src/App.tsx#L1-L15), but not `AvatarPage`.
- [`apps/console/src/components/GuidedShortcuts.tsx`](../apps/console/src/components/GuidedShortcuts.tsx)
  — its exported component and shortcut list have no source consumer.
- [`apps/admin/src/scenarios/scenario-detail-state.ts`](../apps/admin/src/scenarios/scenario-detail-state.ts)
  — the `ScenarioDetailState` union has no source consumer; the active detail page manages its
  state independently.

Impact: these files increase the apparent surface area and preserve old UI concepts that can be
mistaken for supported flows. Their tests, if any are added later, would not prove runtime usage.

Recommendation: remove the orphaned modules and any tests that exist solely for them, after a final
manual check for direct deep-link or bundler entrypoint usage.

### D2 — Retired ingestion use cases retained only by tests

Severity: High  
Confidence: High  
Category: Dead application code

The current knowledge route wires `CreateKnowledgeSourceUseCase`, `TriggerIngestionUseCase`,
`GetIngestionJobUseCase`, and the list/update/delete/retrieval use cases in
[`apps/core/src/api/routes/knowledge.ts`](../apps/core/src/api/routes/knowledge.ts#L31-L35)
and [`apps/core/src/api/routes/knowledge.ts`](../apps/core/src/api/routes/knowledge.ts#L211-L257).
The following application classes have no production import and are referenced only by their unit
tests:

- [`register-knowledge-source.use-case.ts`](../apps/core/src/application/use-cases/register-knowledge-source/register-knowledge-source.use-case.ts)
- [`retry-ingestion-job.use-case.ts`](../apps/core/src/application/use-cases/retry-ingestion-job/retry-ingestion-job.use-case.ts)
- [`run-ingestion-job.use-case.ts`](../apps/core/src/application/use-cases/run-ingestion-job/run-ingestion-job.use-case.ts)
- Their companion `*.types.ts` files.

This looks like residue from the earlier registration/job orchestration shape. The current route
constructs [`KnowledgeIngestionService`](../apps/core/src/application/services/knowledge/knowledge-ingestion.service.ts#L67-L79)
and triggers it through the active use case instead. Keeping the old classes test-backed makes the
suite green while leaving unused production contracts in the application layer.

Recommendation: delete the retired classes, their types, and tests together, unless an external job
runner is intentionally expected to import them. If such a runner exists, make it an explicit
package/script entrypoint and document that ownership.

### D3 — Legacy memory/context/compaction cluster

Severity: High  
Confidence: High  
Category: Dead abstractions

The following symbols have no current production consumer:

- [`ICacheAdapter`](../apps/core/src/application/ports/ICacheAdapter.ts#L1-L12) — no implementation
  or injection site uses this port; the running cache integration uses the concrete Redis
  idempotency store.
- [`IConversationCompactionPort`](../apps/core/src/application/ports/IConversationCompactionPort.ts#L1-L6)
  and [`MessageHistoryCompactionService`](../apps/core/src/application/services/message-history-compaction.service.ts#L1-L39)
  — the service only implements the unused port. Conversation closure now uses the current memory
  maintenance/episodic pipeline.
- [`RuntimeContext`](../apps/core/src/domain/context/context.types.ts#L8-L28) — current context
  assembly uses the structured session-context/context-engine types instead.
- [`conversation-working-memory.policy.ts`](../apps/core/src/domain/memory/conversation-working-memory.policy.ts)
  and [`working-memory-summary.policy.ts`](../apps/core/src/domain/memory/working-memory-summary.policy.ts)
  — the policy pair is not imported by production code; the summary policy is kept alive only by
  the policy test and the unused policy pair.

Impact: these names describe older flat-context and compaction designs, so future changes can be
made against the wrong contract. The test suite still exercises some of them directly, masking the
fact that they are not part of the runtime graph.

Recommendation: remove the cluster as one cleanup unit, including tests that only target the
retired design. Do not remove the current `ConversationWorkingMemory` contracts or repositories;
those are used by the active memory-selection and maintenance flows.

### D4 — Legacy Avatar memory assembler

Severity: Medium  
Confidence: High  
Category: Dead application service

[`AvatarMemoryContextAssembler`](../apps/core/src/application/services/avatar-memory-context-assembler.service.ts)
has no production import. Its only source consumer is its dedicated test file. The current runtime
uses `MemorySelectionService` and the structured Context Engine path instead.

Recommendation: remove this service and its test after confirming that no external script imports
the private `@gami/core` source tree.

### D1-D4 resolution

The pre-deletion repository-wide search covered runtime entrypoints, package scripts, test
configuration, seeds, retrieval-quality tooling, deployment files, package exports, and documented
operator workflows. No executable or documented external-consumer path referenced the targets.

| Finding | Resolution                                                                                                                                                                           | Retained active replacement                                                                                                                  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| D1      | Removed the three orphaned console/admin modules: `AvatarPage.tsx`, `GuidedShortcuts.tsx`, and `scenario-detail-state.ts`. Historical implementation prompts remain as history only. | `ScenarioPage`, `UnifiedTestingPage`, and the active admin scenario detail state                                                             |
| D2      | Removed the three retired ingestion use cases, their three companion type files, and their three tests.                                                                              | `KnowledgeIngestionService` plus the active create/trigger/get/list/update/delete/retrieval use cases wired by `routes/knowledge.ts`         |
| D3      | Removed `ICacheAdapter`, the compaction port/service, `RuntimeContext`, both legacy working-memory policies, and the policy test.                                                    | Redis utterance idempotency, `MemorySelectionService`, `ConversationWorkingMemory`, `session-context`/Context Engine, and memory maintenance |
| D4      | Removed `AvatarMemoryContextAssembler` and its dedicated test.                                                                                                                       | `MemorySelectionService` and structured Context Engine assembly                                                                              |

The deletion removed 21 files. A post-deletion source/package/config search found no remaining
references to the removed symbols. The current knowledge ingestion, memory-selection,
working-memory, Context Engine, and idempotency tests remain in the active suite. R1-R7 are not
closed by this workstream.

## Findings: duplicate or redundant code

### R1 — Three copies of the browser API client protocol

Severity: Medium  
Confidence: High  
Category: Duplicate client infrastructure

[`apps/admin/src/api/client.ts`](../apps/admin/src/api/client.ts#L1-L95),
[`apps/console/src/api/client.ts`](../apps/console/src/api/client.ts#L1-L101), and
[`apps/web/src/api/client.ts`](../apps/web/src/api/client.ts#L1-L142) repeat URL/path normalization,
API-key injection, envelope validation, error conversion, and request handling. The admin and
console implementations are effectively the same apart from the exported request name and one
header detail. Web adds binary/audio and abort handling, but still duplicates the envelope helpers.

The error formatter is also byte-for-byte duplicated in
[`apps/admin/src/api/error.ts`](../apps/admin/src/api/error.ts#L1-L10) and
[`apps/console/src/api/error.ts`](../apps/console/src/api/error.ts#L1-L10).

Impact: a contract or redaction change must be repeated in multiple apps and can drift silently.

Recommendation: extract only the protocol-level helpers first (`normalizeApiUrl`, envelope/error
guards, and error conversion). Keep app-specific request functions and web binary/stream behavior
at their boundaries unless the shared abstraction remains smaller and clearer.

### R2 — Duplicate model-config and Avatar form mappers in the operator apps

Severity: Medium  
Confidence: High  
Category: Duplicate UI mapping logic

The admin and console each implement equivalent `toUpdateModelConfigRequest` and `toOverride`
functions:

- [`apps/admin/src/model-config/ModelConfigPage.tsx`](../apps/admin/src/model-config/ModelConfigPage.tsx#L341-L372)
- [`apps/console/src/pages/ModelConfigPanel.tsx`](../apps/console/src/pages/ModelConfigPanel.tsx#L301-L329)

The console also repeats `buildAvatarOverride` in
[`ScenarioPage.tsx`](../apps/console/src/pages/ScenarioPage.tsx#L627-L641) and
[`avatar-row.tsx`](../apps/console/src/pages/avatar-row.tsx#L293-L308); the same helper exists in
the orphaned `AvatarPage.tsx`.

Impact: provider/model trimming and omission semantics can diverge between authoring and debug
surfaces.

Recommendation: define one small app-consumer mapper per contract family, shared by the admin and
console packages only if their form semantics remain identical. Remove the copy in `AvatarPage`
when D1 is addressed.

### R3 — Duplicate core route-composition helpers

Severity: Medium  
Confidence: High  
Category: Duplicate composition code

The following helpers are repeated with equivalent behavior:

- `resolveWorkingMemoryRepositories` in
  [`apps/core/src/api/routes/sessions.ts`](../apps/core/src/api/routes/sessions.ts#L305-L322) and
  `resolveWorkingMemoryDeps` in
  [`apps/core/src/api/routes/conversations.ts`](../apps/core/src/api/routes/conversations.ts#L430-L447).
- `buildLlmConfig` in
  [`apps/core/src/api/routes/conversations.ts`](../apps/core/src/api/routes/conversations.ts#L449-L457)
  and `resolveServerLlmConfig` in
  [`apps/core/src/api/server.ts`](../apps/core/src/api/server.ts#L493-L501).

These copies exist because route plugins support isolated in-memory test composition, but the
default construction policy is still duplicated and can drift.

Recommendation: centralize the pure config/default factories in a composition module while keeping
test-specific adapter injection explicit.

### R4 — Repeated knowledge validation and normalization helpers

Severity: Medium  
Confidence: High  
Category: Duplicate domain/infrastructure utilities

Examples found by exact body comparison and source inspection:

- `sameProfile` is implemented independently in
  [`knowledge-ingestion.service.ts`](../apps/core/src/application/services/knowledge/knowledge-ingestion.service.ts#L409-L415),
  [`knowledge-query-embedding.service.ts`](../apps/core/src/application/services/knowledge/knowledge-query-embedding.service.ts#L312-L318),
  and [`knowledge-reindex.service.ts`](../apps/core/src/application/services/knowledge/knowledge-reindex.service.ts#L353-L359).
- `assertStaticMetadataAllowed` is repeated in the create and update knowledge-source use cases:
  [`create-knowledge-source.use-case.ts`](../apps/core/src/application/use-cases/create-knowledge-source/create-knowledge-source.use-case.ts#L47-L55)
  and [`update-knowledge-source.use-case.ts`](../apps/core/src/application/use-cases/update-knowledge-source/update-knowledge-source.use-case.ts#L87-L95).
- Metadata and `visibleToAvatarIds` normalization is repeated in the Postgres source and chunk
  repositories at [`postgres-knowledge-source.repository.ts`](../apps/core/src/infrastructure/db/repositories/postgres-knowledge-source.repository.ts#L34-L58)
  and [`postgres-knowledge-chunk.repository.ts`](../apps/core/src/infrastructure/db/repositories/postgres-knowledge-chunk.repository.ts#L55-L77),
  with another visibility normalization copy in the in-memory chunk repository.
- API LLM-override normalization is duplicated in
  [`avatars.ts`](../apps/core/src/api/routes/avatars.ts#L157-L167) and
  [`model-selection-mappers.ts`](../apps/core/src/api/routes/model-selection-mappers.ts#L75-L85).

Impact: validation and normalization behavior can diverge between ingestion/reindex paths,
repositories, and API mappings.

Recommendation: move pure, contract-owned behavior to one domain/application utility. Keep
database-row decoding separate where its `unknown`/JSON parsing behavior is genuinely persistence
specific.

### R5 — Multiple implementations of recent user/avatar exchange pairing

Severity: Medium  
Confidence: Medium  
Category: Duplicate memory-window logic

The codebase has a canonical timestamp-aware exchange selector in
[`conversation-exchange-window.ts`](../apps/core/src/application/services/conversation-exchange-window.ts#L16-L79),
but several active paths independently scan messages for a pending user message followed by an
Avatar message:

- [`get-session-memory-layers.use-case.ts`](../apps/core/src/application/use-cases/get-session-memory-layers/get-session-memory-layers.use-case.ts#L131-L156)
- [`run-game-master.context.ts`](../apps/core/src/application/use-cases/run-game-master/run-game-master.context.ts#L229-L246)
- [`send-message.helpers.ts`](../apps/core/src/application/use-cases/send-message/send-message.helpers.ts#L4-L22)

The input/output shapes and limits differ, so this is not proof that all three should be replaced
blindly. It is a risk of semantic drift around ordering, incomplete exchanges, and bounded limits.

Recommendation: compare the required semantics and make one shared selector configurable by output
shape/limit, or document why each path intentionally uses a different window.

### R6 — Small repeated provider and web-runtime helpers

Severity: Low  
Confidence: High  
Category: Small duplicate helpers

- `createTimeoutSignal` is identical in the Deepgram and Gradium adapters:
  [`deepgram-speech-to-text.adapter.ts`](../apps/core/src/infrastructure/speech/deepgram-speech-to-text.adapter.ts#L307-L331)
  and [`gradium-text-to-speech.adapter.ts`](../apps/core/src/infrastructure/speech/gradium-text-to-speech.adapter.ts#L492-L512).
- The web API and chat runtime each define the same terminal message-event predicate in
  [`conversations.ts`](../apps/web/src/api/conversations.ts#L239-L245) and
  [`message-stream-runtime.ts`](../apps/web/src/chat/message-stream-runtime.ts#L182-L188).
- The web identity and runtime-state modules each define the same `getDefaultStorage` guard in
  [`local-identity.ts`](../apps/web/src/identity/local-identity.ts#L162-L167) and
  [`local-runtime-state.ts`](../apps/web/src/runtime/local-runtime-state.ts#L72-L77).

Recommendation: consolidate only the helpers that have a stable shared owner; the timeout helper
could live in infrastructure speech utilities, while the web predicates/storage guard could live
in a small web-local utility.

### R7 — Unused constructor properties and parameters exposed by stricter TypeScript checks

Severity: Medium  
Confidence: High  
Category: Redundant dependencies/arguments

`tsc --noEmit --noUnusedLocals --noUnusedParameters` reports:

- Unused `chunkRepository` property in
  [`KnowledgeIngestionService`](../apps/core/src/application/services/knowledge/knowledge-ingestion.service.ts#L67-L79).
  Ingestion now writes through the corpus repository, but every caller still passes the chunk
  repository.
- Unused `sessionMemoryRepository` and `avatarSessionMemoryRepository` properties in
  [`GetSessionMemoryLayersUseCase`](../apps/core/src/application/use-cases/get-session-memory-layers/get-session-memory-layers.use-case.ts#L26-L37).
  The route still constructs and passes both dependencies even though this use case reads
  conversation working/episodic repositories instead.
- Unused `llmStart` parameter in [`RunGameMasterUseCase.callLlm`](../apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts#L305-L318).
- Unused `snapshot` parameter in `formatSuggestedAvatar` in
  [`runtime-inspector-tab-content.tsx`](../apps/console/src/components/runtime-inspector-tab-content.tsx#L845-L852).

Impact: unused dependencies obscure actual ownership and make composition signatures larger than
the behavior they support. This is also a missed signal because the repository's default TypeScript
configs do not enable these unused checks.

Recommendation: remove the unused parameters/properties and their wiring in a focused cleanup
change. Consider enabling the unused checks in CI once any intentional exceptions are explicitly
annotated.

Resolution: R7 is complete. The ingestion and memory route constructors no longer accept unused
repositories, `callLlm` no longer accepts the unused LLM start timestamp, and the console formatter
accepts only the decision payload it reads. The strict unused-symbol check passes for Core.

### R3, R4, and R7 resolution record — EPIC 11.1 prompt 03

Reviewed: 2026-09-14

R3 is resolved by moving working-memory repository defaults to the API-owned
[`composition.ts`](../apps/core/src/api/composition.ts) helper. LLM configuration uses the existing
infrastructure-owned [`buildLlmConfig`](../apps/core/src/infrastructure/llm/index.ts) implementation;
the duplicate route/server projections were removed rather than creating a second composition owner.
Route-specific options and adapter injection remain local to each route for isolated tests.

R4 is resolved only where semantics match. Embedding profile equality is owned by the application
knowledge helper; create/update source validation shares the application use-case validation helper;
the domain visibility normalizer is reused by the typed in-memory repository; and API Avatar override
normalization is owned by the Core model-selection mapper. Postgres row decoding, JSON/`unknown`
normalization, and ingestion/reindex error mapping remain intentionally separate because their input
boundaries or failure semantics differ.

R7 is resolved as recorded above. No endpoint, schema, persistence, provider, or runtime-order
behavior changed, and the public source-of-truth contracts remain unchanged.

### R1 and R2 resolution record — EPIC 11.1 prompt 02

Reviewed: 2026-09-14

R1 is resolved by placing URL/path normalization, the health-path API-key rule, response-envelope
guards, and the shared client error runtime shape in
[`api-client-protocol.ts`](../packages/shared/src/api-client-protocol.ts). Admin, console, and web
keep their JSON request functions because their method/header policies differ. Web binary/audio,
streaming, and abort/reconnect lifecycle code remains web-owned. The duplicated admin/console error
formatters remain app-local because their fallback copy is UI-owned and were explicitly marked for
follow-up rather than folded into the protocol package.

R2 is resolved by placing equivalent model-config request mapping and Avatar override normalization
in [`model-config-contract-mappers.ts`](../packages/shared/src/model-config-contract-mappers.ts).
Admin and console retain their form state, validation, hydration, and presentation helpers; only the
contract-level trimming, omission, null clearing, and field mapping are shared. No endpoint shape,
authentication behavior, stream behavior, binary response handling, or abort semantics changed.

### R5 and R6 resolution record — EPIC 11.1 prompt 03

Reviewed: 2026-09-14

R5 is resolved by reusing the application-owned exchange selector for the session memory-layer
projection and the Avatar send-message dialogue window. Both paths sort message history by
timestamp, pair only complete user→Avatar exchanges, preserve empty content, ignore system and
incomplete turns, and apply the same trailing limit. The GM mapper remains separate because it
consumes an already bounded context projection without timestamps, working-memory fallback, or an
independent cap; its output is a retrieval-query shape rather than the shared memory projection.

R6 is resolved with three minimal boundary helpers: the Core infrastructure speech timeout helper,
the web-local terminal message-event predicate, and the web-local browser-storage availability
guard. Deepgram and Gradium retain provider-specific status/error/cancellation mapping. Web stream
reader cancellation, interruption cleanup, audio delivery, and playback remain app-owned. No API,
memory, Game Master, provider, or runtime-order contract changed.

## Deliberately not classified as dead code

The following patterns were reviewed and excluded from the dead-code list:

- In-memory and Postgres repositories: they are parallel implementations required by deterministic
  unit/route tests and production persistence.
- Seed scripts, retrieval-quality tooling, and Vitest configuration files: they are package-script
  entrypoints rather than imports from the application runtime.
- Speech/embedding test adapters: they are explicitly test support and are used by tests; they are
  not silent production fallbacks.
- Shared-package exports: a local search cannot prove that a public shared contract has no external
  consumer, even when the current apps do not import every export.
- The raw `/v1/exchange` route: it is still registered and covered by route/stack tests, so it is
  not an orphaned compatibility route based on this audit alone.

## Recommended cleanup order

1. Remove the orphaned app modules in D1 and the unused dependency/argument wiring in R7.
2. Confirm and remove the retired ingestion and legacy memory/context clusters in D2–D4, including
   tests that only keep those paths alive.
3. Consolidate the highest-risk duplicate protocol and mapping utilities in R1–R4.
4. Decide whether the exchange-window variants in R5 are intentionally different; consolidate or
   document the distinction. (Complete.)
5. Handle the low-impact helper copies in R6 opportunistically. (Complete.)

## Verification

All checks were run against the unchanged implementation before writing this report:

- `pnpm lint` — PASS; 7 Turbo tasks successful.
- `pnpm typecheck` — PASS; 7 Turbo tasks successful.
- `pnpm build` — PASS; 6 Turbo tasks successful.
- `pnpm test` — PASS; 7 Turbo tasks successful; 166 core test files and 1,145 core tests passed.

The stricter unused-symbol check intentionally reports the R7 findings and is not part of the
repository's default gate.

## Contract ownership record: EPIC 11.1 prompt 00

Reviewed: 2026-09-14

This record establishes ownership before any R1-R7 cleanup. Prompt 00 makes no runtime, endpoint,
schema, provider, or public-contract changes. A future owner marked `new` is a deliberately small
owner designation for the next cleanup prompt; the implementation remains in its current file
until that prompt verifies the exact call-site semantics.

### R1 — Browser API client protocol

| Candidate                                                                                                 | Current copies / boundary check                                                                                       | Canonical owner                                                                   | Decision                                                |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `ApiResponse`, `ApiError`, `ErrorCode`, and envelope meaning                                              | Shared DTOs in `packages/shared/src/api-response.ts`; all three clients consume them                                  | `packages/shared/src/api-response.ts`                                             | Keep intentionally separate from client implementations |
| URL/path normalization, API-key path rule, envelope/error guards, and the client `ApiError` runtime shape | Repeated in the three browser clients; no `Blob`, `AbortSignal`, or provider behavior is required by the pure portion | `packages/shared/src/api-client-protocol.ts` (new)                                | Consolidate                                             |
| JSON request functions                                                                                    | Admin omits `Content-Type` for bodyless requests; console/web always set it; method unions also differ                | Each app's `src/api/client.ts`                                                    | Keep intentionally separate                             |
| Binary/audio requests, abort handling, and stream parsing                                                 | Web-only `Response`/`Blob`/`AbortSignal` lifecycle                                                                    | `apps/web/src/api/client.ts` and stream modules                                   | Keep intentionally separate                             |
| `formatApiError` UI fallback formatting                                                                   | Admin and console have identical current code, but fallback text is owned by each UI surface                          | App-level adapter around the shared error shape; revisit with the protocol helper | Needs follow-up investigation                           |

### R2 — Operator model and Avatar form mappers

| Candidate                                                                        | Current copies / boundary check                                                                                         | Canonical owner                                                                                                                     | Decision                                       |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `ModelSelectionOverride`, `UpdateModelConfigRequest`, and Avatar mutation fields | Public field names and optionality are already shared in `packages/shared/src/`; form state is local to each UI         | `packages/shared/src/model-catalog.ts`, `packages/shared/src/runtime-inspector-types.ts`, and `packages/shared/src/entity-types.ts` | Keep intentionally separate from UI form state |
| Trimming/omission of provider/model form values                                  | Admin and console `toOverride` have equivalent `undefined` omission semantics                                           | `packages/shared/src/model-config-contract-mappers.ts` (new, pure primitive-input helper)                                           | Consolidate                                    |
| Whole model-config form-to-request mapping                                       | Admin and console forms are structurally equivalent today, but their form types and validation messages remain UI-owned | The shared pure mapper above, with thin app-local form adapters                                                                     | Consolidate                                    |
| Avatar override payload mapping                                                  | Console `ScenarioPage`, `avatar-row`, and orphaned `AvatarPage` copies have identical `null`/trim behavior              | The same shared contract-mapper owner; `AvatarPage` is handled by D1 separately                                                     | Consolidate                                    |
| Form-to-control projections and validation-detail text                           | Browser state and operator copy, not public contract ownership                                                          | Each app/page                                                                                                                       | Keep intentionally separate                    |

### R3 — Core route composition

| Candidate                                              | Current copies / boundary check                                                                                                             | Canonical owner                                                 | Decision                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------- |
| Working-memory repository defaults                     | `sessions.ts` and `conversations.ts` create the same in-memory defaults so isolated route tests can inject adapters                         | `apps/core/src/api/composition.ts` (new API composition helper) | Consolidate                 |
| LLM config defaults                                    | `conversations.ts` and `server.ts` duplicated an existing provider/API-key projection; this is composition, not domain configuration policy | `apps/core/src/infrastructure/llm/index.ts` (`buildLlmConfig`)  | Consolidate                 |
| Route-specific dependency injection and test overrides | Route options intentionally remain local so tests can provide isolated repositories/adapters                                                | Each route's options and composition entrypoint                 | Keep intentionally separate |

### R4 — Knowledge validation and normalization

| Candidate                                                      | Current copies / boundary check                                                                                                                     | Canonical owner                                                                       | Decision                    |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------- |
| Embedding profile equality (`provider`, `model`, `dimensions`) | Equivalent pure comparisons in ingestion, query embedding, and reindex services; `EmbeddingProfile` is application-owned                            | `apps/core/src/application/services/knowledge/embedding-profile.ts` (new pure helper) | Consolidate                 |
| Reserved static-scope-key detection                            | `findReservedStaticScopeKeys` already owns recursive traversal in `apps/core/src/domain/knowledge/static-knowledge-validation.ts`                   | Existing domain helper                                                                | Consolidate                 |
| Create/update static metadata validation                       | Create and update use cases have the same input and `DomainError` failure semantics                                                                 | `apps/core/src/application/use-cases/shared/knowledge-validation.ts`                  | Consolidate                 |
| Validation failure mapping for ingestion/reindex/persistence   | The same reserved-key predicate is mapped to ingestion errors, reindex errors, or persistence errors at different boundaries                        | Each owning service/repository                                                        | Keep intentionally separate |
| Typed visibility policy normalization                          | `knowledge-visibility.ts` owns `all`/`avatars`/`none`, trimming, and `undefined` omission for domain values                                         | `apps/core/src/domain/knowledge/knowledge-visibility.ts`                              | Consolidate                 |
| Persistence row decoding and JSON/`unknown` normalization      | Postgres source/chunk repositories must decode JSON text, tolerate row-driver shapes, and map dates/IDs; in-memory storage has a different boundary | Each repository adapter, using the domain visibility helper only after decoding       | Keep intentionally separate |
| API LLM-override normalization                                 | `avatars.ts` repeats the same mapper already present in `model-selection-mappers.ts`; both preserve `undefined` versus `null`                       | `apps/core/src/api/routes/model-selection-mappers.ts`                                 | Consolidate                 |

### R5 — Recent user/Avatar exchange selection

| Candidate                                                           | Current copies / boundary check                                                                                                                      | Canonical owner                                                                                        | Decision                                                          |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Timestamp-aware completed-exchange selection and message projection | `conversation-exchange-window.ts` sorts by timestamp, pairs complete exchanges, and supports working-memory coverage fallback                        | `apps/core/src/application/services/conversation-exchange-window.ts`                                   | Keep intentionally separate as the canonical application selector |
| Session memory-layer projection                                     | `get-session-memory-layers.use-case.ts` has an admin DTO-specific fixed limit and repository fetch bound; it emits `SharedShortTermMemoryExchange[]` | `conversation-exchange-window.ts` owns pairing/order; the use case owns fetch bound and DTO projection | Consolidate                                                       |
| GM recent-exchange projection                                       | `run-game-master.context.ts` consumes an already bounded context projection and has no timestamp fallback or independent cap                         | GM context mapper                                                                                      | Keep intentionally separate                                       |
| Avatar send-message dialogue window                                 | `send-message.helpers.ts` applies an explicit per-call cap and maps Avatar messages to LLM `assistant` roles                                         | `conversation-exchange-window.ts` owns pairing/order; send-message helper owns LLM `assistant` mapping | Consolidate                                                       |

The GM projection and LLM assistant-role mapping remain separate because their input/output
contracts differ. The shared selector now owns only the verified common pairing, ordering, and
trailing-cap semantics.

### R6 — Provider, stream, and browser-runtime helpers

| Candidate                                                         | Current copies / boundary check                                                                                                             | Canonical owner                                                                     | Decision                    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------- |
| Timeout signal creation                                           | Deepgram and Gradium implementations are byte-equivalent; provider error mapping around them is not                                         | `apps/core/src/infrastructure/speech/timeout-signal.ts` (new infrastructure helper) | Consolidate                 |
| Terminal message-event predicate                                  | `apps/web/src/api/conversations.ts` and `apps/web/src/chat/message-stream-runtime.ts` recognize the same three shared stream terminal types | `apps/web/src/chat/message-stream-events.ts` (new web-local helper)                 | Consolidate                 |
| `localStorage` availability/default guard                         | Identity and runtime-state modules use the same browser-only guard and `StorageLike` boundary                                               | `apps/web/src/storage.ts` (new web-local helper)                                    | Consolidate                 |
| Provider-specific status/error/cancellation mapping               | Deepgram and Gradium translate failures into different typed port errors                                                                    | Each speech adapter                                                                 | Keep intentionally separate |
| Audio delivery, stream interruption cleanup, and browser playback | `Blob`, `AbortSignal`, response headers, and client lifecycle are web-owned                                                                 | Web API/chat modules                                                                | Keep intentionally separate |

### R7 — Unused dependencies and parameters

| Candidate                                                                                                    | Verified owner after removal                                                                                     | Decision |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------- |
| `KnowledgeIngestionService.chunkRepository` and route wiring                                                 | Corpus repository owns active ingestion writes; chunk repository remains an independent persistence/test adapter | Remove   |
| `GetSessionMemoryLayersUseCase.sessionMemoryRepository` and `avatarSessionMemoryRepository` and route wiring | Conversation working/episodic repositories and `MemorySelectionService` own the active read path                 | Remove   |
| `RunGameMasterUseCase.callLlm` `llmStart` argument                                                           | GM use-case timing is measured by the existing `gmRunStartMs`/response timing path                               | Remove   |
| `formatSuggestedAvatar` `snapshot` argument                                                                  | The decision payload alone owns the formatted recommendation                                                     | Remove   |

### Cross-cutting contract drift check

- Public response envelopes and DTO field names remain owned by `packages/shared/src/`; no inline
  replacement response shape is introduced by this record.
- Model mappings preserve `provider`/`model`, trim only the model text where the current mapper
  does so, and preserve `undefined` omission versus explicit `null` clearing.
- Knowledge mappings preserve `visibilityPolicy` and optional `visibleToAvatarIds`; persistence
  adapters retain their separate `unknown`/JSON/date/ID decoding responsibilities.
- Memory mappings preserve user/avatar pairing, timestamp ordering, caps, and the distinction
  between Avatar `assistant` messages and shared `avatar` message DTOs.
- Stream mappings preserve the three terminal event types and browser interruption behavior.

The source-of-truth architecture, API, data-model, Game Master, memory, and test contracts already
state these layer boundaries and do not require behavioral edits for prompt 00. `PROJECT_STATUS.md`
and `EPICS.md` are updated only to record that this ownership prerequisite is complete; EPIC 11.1
remains open.

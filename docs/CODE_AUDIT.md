# Code audit: dead, duplicate, and redundant code

Date: 2026-09-14  
Scope: TypeScript source under `apps/`, `packages/`, and `tools/`  
Status: Audit only — no implementation or test code was changed.

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
   document the distinction.
5. Handle the low-impact helper copies in R6 opportunistically.

## Verification

All checks were run against the unchanged implementation before writing this report:

- `pnpm lint` — PASS; 7 Turbo tasks successful.
- `pnpm typecheck` — PASS; 7 Turbo tasks successful.
- `pnpm build` — PASS; 6 Turbo tasks successful.
- `pnpm test` — PASS; 7 Turbo tasks successful; 166 core test files and 1,145 core tests passed.

The stricter unused-symbol check intentionally reports the R7 findings and is not part of the
repository's default gate.

# Project Status

Last updated: 2026-09-12
Current phase: Phase A core runtime delivered through EPIC 8.5 Prompt 4; EPIC 8.6 scripted evaluation delivered; EPIC 4.2d static/conversational RAG boundary enforced; EPIC 9.1 voice implementation and deterministic hardening delivered; EPIC 9.2 Prompts 00-01 voice/audio contracts and provider-neutral configuration delivered

## Snapshot

The platform is now a working headless conversational runtime with:

- persistent scenarios, avatars, sessions, conversations, and messages
- direct avatar response flow
- async Game Master orchestration
- deterministic layered memory
- typed knowledge ingestion and retrieval
- scenario-shared static retrieval with canonical `avatar_knowledge | world | media` categories,
  Avatar-only visibility filtering, bounded GM visibility bypass, and independent conversational-memory lifecycle
- canonical retrieval query/candidate/result/trace/failure contracts with safe shared DTO and
  runtime-event mappers; ordered query vectorization and the filtered pgvector repository boundary
  are delivered, including unified admin/runtime/console diagnostics
- provider-neutral embedding contract foundation with explicit profile identity, ordered batch
  metadata, finite typed failures, and an explicitly injected deterministic test fake
- production OpenAI embedding adapter with independent profile/batch configuration, deterministic
  batching and ordering, response validation, typed provider failures, and bounded observability
- deterministic context assembly for Avatar and GM
- runtime SSE events and runtime-state snapshots
- admin inspection, replay, and memory-control tooling
- scenario-builder admin surfaces
- public web chat surface
- authenticated scripted evaluation tooling with semantic judging through the raw exchange boundary,
  strict JSON results, nullable cost semantics, model mismatch reporting, atomic incremental reports,
  deterministic fake-HTTP composition coverage, and an opt-in Villa Miralac definition
- progressive avatar-response rendering in the public web chat surface
- multi-model runtime configuration
- request and turn observability
- canonical shared message-stream DTOs and reusable SSE frame parsing for web and console clients
- additive internal LLM streaming contracts with native OpenAI, Anthropic, Mistral, xAI, null, and
  observed adapter support
- reusable streaming send-message execution with ordered deltas, terminal avatar persistence, and
  deterministic interruption handling
- additive SSE message-stream route with stack-e2e contract coverage
- web message-stream client and in-memory avatar-draft reconciliation with completion and
  interruption tests
- streaming cleanup and ordering hardening: contiguous client delta rendering, abort listener and
  reader cleanup, provider iterator cleanup, exact-once terminal persistence, and legacy JSON route
  contract coverage
- provider-neutral voice input contracts with bounded audio/transcript normalization, finite
  speech-to-text failures, cancellation, deterministic adapter/idempotency fakes, and at-most-once
  utterance identity semantics
- optional production Deepgram pre-recorded speech-to-text adapter with validated configuration,
  bounded request/response handling, typed timeout/rate-limit/provider failure mapping, injectable
  transport tests, and redacted bounded observability; no raw-audio persistence
- voice-turn application coordinator that validates active conversations, reserves utterance
  identities, and delegates finalized transcripts to the existing synchronous/streaming turn flows
- authenticated raw-binary synchronous and SSE voice routes with bounded Fastify parsing, standard
  API error envelopes, canonical message response/event mappings, and real-stack contract tests
- voice hardening coverage for concurrent duplicate submissions, post-transcription cancellation,
  unavailable-provider behavior with text-route continuity, latency/failure observability,
  provider-payload redaction, and environment-gated stack happy-path success checks
- canonical shared voice-output contracts for logical voice configuration, client audio preferences,
  supported browser output formats, and bounded transient binary-delivery metadata; no synthesis,
  audio route, playback UI, provider SDK, or audio persistence is included

## What Is Shipped

### Conversation Runtime

- Sessions contain one or more bounded conversations.
- Avatars answer users directly; the Game Master never blocks the normal reply path.
- Conversations can be started, ended, switched, listed, and replayed through documented APIs.
- Session runtime state and safe runtime events are exposed for reconnect and live UI updates.

### Game Master

- GM runs asynchronously after completed avatar turns and can also run on session start or manual replay.
- GM can inject notes, suggest or switch avatars, unlock avatars, and update lightweight orchestration state.
- GM decisions are validated by runtime guards before they affect session state; conversation
  lifecycle remains owned by the existing platform switch use case.
- GM output is stored as turn-scoped next-turn orchestration state; the next Avatar turn consumes matching dialogue guidance and retrieval intent exactly once.
- GM retrieval queries and required facts are used as RAG query variants, and are instructed to follow the Scenario description language used by the knowledge documents. The GM prompt treats retrieval as forward-looking preparation for the next related turn, anticipating likely continuation context in addition to handling exact questions, contradictions, and knowledge-boundary issues.
- Avatar retrieval keeps the best distinct match for the user question, GM retrieval queries, and GM required facts before filling remaining slots by global score; retrieval diagnostics preserve the matched input and chunk content for console inspection. Runtime events now expose the GM retrieval plan and link it to the subsequent Avatar turn, including per-proposal match outcomes.
- Required retrieval gaps inject explicit uncertainty guidance, and invalid routing falls back to `stay` without changing progression or memory ownership.
- Safe GM diagnostics are recorded in the event log and exposed through admin APIs.
- Invalid-output traces and parser failures record bounded metadata only; raw prompts, user
  messages, and model responses are excluded.
- GM state no longer persists legacy topic updates or interaction increments; session/conversation
  state owns Avatar routing and application code increments completed-exchange counts.
- Prompt 4 regression coverage protects the output contract, dynamic routing schemas, next-turn
  retrieval planning, unrelated-question stale-plan suppression, dialogue-control modes, stale
  orchestration state, persistence failure diagnostics, prompt sizing, and the scoped Mona
  contradiction flow.

### Memory

- Working memory, episodic memories, and long-term facts are all implemented.
- Conversation closure triggers memory compaction instead of relying on full transcript replay.
- Working memory now includes `summary`, `unresolvedThreads`, and `coveredTopics`.
- Memory compaction is the sole writer of `summary`, `coveredTopics`, `unresolvedThreads`, and
  `candidateFacts`; Avatar claims remain untrusted unless user-supported or provenance-labeled.
- Contradicted Avatar claims are filtered before working-memory persistence, while user-supported
  and verified-context claims remain eligible.
- Legacy GM state and pending orchestration records remain readable through compatibility
  normalization, with ambiguous legacy routing ignored.
- Legacy `topics_covered` values remain persistence-compatible but are omitted from current
  shared/admin GM projections.
- Memory layers are inspectable through admin routes and runtime tooling.

### Knowledge And Context

- Knowledge sources support typed ingestion (`avatar_knowledge`, `world`, `media`) with ingestion jobs.
- Text ingestion keeps complete paragraphs together, packs them toward the target chunk size, and
  carries the active Markdown header path into every relevant chunk before embedding.
- Avatar-scoped visibility filtering is enforced before avatar context assembly.
- GM retrieval is intentionally unrestricted for orchestration decisions.
- Admin retrieval diagnostics use the unrestricted GM view when no active avatar is selected.
- Context Engine assembles bounded Avatar and GM projections with deterministic precedence and trace metadata.
- Avatar prompt assembly consumes structured runtime sections, including prepared avatar traits when available.

#### EPIC 4.2d static terminology and migration ✅ Prompt 01 complete

The static-knowledge/conversational-memory ownership baseline is now recorded in
`docs/CONTEXT_CONTRACT_OWNERSHIP_MAP.md`. `@gami/shared` owns the HTTP `KnowledgeType` tuple and
DTOs; Core domain owns internal knowledge entities and conversational-memory entities; explicit
application/API mappers connect those shapes. Canonical static values are now
`avatar_knowledge | world | media`. The temporary `memory` compatibility value is accepted only
as an API input and is normalized before application/domain code.

`pnpm audit:legacy-memory -- --dry-run` provides a repeatable non-mutating audit from
either a metadata-only export or PostgreSQL. It reports safe IDs, visibility, recursive reserved
scope keys, and conservative classifications for legacy static `memory` sources. The companion
`pnpm migrate:legacy-memory -- --dry-run` command produces a deterministic migration plan; apply
mode changes only positively classified rows and blocks ambiguous rows in the quarantine table.
Neither command emits source content, vectors, metadata values, or user facts. New and updated
static source/chunk metadata rejects reserved user/session/conversation scope keys.

#### EPIC 4.2d shared RAG scope and lifecycle boundaries ✅ Prompt 02 complete

Static retrieval now accepts only scenario/query/Avatar-visibility inputs. Candidates are limited
by canonical type, ready source, active corpus, and visibility; the explicit GM bypass changes
visibility only. User/session/conversation scope filtering, score boosts, request fields, and
retrieval diagnostics were removed, and admin/console clients use the shared request contract.
Source/chunk create, update, ingestion, and reindex writes reject reserved scope metadata.
Reset, conversation close, memory maintenance, and static reindex remain independent owners, with
focused coverage for shared candidates, visibility bypass limits, and lifecycle non-interference.

#### EPIC 4.2d separated context projections ✅ Prompt 03 complete

Context Engine, Avatar, GM, admin, event, and console projections now expose conversational state
and static retrieval as distinct `conversationState` and `retrievedContext` sections. Recent
exchanges/messages, working memory, episodic memories, and long-term facts remain bounded under
Conversation State; `avatar_knowledge`, `world`, and `media` retain static provenance under
Retrieved Context. Avatar uses the filtered retrieval result, while GM uses its explicit bypass
result without fallback. Prompt renderers use stable section headings, and retrieved documents do
not enter memory maintenance or fact extraction inputs through prompt injection.

#### EPIC 4.2d operator diagnostics ✅ Prompt 04 complete

Existing admin and console inspection surfaces now use explicit operator categories: Shared Avatar
Knowledge, Shared World Knowledge, Media Knowledge, Conversation Working Memory, Episodic Memory,
and Long-Term User Facts. Static source views include scenario ownership, Avatar visibility, and
safe blocked/quarantine details. Conversation memory views include user, session, and conversation
scope where applicable. `SessionMemoryLayers.userId` is part of the shared inspection DTO. No new
operator endpoint was required; the existing source list, retrieval tester, session context, event,
and memory-layer surfaces remain the owners. Source presenters recursively redact content/vector
metadata from operator output, and legacy event match-basis names are normalized at the reader/UI
boundary without restoring static user/session/conversation scope.

#### EPIC 4.2d isolation proof and documentation ✅ Prompt 05 complete

The final requirements-to-tests matrix is checked in at
`docs/EPIC_4_2D_REQUIREMENTS_MATRIX.md`. Deterministic coverage proves identical static retrieval
for callers with the same scenario/query/Avatar visibility, isolation of working/episodic/fact
layers, bounded separated prompt sections, GM bypass limits, alias/quarantine safety, and
retrieved-context non-contamination. Lifecycle coverage includes close, switch, hydration, reset,
static reindex, memory maintenance, and the PostgreSQL-gated scenario source/chunk cascade.

EPIC 4.2d is complete. The Phase A API does not expose a whole-user deletion aggregate; its
implemented user-scoped deletion boundary is the user-fact deletion use case, while session reset
and scenario deletion retain their documented independent ownership.

Final gates on 2026-09-10 passed for Core (982 tests and coverage), Admin, Console, Web,
typecheck, lint, formatting, and build. Stack E2E remained skipped by its existing preflight
because `http://localhost:3000` was unavailable; PostgreSQL integration remained unavailable in
the environment. The repository-wide test command additionally hit unrelated conversation-
evaluation viewer tests that require loopback `listen` and received sandbox `EPERM`; the Core
suite passed independently.

#### EPIC 5.1c embedding, corpus, and safe reindexing ✅ Complete

The application embedding port now owns `EmbeddingProfile`, ordered batch request/result metadata,
provider-neutral usage, and finite typed failures. `KnowledgeChunk` stores a readonly vector value,
and ingestion consumes the canonical batch result. The hash adapter is test support only and
requires an explicit profile; production composition no longer falls back to hash vectors.

The OpenAI adapter is now wired into production composition. The default profile is OpenAI
`text-embedding-3-small` shortened to 16 dimensions to remain compatible with the current
`VECTOR(16)` schema; `EMBEDDING_PROVIDER`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, and
`EMBEDDING_BATCH_SIZE` are independent from chat-role configuration. The internal persistence
slice now stores immutable profiles and corpus generations, tracks reindex operation/source
progress, invalidates legacy unprofiled vectors, isolates staged chunks, validates completeness,
and atomically promotes one active generation/profile through a database-owned singleton pointer.
Normal source ingestion now snapshots the active profile/generation, requires one compatible finite
vector per chunk, and publishes the replacement transactionally with source readiness. Stale
profile/generation work is rejected without replacing the previous active source. The application
also exposes `KnowledgeQueryEmbeddingService` as the single profile-aware, ordered batch
query-vector boundary for EPIC 5.1d. It normalizes every configured query source, validates
complete provider output, returns controlled failures without partial vectors, and emits safe
profile/count/timing diagnostics.
The deployed schema remains fixed at `VECTOR(16)` with `vector_cosine_ops`; configuration rejects
another dimension until its migration and full staged reindex exist. Full reindex orchestration is
now available through the authenticated operator start/status/retry routes, with source snapshots,
idempotent staging, interrupted-worker recovery, completeness validation, and atomic promotion.
Hardening coverage verifies production composition, PostgreSQL typmod/index invariants, staging
isolation, rollback/promotion safety, stale work rejection, deterministic adapter failures, and
safe observability. Opt-in live provider checks remain environment-gated; the OpenAI embedding
check passed in the current verification run, while Mistral smoke checks were skipped by provider
quota/rate-limit responses.
Public source/chunk/ingestion-job DTOs are unchanged and continue to be owned by `@gami/shared`.

#### EPIC 5.1d retrieval contracts and runtime ✅ Complete

The retrieval audit established one shared query-source/variant contract and domain ownership for
vector candidates, typed results, traces, and controlled failures. `@gami/shared` now owns safe
retrieval references and diagnostic DTOs used by admin responses, recorded runtime context, and
console-derived views. Cosine distance is the repository truth and normalized similarity is
`1 - distance`; presenter mappers clamp/round only at the public boundary. Diagnostics include
bounded profile, timing, count, visibility, query-index, outcome, and failure fields without raw
vectors. Candidate exclusions distinguish duplicate removal from bounded selection drops when
available; SQL eligibility exclusions remain optional because retrieval does not perform an extra
corpus scan. The typed runtime now uses the same profile-aware query-vector boundary and filtered
`IKnowledgeChunkRepository.searchByVector` path for Avatar, asynchronous Game Master, and admin
retrieval. Multi-query/type candidates are merged deterministically by normalized similarity,
deduplicated, and passed to the existing balanced selection and Context Engine boundaries; the
production lexical scorer and metadata boosts are no longer used. Avatar retrieval remains
filtered while GM retrieval requests explicit unrestricted visibility. Embedding and vector-search
failures produce bounded controlled outcomes, preserving Avatar response generation and
required-evidence guidance. Runtime turn events and session-context inspection now carry the
canonical retrieval trace plus explicit final Context Engine kept/trimmed segment counts. Admin,
console, and recorded-event projections reuse the shared diagnostic DTOs; the scripted evaluation
tool has no direct knowledge retrieval path and remains routed through conversation APIs. The
deterministic in-memory vector repository and PostgreSQL
integration coverage verify ordering, filtering, visibility asymmetry, safe failures, and
index-compatible query shape. A deterministic semantic-fixture regression now proves multilingual
paraphrase proximity, unrelated-vector exclusion, matched-variant mapping, and active-profile
consistency through the application retrieval boundary. The complete requirements-to-tests matrix
is maintained in [EPIC_5_1D_REQUIREMENTS_MATRIX.md](EPIC_5_1D_REQUIREMENTS_MATRIX.md). Admin
presentation remains additive and contract-compatible.

The final verification run on 2026-09-09 passed the deterministic repository test suite (958 core
tests; all workspace packages passed), typecheck, lint, build, formatting, and diff checks. The
targeted PostgreSQL vector, runtime-context, and Game Master integration tests passed 11/11 with
the local pgvector service. The stack-E2E command remains environment-limited when no application
is listening at `APP_URL`; the broader integration run also remains limited by the configured
Mistral provider quota/rate-limit warnings. These limitations do not weaken the deterministic
retrieval proof or change production behavior.

### Operations

- Health, metrics, session inspection, session events, session context, and session memory endpoints are live.
- Admin runtime actions include GM replay, memory refresh, and memory clear.
- Global, role, scenario, and avatar model selection are configurable with deterministic precedence.
- Observability captures latency, token usage, effective model resolution, and safe runtime metadata.
- Live-provider smoke tests preserve real success coverage while dynamically skipping recognized
  transient provider outages and exhausted test-account quotas.

### Apps

- `apps/console` is the local operator/debug surface.
- `apps/web` is the public player-facing chat surface.
- Scenario-builder flows cover scenario/avatar editing, knowledge-source authoring, visibility policy, and model selection.

### Evaluation Tooling

- The EPIC 8.6 contract cleanup, tool foundation, sequential HTTP runner, semantic judging,
  aggregation, atomic report persistence, and CLI execution are shipped in
  `tools/conversation-evaluation`.
- `TestDefinition`, `QuestionResult`, `JudgeResult`, and `RunReport` are tool-owned types; Core
  domain and HTTP DTOs are not extended with evaluation-only state.
- Versioned JSON definitions validate required fields, exact initial-avatar selection, duplicate
  questions, structured evaluation criteria, and unknown fields before any network work. The
  Avatar model field remains comparison metadata; the judge model field is sent as an explicit
  raw-exchange request selection.
- CLI and environment configuration resolves the Avatar API URL, API key, optional judge URL,
  report path, timeout, and a unique run-scoped user ID by default; explicit user IDs support
  controlled continuity tests. Definition validation is network-free, while the execution command
  intentionally makes authenticated requests only when explicitly invoked.
- The evaluator reuses shared conversation/entity and raw-exchange contracts. It supports explicit
  per-run Avatar model selection for controlled comparisons and calculates separately labeled
  public-price cost estimates from observed token usage; unknown pricing remains unavailable.
- The typed evaluator HTTP client decodes only `ApiResponse<T>`, sends API-key headers, validates
  consumed successful payloads at runtime, and handles configured timeouts and caller aborts with
  phase-aware contract errors. The runner creates one session and conversation, resolves an initial
  Avatar deterministically, awaits each JSON response in order, records shared message metrics, and
  returns partial `api_error` results without polling asynchronous Game Master or memory work.
- The evaluator sends bounded, structured question/criteria/answer evidence to authenticated
  `POST /v1/exchange` for semantic judging. Judge output is runtime-validated, including the
  deterministic fenced-JSON compatibility form, and malformed or unavailable judges remain
  `judge_error` rather than quality failures.
- Judge scores map to explicit `passed` (4–5), `partial` (3), and `failed` (1–2) outcomes;
  reports and console summaries retain the judge reason, missing facts, and contradictions.
- The CLI emits progress for setup, Avatar requests, judging, and completion, and waits five
  seconds between scripted questions so asynchronous Game Master and memory work can settle before
  the next evaluation turn.
- A definition can provide `models` to run the same script once per Avatar model. Per-model reports
  and an incrementally updated comparison report are available to the local viewer.
- Judge failures receive three total attempts with progress logging. Model comparison continues
  past isolated API/judge failures and stops only after three consecutive failed runs.
- Reports preserve attempted question inputs, Avatar responses and metrics, judge results and
  latency/token metrics, separate Avatar and judge model observations/mismatches, explicit
  pass-rate denominators, phase-aware errors, and token-based cost estimates with pricing provenance.
  Report snapshots use atomic
  replacement after each attempted question, so partial runs remain valid JSON even across an
  interruption. Console summaries omit prompts, API keys, and unbounded payloads.
- The evaluator includes a local dependency-free report viewer that serves the selected JSON file
  on loopback, displays question-level responses, criteria, diagnostics, and metrics, and refreshes
  incremental report snapshots automatically.
- Evaluation definitions can configure session-scoped Avatar retrieval (`maxChunks` 1–9 and
  per-source minimums), while the knowledge ingestion trigger can persist a per-job `chunkSize`
  (100–10000 characters) through asynchronous execution and retry.
- The package test suite includes deterministic unit coverage plus a fake-HTTP integration-style
  three-question ordering test; the seeded Villa Miralac definition is readable and opt-in only.

## Current Architectural Invariants

- Layering remains `API -> Application -> Domain -> Infrastructure`.
- External input is validated at the API boundary.
- `@gami/shared` owns public/shared DTOs; route-local contract duplication should not be reintroduced.
- `RawExchangeResponse` and `LlmResponseMetrics` are owned by `packages/shared`; Core's raw exchange
  application output remains internal and is mapped at the API boundary.
- `tools/conversation-evaluation` is an external client/tool boundary; its report types remain
  outside the Core domain.
- `MessageStreamEvent` is owned by `@gami/shared`; future stream requests reuse `SendMessageRequest`.
- `voice-contract-types.ts` is the canonical `@gami/shared` owner for provider-neutral logical voice
  configuration, client audio preferences, supported output formats, and transient binary-delivery
  metadata. Avatar/Scenario repositories reserve `config.voiceConfig` and project it into typed
  summaries; Avatar voice overrides Scenario defaults and update `null` explicitly clears it.
  Synthesis failures remain an internal Application TTS-port contract.
- `LlmStreamEvent` and `LlmStreamOptions` are owned by the internal `ILlmAdapter` port; provider
  streams emit ordered deltas followed by one terminal response with usage metadata.
- `ObservedLlmAdapter` remains the single LLM observability boundary for streams and traces the
  full request once, not individual deltas; interrupted streams record bounded outcome/reason
  metadata on that same trace.
- `StreamingSendMessageUseCase` reuses the synchronous turn preparation and completion mechanics;
  it persists the user message before provider iteration, persists no partial avatar message, and
  schedules GM/memory work only after successful completion. Provider/client interruption closes the
  active iterator and skips final avatar persistence and post-turn work.
- Generic SSE frame parsing is owned by `@gami/shared`; client-specific subscription and reconnect
  behavior stays in each app. `parseMessageStreamEvent` validates decoded public frames before
  consumer state changes. The web message client buffers out-of-order deltas until their sequence
  is contiguous and cancels its reader/abort listener during cleanup.
- Avatar reply latency takes priority over synchronous orchestration work.
- Public contracts evolve additively whenever possible.
- Retrieval visibility is asymmetric by design: avatar-filtered, GM-unrestricted.
- Voice input is application-owned and provider-neutral: only finalized normalized transcripts may
  enter the existing message flow, and one `(conversationId, utteranceId)` can execute at most once.
- Deepgram is an Infrastructure implementation detail behind the speech-to-text port. Voice remains
  unconfigured safely when `DEEPGRAM_API_KEY` is absent, preserving the existing text/LLM path.
- Voice idempotency now uses a Redis-backed implementation for cross-instance coordination while
  preserving the same application port and fail-safe expired reservation behavior.
- Deterministic Epic 9.1 verification passes without credentials. Live Deepgram success and stack
  HTTP success remain environment-gated; the local stack preflight skips them when no app is
  available at the configured base URL or when the voice fixture gate is not enabled.
- Voice contract work does not change `Message`, `SendMessageRequest`, `SendMessageResponse`, or
  `MessageStreamEvent`; no shared DTO or persistence table was added.

## Open Product Work

- No standalone guided-progression engine beyond existing GM heuristics.
- No completed hybrid response/cache path.
- No completed real-scenario validation milestone.
- No completed prototype-packaging milestone.

## Implementation References

- Use `EPICS.md` for the compact roadmap ledger.
- Use `API_CONTRACT.md` for HTTP contracts.
- Use `GAME_MASTER_CONTRACT.md` for GM runtime behavior.
- Use `MEMORY_SYSTEM_SPEC.md` for memory rules.
- Use `ARCHITECTURE.md` and `PRINCIPLES.md` before changing boundaries or responsibilities.

Documentation review for EPIC 4.2d Prompt 05 covered `ARCHITECTURE.md`, `DATA_MODEL.md`,
`API_CONTRACT.md`, `GAME_MASTER_CONTRACT.md`, `MEMORY_SYSTEM_SPEC.md`,
`RAG_SYSTEM_IMPLEMENTATION.md`, `AVATAR_RAG_SETUP_GUIDE.md`, `TEST_STRATEGY.md`,
`TEST_COVERAGE_PLAN.md`, `CONTEXT_CONTRACT_OWNERSHIP_MAP.md`, `EPICS.md`, and
`PROJECT_STATUS.md`; each records the scenario-shared static retrieval boundary and independent
conversational-memory lifecycle. `VISION.md`, `PRINCIPLES.md`, and `TECH_STACK.md` were reviewed
and remain accurate without text changes.

Documentation review for EPIC 9.1 Prompt 01 covered `VISION.md`, `PRINCIPLES.md`,
`ARCHITECTURE.md`, `TECH_STACK.md`, `DATA_MODEL.md`, `API_CONTRACT.md`, `GAME_MASTER_CONTRACT.md`,
`MEMORY_SYSTEM_SPEC.md`, `TEST_STRATEGY.md`, `TEST_COVERAGE_PLAN.md`, `EPICS.md`, and this file.
No public API, message persistence, Game Master, memory, or deployment behavior changed; the
corresponding contracts remain accurate without additional changes.

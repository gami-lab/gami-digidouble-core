# Test Coverage Plan

What must be covered by tests in the current system.
For test-design rules and tier definitions, read `TEST_STRATEGY.md`.

## Coverage Priorities

Highest risk areas:

- API contracts and error envelopes
- conversation lifecycle
- Game Master orchestration
- memory refresh and continuity
- context assembly
- knowledge ingestion and retrieval
- runtime events and inspection surfaces

## Module Coverage

### API Layer

Must cover:

- auth enforcement
- request validation and malformed-body handling
- correct `ApiResponse` envelopes
- correct status/error-code mapping
- contract shape for public and admin routes
- SSE headers and basic stream behavior where applicable
- message-stream route auth, validation, not-found, framing, and stack-e2e completion ordering
- voice-message route auth, bounded raw-body/media/header validation, canonical JSON/SSE framing,
  not-found/error mapping, interruption cleanup, and stack-e2e coverage for both route variants
- completed-message audio route auth, minimal JSON validation, binary metadata, error mapping, and
  stack-e2e auth/validation/not-found coverage

### Conversation Runtime

Must cover:

- session creation and listing
- conversation start and history isolation
- message persistence order
- streaming message delta order including stale/out-of-order client events, terminal persistence
  exactly once, provider/client interruption cleanup over the HTTP boundary, provider
  iterator/reader cleanup, malformed frame rejection, interruption observability, and no partial
  avatar persistence
- legacy JSON send-message response envelope remains `ApiResponse<SendMessageResponse>`
- avatar switch behavior
- available-avatar and avatar-transition endpoints
- end-conversation behavior and compaction trigger
- not-found and conflict paths

### Voice Input Contracts

Must cover:

- bounded audio bytes and duration, accepted media types, normalized language, and opaque
  conversation/utterance identity validation
- final transcript normalization and rejection of blank, interim, malformed, and over-limit results
- finite timeout, provider-failure, and cancellation mapping, including pre-transcription abort
- deterministic fake adapter behavior and bounded request recording
- at-most-once utterance reservation semantics for in-flight, completed, expired, released, and
  conflicting duplicate submissions
- no shared message-contract changes and no raw audio/transcript content in failures or identity
  diagnostics

The Infrastructure adapter additionally covers exact Deepgram request construction, successful
final response parsing, malformed/empty/interim responses, provider-reported duration and
transcript limits, HTTP rejection/rate-limit/timeout/provider failures, transport cancellation,
and observability redaction with an injected transport fake.
An opt-in live smoke test uses an externally supplied fixture only when
`DEEPGRAM_LIVE_SMOKE=1`, `DEEPGRAM_API_KEY`, and `DEEPGRAM_LIVE_AUDIO_PATH` are set; the normal
credential-free suite does not require network access.

Voice-turn application coverage verifies that synchronous and streaming voice calls delegate to the
canonical send-message use cases, preserve cancellation/interruption behavior, and consume or
release the idempotency reservation at the correct boundary without duplicating turn execution.

The TTS adapter coverage verifies the official Gradium request mapping, private logical voice-ID
resolution, native output-format mapping, typed failure categories, response content-type and size
validation, stream cancellation/cleanup including streamless-body rejection, timeout and caller
abort propagation, and secret-safe observability. The synthesis use-case coverage verifies exact
persisted cleaned text, output identity/byte validation, voice inheritance, legacy configuration,
repeated/concurrent requests, failure isolation, and no audio persistence. These tests use injected
transport fakes and do not require Gradium credentials.

Voice-output contract cleanup must cover the shared finite output-format guard, provider-neutral
logical voice configuration, client playback/delivery preference boundaries, minimal delivery
request, and bounded binary delivery metadata. These tests must reject provider credentials,
provider-native voice fields, and raw audio values. The completed-message audio route additionally
covers canonical persisted Avatar content, conversation/message ownership, voice resolution,
bounded binary headers, transient delivery, typed synthesis failures, and the required stack-E2E
auth/validation/not-found contract; its binary happy path remains environment-gated when no seeded
deterministic adapter is available.

Voice configuration coverage also verifies additive Avatar/Scenario create and update mapping,
reserved JSONB projection, legacy records without configuration, explicit null clearing, deterministic
Avatar-over-Scenario inheritance, and rejection of provider-specific fields.

Epic 9.1 hardening evidence maps the remaining independent risks to deterministic checks: concurrent
duplicate requests to one transcription/turn, cancellation after transcription before handoff,
unconfigured voice with an unchanged text route, failure traces containing only bounded latency,
duration, outcome, and failure category metadata, and provider-payload redaction at the
observability consumer boundary.

### Avatar Runtime

Must cover:

- prompt section ordering
- legacy fallback when `computedTraits` is `null`
- trait-aware prompt assembly when traits exist
- deterministic prompt composition for the same runtime inputs
- provider failure handling
- consumer-boundary assertions against the real LLM request shape

### Avatar Trait Preparation

Must cover:

- explicit scenario-scoped preparation flow
- per-avatar failure isolation
- rerunnable recomputation
- persistence of `computedTraits` without mutating authored avatar fields
- `POST /v1/scenarios/{scenarioId}/prepare-avatar-traits` auth, validation, not-found, and success paths

### Game Master

Must cover:

- every-turn async invocation semantics
- static and dynamic prompt structure
- state reducer logic
- unlock and switch validation
- safe failure isolation and `gm_error` diagnostics
- invalid-output diagnostics contain bounded metadata only and never raw prompt/user content
- memory/persona/retrieval threading into GM input
- consumer-boundary assertions for the actual `llm.complete` request
- one integration-tier proof of the composed GM runtime path

### Memory

Must cover:

- short-term window keeps at most the three most recent complete user/avatar exchanges, excludes
  incomplete pairs, preserves chronological order, and does not replay the full transcript
- short-term fallback after working-memory refresh still keeps at most three complete exchanges
- working-memory rewrite persistence
- `coveredTopics` and `unresolvedThreads` behavior, including removal of resolved threads
- candidate-fact filtering versus durable user-fact persistence/injection
- contradicted Avatar claims are excluded while user-supported and verified facts remain eligible
- post-turn compaction every third exchange plus close, avatar-switch, and admin triggers
- episodic memory creation on close
- user fact extraction rules
- refresh trigger coverage
- session reset boundaries
- admin memory inspection payload shapes

### Context Engine

Must cover:

- deterministic assembly order
- bounded recent messages
- memory layer injection
- scenario and persona injection
- typed retrieval merge behavior
- precedence and trimming under constrained budgets
- stable trace output for kept/trimmed context

### Knowledge

Must cover:

- source registration and update
- upload validation
- ingestion job lifecycle
- embedding port contract: ordered vectors, effective profile metadata, copy-safe deterministic
  fake output, and finite typed failure categories
- OpenAI adapter: configured batching and request shape, index-based ordering, response validation,
  provider failure translation, and bounded profile/usage/batch observability with a fake client
- profile-aware ingestion: immutable active snapshot, exact vector count/dimension/profile checks,
  stale publication rejection, rollback preservation, source readiness, and retry diagnostics
- query embedding boundary: stable ordered normalization for every configured source, one batch
  call, active profile resolution, profile-tagged copy-safe output, safe count/timing diagnostics,
  all-or-nothing malformed/profile/dimension/finite/provider failures, and no vector/provider
  payload leakage
- retrieval contract boundary: one shared query-source guard, domain vector-candidate/trace/failure
  ownership, safe public/runtime mapper fields, cosine distance/similarity normalization, bounded
  diagnostics, and no vector leakage
- typed retrieval by `avatar_knowledge` / `world` / `media`, including one ordered embedding batch, bounded
  per-type/query vector searches, similarity merge/deduplication, balanced source minimums, and
  controlled all-or-nothing failures
- avatar visibility filtering
- GM unrestricted retrieval behavior
- Avatar and asynchronous GM composition reuse the same configured vector retrieval service;
  required retrieval failures preserve insufficient-evidence guidance without blocking reply
  generation
- filtered pgvector repository: bounded cosine ordering, SQL-side eligibility filters, explicit avatar/GM visibility modes, shared-candidate consistency, GM-bypass limits, active profile/generation, safe dimension/profile failures, and index-compatible query shape
- retrieval diagnostics staying bounded
- unified retrieval diagnostics across the admin presenter, recorded runtime events, session-context
  mapper, and console/admin adapters, including duplicate-vs-selection counts and Context Engine
- lifecycle non-interference: reset, conversation close, scenario deletion, user-fact deletion,
  reindex, and memory maintenance mutate only their owning repositories and preserve async failure
  isolation
- the full requirements-to-tests mapping in
  [EPIC_5_1D_REQUIREMENTS_MATRIX.md](EPIC_5_1D_REQUIREMENTS_MATRIX.md), including deterministic
  semantic paraphrase/unrelated-vector fixtures, ordered batch mapping, filtered PostgreSQL
  cosine search, failure isolation, composition audits, and bounded diagnostics
  inclusion/trimming facts

### Operations And Inspection

Must cover:

- `GET /v1/admin/health`
- `GET /v1/admin/sessions/{sessionId}/inspect`
- `GET /v1/admin/sessions/{sessionId}/events`
- `GET /v1/admin/sessions/{sessionId}/context`
- `GET /v1/admin/sessions/{sessionId}/memory`
- `GET /v1/admin/sessions/{sessionId}/memory-layers`
- `GET /v1/admin/sessions/{sessionId}/metrics`
- `POST /v1/admin/sessions/{sessionId}/gm/replay`
- `POST /v1/admin/sessions/{sessionId}/memory/refresh`
- `POST /v1/admin/sessions/{sessionId}/memory/clear`

Checks should focus on:

- auth
- not-found/conflict behavior
- bounded safe diagnostics
- no prompt/secret leakage

### Metrics

Must cover:

- reconstruction of turn metrics from persisted events
- GM/non-GM mixed sessions
- legacy/orphan event handling
- admin metrics route auth and happy-path behavior

### User Persona

Must cover:

- persona upsert/read contracts
- partial and empty persona handling
- prompt injection only when persona data is present
- persona lookup failures not breaking message delivery

### Runtime Events

Must cover:

- SSE connection lifecycle
- shared frame buffering, keepalive/comment handling, and malformed payload handling
- session scoping with no cross-session leakage
- reconnect stability
- runtime-state snapshot consistency
- publication failures not breaking avatar replies

### `apps/web`

Must cover:

- local identity persistence and reset
- scenario discovery
- available-avatar visibility
- single-active-chat behavior
- optimistic send lifecycle
- consumption of canonical shared DTOs only
- completed Avatar message audio request and accessible play/replay/stop controls
- autoplay, unsupported-browser, failure, cancellation, stale-result, and object-URL cleanup behavior
- unchanged stream ordering and text reconciliation when audio delivery is unavailable

### `apps/admin`

Must cover:

- transport-layer request shaping and envelope handling
- scenario/avatar editing flows
- knowledge-source create/update/upload flows
- visibility-policy editing
- model-selection form behavior
- trait-preparation trigger and read-only trait display
- consumption of canonical shared DTOs only

### `tools/conversation-evaluation`

Must cover:

- shared API contracts are consumed without local Avatar, Scenario, Session, Conversation, or
  Message copies
- valid JSON definitions load without network access
- required fields, unknown fields, empty values, malformed model metadata, and exact initial-avatar
  selector validation
- duplicate-question rejection and ordered question preservation
- CLI/environment precedence, URL and timeout validation, safe API-key errors, and unique default
  run user IDs with explicit continuity override
- absent `costUsd` normalizes to `null`, while supplied values remain unchanged
- total-token derivation is limited to input plus output tokens when the API omits total tokens
- public-price cost estimation uses input/output token arithmetic, records pricing provenance, and
  reports unknown models as unavailable
- comparison definitions validate provider/model selectors, send the selected Avatar model at the
  shared API boundary, write per-model reports, and update the comparison report incrementally
- tool-owned report types distinguish API errors, judge errors, and valid quality failures
- the Core HTTP client normalizes base URLs, sends API-key headers, decodes `ApiResponse<T>`, validates
  successful session/conversation/avatar/message payloads, and handles timeout/caller-abort paths
  with phase-aware contract errors
- the sequential runner resolves direct or unique normalized name-based Avatars, preserves request
  order and session/conversation identity, extracts response metrics, exposes model mismatches, and
  retains completed results when a message request fails; comparison runs prove the selected model
  is included in each Avatar message request
- semantic judge serialization stays within raw-exchange body limits, accepts only validated
  result objects (with deterministic fenced JSON), and distinguishes paraphrase passes, relevant
  additional information, structured required facts/alternatives/forbidden claims, missing
  criteria, contradictions, score-three partial outcomes, malformed judge output, and judge
  transport/API errors; the declared judge model is asserted in the raw request
- report aggregation uses valid judge results for the pass-rate denominator, keeps Avatar metrics
  separate from judge model metadata, retains judge latency metrics, aggregates Avatar, Game Master,
  and memory-compaction token usage, excludes judge tokens and cost, leaves full-run cost nullable
  when runtime usage or pricing is incomplete, and atomically writes valid incremental reports with
  bounded console summaries
- the local report viewer serves the dashboard and report JSON on loopback, rejects unknown paths,
  and reads updated report snapshots without restarting
- valid judge quality results flow through `runEvaluation` into passed, partial, or failed
  question/report outcomes;
  real-file interruption coverage proves readable partial output and temporary-file cleanup
- direct CLI help and configuration-failure behavior preserve exit-code and secret-safety contracts
- judge transport/contract failures retry twice after the initial attempt, log each retry/final
  failure, and comparison stops only after three consecutive infrastructure-failed model runs
- evaluator progress messages cover setup, request, judging, completion, and the five-second
  inter-question wait required for asynchronous Game Master and memory work
- the composed integration-style fake-HTTP test proves three ordered questions, one session and
  conversation, authenticated request shaping, and judge completion before the next Avatar request
- the seeded Villa Miralac definition is loadable but is not executed by default tests

## Knowledge Corpus Persistence

Must cover staged-generation invisibility, source replacement, profile/dimension validation,
completeness checks, active-generation switching, PostgreSQL constraints, legacy-vector
invalidation, failed promotion, active-source transactional replacement, stale publication
rejection, atomic active-pointer visibility, full reindex source enumeration, duplicate/concurrent
worker claims, retry/restart recovery, bounded operator diagnostics, and admin route auth,
validation, not-found, start/status/retry, and opt-in stack-e2e paths.

### EPIC 4.2d Requirements-to-tests matrix

The complete isolation and lifecycle definition of done is tracked in
[EPIC_4_2D_REQUIREMENTS_MATRIX.md](EPIC_4_2D_REQUIREMENTS_MATRIX.md). The final slice adds only
cross-boundary proof that local tests cannot provide: identical static candidates for two callers,
isolation of working/episodic/fact layers, scenario source/chunk cascade, and safe non-RAG
maintenance boundaries. Existing prompt, migration, alias, quarantine, route, and async tests are
referenced there rather than duplicated.

### EPIC 5.1c Requirements-to-tests matrix

| Requirement                                    | Deterministic evidence                                                                                                                                                      | PostgreSQL/stack evidence                                                                                          |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Ordered, batched, validated provider vectors   | `openai-embedding.adapter.test.ts` covers multi-batch order, count/index corruption, finite values, dimensions, usage, latency, and failure codes                           | Opt-in live adapter test; no credentials required for normal CI                                                    |
| Explicit production provider wiring            | Adapter factory tests reject unsupported providers/missing credentials; `index.ts` is the only production composition path                                                  | Stack configuration uses OpenAI variables; live provider test is opt-in                                            |
| Profile-aware ingestion/query vectors          | `knowledge-ingestion.service.test.ts` and `knowledge-query-embedding.service.test.ts` cover stale, rollback, profile, dimension, and copy-safe identity behavior            | Repository active-pointer and source replacement integration tests                                                 |
| Complete replacement corpus and retry recovery | `knowledge-reindex.service.test.ts` and admin route tests cover source enumeration, duplicate starts, competing workers, failure/retry, promotion, and interrupted recovery | PostgreSQL staging isolation, claim/recovery, typmod, cosine index, and promotion tests; stack route contract test |
| Safe observability                             | Adapter and reindex event assertions allow bounded identifiers/usage/latency and reject source text, vectors, keys, and raw payloads                                        | Admin DTOs expose only bounded status/progress fields                                                              |

## Critical Release Flows

These flows should remain protected end to end:

1. create session
2. start conversation
3. send message
4. read conversation history
5. switch avatar and verify new conversation boundaries
6. close conversation and verify memory-compaction effects
7. register or upload knowledge source
8. trigger ingestion and inspect job state
9. run retrieval-backed conversation flow
10. inspect session runtime through admin APIs

## Regression Fixtures

Keep reusable fixtures for:

- scenarios
- avatars
- multi-conversation sessions
- knowledge visibility combinations
- provider responses

## What This File Should Not Become

- a slice-by-slice delivery journal
- a duplicate of `TEST_STRATEGY.md`
- a list of endpoints or entities that are not implemented

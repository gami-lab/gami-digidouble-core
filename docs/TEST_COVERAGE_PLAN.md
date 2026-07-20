# TEST_COVERAGE_PLAN.md

What to test in each module and what scenarios must be covered.
For rules on _how_ to design and write tests, see [TEST_STRATEGY.md](TEST_STRATEGY.md).

---

# Module Coverage Checklists

## API Layer

**Goals:** request validation, stable response envelopes, correct error codes, auth enforcement.

Must test:

- missing required fields → 400
- invalid IDs / malformed input → 400
- unauthorized access → 401
- session not found → 404
- successful happy paths return correct envelope
- contract shape of all public endpoints
- scenario/avatar operability contracts:
  - `GET /v1/scenarios` returns deterministic ordering and clean empty list
  - `GET /v1/scenarios/:scenarioId/avatars` returns `404` when scenario is missing and `200` with empty list when scenario exists with no avatars
  - `DELETE /v1/avatars/:avatarId` returns `404` when missing and `409` when blocked by active sessions
  - `DELETE /v1/scenarios/:scenarioId` returns `404` when missing and `409` when dependent avatars or sessions exist
- SSE event ordering (when SSE is used)
- global error handler classifies Fastify's own body-parsing errors (empty/malformed JSON body
  with `Content-Type: application/json`, mismatched `Content-Length`) as `400 VALIDATION_ERROR`,
  not `500 INTERNAL_ERROR` — covered in `apps/core/src/api/server.test.ts`; this applies to every
  route, including no-body action routes (`gm/replay`, `memory/refresh`, `prepare-avatar-traits`)

Avoid: retesting business rules already covered by unit tests.

---

## Conversation Module

**Goals:** session/container correctness, conversation lifecycle correctness, message persistence by conversation, history isolation.

Must test:

- session creation
- start conversation inside session
- active avatar update when new conversation starts
- message persistence order per conversation
- message metadata persistence
- history retrieval consistency per conversation
- switch avatar creates another conversation
- return to same avatar creates a new conversation record
- session-level conversation listing
- `application/use-cases/switch-avatar/` has unit tests for all branches (no active conversation, same-avatar switch, scenario mismatch, missing entities, inactive session)
- `application/use-cases/get-avatar-transitions/` has unit tests for chain-derivation edge cases (session start, A→B linkage, missing handoff source)
- invalid session/conversation IDs return 404 with contract error codes

---

## Avatar Module

**Goals:** prompt assembly, persona config respected, wrapper integration reliable.

Must test:

- avatar input contract
- prompt assembly section order: Director Notes, Response Rules, Conversation State, User Persona, World Context, Retrieved Context, Avatar Traits
- consumer-boundary send-message assertions: the actual LLM request system prompt contains the required ordered sections and trait values, not just intermediate helper objects
- prepared-avatar identity preference: `computedTraits` is used when present and raw `personaPrompt` does not compete as a second identity block
- legacy/unprepared-avatar fallback: missing or `null` `computedTraits` still yields a valid prompt via the authored `personaPrompt`
- all seven computed-trait fields render in stable order with concise labeled items
- conversation-state prompt assembly stays bounded: recent exchanges remain short-term only (no full transcript replay), working memory stays grouped, and avatar-awareness availability/lock state stays preserved
- world context stays separate from typed retrieved context (`memory` / `world` / `media`)
- deterministic prompt output for identical runtime inputs
- fallback handling on provider failure
- structured output parsing when required
- streaming assembly
- error propagation on provider failures

Do not test prose quality or writing style — only structure, contract, and error behavior.

### Avatar Trait Preparation (EPIC 8.1)

**Goals:** trait computation is explicit (never triggered from a `GET`), scenario-scoped,
rerunnable, and per-avatar failures never block the rest of the batch.

Must test:

- `PrepareScenarioAvatarTraitsUseCase`: `NOT_FOUND` for unknown scenario, multi-avatar
  computation/persistence, scenario/type-scoped source gathering (excludes other scenarios
  and `media`-type sources), per-avatar failure isolation, recomputation without mutating
  author-authored avatar fields, and recomputation after editing an avatar's authored text
  (asserts the rebuilt LLM prompt reflects the edited text, not the stale one)
- trait-preparation prompt building and lenient/schema-locked parsing (fenced/malformed JSON,
  invented fields dropped, 7-item cap, dedup, whitespace-only inline text treated as absent);
  a regression guard asserts the system prompt still contains its grounding constraints
  (no invented details, no generic world-context copying, 5-7 item cap, fixed field set)
- persistence tier (in-memory and Postgres integration): a second `saveComputedTraits` call
  overwrites the first value and still leaves `personaPrompt`/`description` untouched —
  proven at the repository layer, not only at the use-case layer
- `AvatarSummary.computedTraits` is `null` before preparation and populated after, consistently
  across create-avatar, update-avatar, and list-scenario-avatars responses; plain avatar
  create/list routes and their stack-e2e coverage also assert `computedTraits: null` directly
  (not only the trait-preparation-specific route test)
- route: `POST /v1/scenarios/{scenarioId}/prepare-avatar-traits` — auth (401 x2), request-body
  rejection for any bodied JSON request (object, array, string, number, boolean, `null`)
  with `400`, `404` for unknown scenario, and a deterministic success path using a fake
  LLM adapter that returns valid trait JSON
- stack-e2e: auth, validation, not-found always-on; an always-on null-provider path proving
  the full HTTP -> use case -> DB round trip (deterministic `failed`/`unparseable_output`
  outcome under the null adapter); a rerunnability check that the endpoint can be called twice
  in a row and persists a fresh result each time; a `describe.skipIf` real-provider block
  asserting genuine prepared `computedTraits` when the stack is started with a real provider key,
  including bounded field sizes, avatar-specific source grounding, and absence of unrelated
  generic world-context copying for a curated fixture

Do not test prose quality of generated traits — only structure, persistence, and boundary behavior.

---

## Game Master Module

**Goals:** GM is lightweight, predictable, runs after every avatar turn, and state transitions are valid.

Must test:

- init mode output
- background post-turn output
- every-turn GM invocation
- static GM system prompt section order and validation-critical instructions
- dynamic GM input renderer section order, experience/discussion separation, and empty-section omission
- empty-input session-start handling remains explicit in both the static prompt instructions and the rendered runtime input
- consumer-boundary GM request assertions for the actual `llm.complete` system prompt and rendered message content
- integration-tier proof of the composed GM prompt path with real in-memory collaborators: memory selection, typed retrieval, state persistence, runtime event emission, and observability trace metadata
- GM diagnostics remain safe: runtime events and event-log payloads never include raw system prompt text or rendered prompt section content
- state reducer logic
- duplicate topic handling
- progression update rules
- GM avatar unlock decisions, including duplicate suppression and invalid avatar ID rejection
- GM failure isolation and `gm_error` diagnostics
- transition reason output and history logging for explicit GM switches
- available-avatar filtering and invalid transition rejection
- `GameMasterInput.context.memory` includes bounded layered memory when available
- GM short-term memory contains exactly last 2 exchanges
- GM long-term facts are structured and bounded
- missing memory layers are omitted consistently without failing the GM run

This module deserves strong unit coverage — it controls orchestration semantics.

---

## Memory Module

**Goals:** memory stays useful, bounded, and relevant.

Must test:

- short-term memory window policy (exactly last 2 exchanges)
- conversation-scoped working-memory rewrite persistence (summary + unresolved threads + candidate facts)
- session/avatar compatibility summary mirror updates for admin/runtime surfaces
- avatar-scoped working memory retrieval and isolation from other avatars
- persistent user fact extraction rules
- retrieval of relevant facts
- memory overwrite/update behavior
- long conversation compaction boundaries (30+ turns)
- conversation-end compaction trigger (explicit close and implicit close via switch/reset)
- async working-memory refresh scheduling never blocks avatar response
- refresh policy trigger coverage:
  - every 3 exchanges
  - conversation close
  - avatar switch
  - admin trigger
- `memory_refresh_triggered/succeeded/failed` event emission
- hydration linkage event emission (`memory_hydration_succeeded`) with conversation/source identifiers
- repeated turns update existing working-memory rows (no duplicate row creation)
- reset behavior
- admin memory-layers observability payload shape:
  - selection sources
  - selected vs rejected counts
  - top selection reasons
  - hydration linkage metadata

Risk: memory systems silently degrade quality while appearing to work. Requires both logic tests and conversational regression checks.

---

## Context Module

**Goals:** right information selected, token budget respected, source traceability possible.

Must test:

- recent messages included/excluded correctly (short-term bounded window)
- memory layers injected correctly (short-term + working + long-term)
- prompt memory sections omit empty layers and keep deterministic ordering
- scenario context injected correctly
- scenario goals/pacing constraints injected correctly
- knowledge retrieval merged correctly by layer (avatar-memory / world / media)
- GM directives injected correctly
- user persona injected correctly when present and omitted cleanly when absent
- handoff context injected during avatar transitions
- context selection remains deterministic under constrained token budgets with explicit kept/trimmed assertions
- precedence rules when inputs conflict
- deterministic assembly order and stable output shape for same inputs

This is one of the highest-risk modules in the project.

---

## Knowledge Module

**Goals:** ingestion works, chunking works, retrieval is usable, source metadata stays coherent.

Must test:

- source registration
- ingestion job status transitions
- chunk creation and embedding persistence
- retrieval by scenario/source
- retrieval partitioning by layer metadata (`avatar-memory`, `world`, `media`)
- filtering behavior
- invalid source handling

Retrieval quality is not only a technical issue — combine deterministic tests with real-content validation.

---

## Observability Module

**Goals:** important events are captured with all fields the consumer (Langfuse dashboard) needs.

Must test:

- request ID propagation
- latency measurement presence
- token/cost recording when available
- input/output content forwarded to generation traces
- GM trigger event logging
- failure event logging
- no raw sensitive data in logs
- turn/runtime diagnostics stay bounded: no raw prompt text, raw trait text, hidden retrieval text, or credential values in event payloads

---

## Operations Module

**Goals:** operational endpoints are correct, safe, and do not leak sensitive data.

### Health & Dependencies

Must test:

- `GET /v1/admin/health` returns `ok` when all dependencies are up
- `GET /v1/admin/dependencies`: postgres timeout → dependency `status: 'degraded'`; redis failure → dependency `status: 'error'`; top-level status reflects worst dependency
- missing or invalid API key returns `401`

### Session Inspector

Must test:

- session found → returns correct message count, memory summary, GM state fields present
- assembled context route (`GET /v1/admin/sessions/{sessionId}/context`) returns bounded Avatar + GM context sections (memory, persona, scenario, available avatars) without prompt/credential leakage
- layered memory route (`GET /v1/admin/sessions/{sessionId}/memory-layers`) returns bounded short-term exchanges (max 2), working layers, and long-term facts in stable envelope shape
- session not found → 404 with correct error code
- event list returns entries ordered by `created_at` desc
- event list correctly filters by `severity`
- no prompt content or credential values in any response field

### Reset & Replay

Must test:

- reset deletes messages and memory for the correct session; does NOT delete other sessions
- reset clears session/avatar working memory and preserves long-term `user_memory_facts`
- reset returns accurate deletion counts
- reset writes an audit entry with correct `actionType: 'session.reset'` and `targetId`
- replay does NOT create a new message row in the DB
- replay returns a non-empty content field (uses NullLlmAdapter in unit tests)
- replay writes an audit entry
- `POST /v1/admin/sessions/{sessionId}/gm/replay` schedules GM replay and writes an audit entry
- `POST /v1/admin/sessions/{sessionId}/memory/refresh` schedules memory refresh and writes an audit entry
- `POST /v1/admin/sessions/{sessionId}/memory/clear` clears only session-scoped memory fields and writes an audit entry

### Ingestion Job Management

Must test:

- job list filters by status correctly
- retry on a `failed` job transitions it to `pending` and writes an audit entry
- retry on a `completed` or `running` job is idempotent (returns current status, no duplicate job created)

### Metrics Overview

Must test:

- default period aggregates last 24h
- all required fields present even when counts are 0
- custom `since` parameter respected

### Audit Log

Must test:

- every admin action (reset, replay, retry, memory refresh, memory clear, GM replay) produces one audit log entry
- audit log query filters by `targetType` and `targetId` correctly
- entries are append-only (no update path exists)

### Console Runtime Inspector Consumer

Must test:

- `loadRuntimeInspectorViewModel` composes inspect + memory + memory-layers + metrics + runtime-state + persona + events + context using existing routes only
- runtime inspector SSE consumer parses `runtime_event` frames from `GET /v1/sessions/{sessionId}/events/stream` and ignores keepalive frames
- admin runtime action API wrappers call:
  - `POST /v1/admin/sessions/{sessionId}/gm/replay`
  - `POST /v1/admin/sessions/{sessionId}/memory/refresh`
  - `POST /v1/admin/sessions/{sessionId}/memory/clear`
- persona editor API wrapper calls `PUT /v1/users/{userId}/persona` and preserves canonical shared DTO usage

---

## Public Web App Module (`apps/web`)

**Goals:** deterministic public runtime behavior, contract-safe API usage, and strict separation from debug/admin surfaces.

Must test:

- identity persistence contract:
  - create + normalize browser identity payload
  - restore on load from local storage
  - reset clears persisted identity
- scenario discovery:
  - only active scenarios are rendered
  - scenario selection resets stale avatar/session UI state
- avatar availability visibility:
  - only avatars for current scenario/session availability are shown
  - hidden/locked avatars remain excluded
- active-chat-only runtime:
  - selecting a new avatar clears previous thread state (no old-chat browsing surface)
  - one current thread is represented at a time
- optimistic send lifecycle:
  - user message appears immediately
  - send state transitions to processing while request is in flight
  - successful send reconciles pending user message and appends avatar response
  - failed send marks pending message as failed and clears processing state
- contract ownership discipline:
  - no locally duplicated backend DTOs in `apps/web`
  - all request/response contracts are consumed from `@gami/shared`
- persona-first session start gate blocks session start until persona is saved/available for selected user
- GM impact causality trace renders trigger → decision → impact chain from bounded shared event payloads
- turn profiler renders per-turn latency composition and supports deterministic sort/filter behavior (slowest/latest, GM-only)
- no console-local duplicated admin DTO contracts; `@gami/shared` remains canonical owner for HTTP-facing inspector/admin DTOs

---

## Admin App Module (`apps/admin`, EPIC 6.1)

**Goals:** deterministic scenario-builder editor behavior, contract-safe transport layer, and zero locally duplicated backend DTOs.

Coverage expectations by module:

| Module path                                                                          | Required coverage                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/client.ts`                                                                      | Unit tests for the `adminRequest` transport: api-key injection (and `/health` exemption), body serialization, envelope success/error unwrapping, network/JSON/envelope failure paths                                    |
| `api/scenarios.ts`, `api/knowledge.ts`                                               | Unit tests verifying each wrapper calls `adminRequest` with the correct method/path/body and unwraps the correct response field — these modules are fully mocked away in page-level tests, so they need direct coverage |
| `scenarios/model-selection-form.ts`                                                  | Unit tests for empty/complete/partial detection, trim behavior, and `ScenarioModelSelection`/`AvatarLlmOverride` round-tripping                                                                                         |
| `scenarios/ScenarioListPage.tsx`, `ScenarioCreatePage.tsx`, `ScenarioDetailPage.tsx` | Behavior-level tests (loading/error/success states, form submission, validation errors, edit/cancel flows)                                                                                                              |

Must test:

- scenario create/update form flows including objectives and world context
- avatar create/update flows with `personaPrompt` and initial-visibility toggle
- knowledge source create plus update/replacement flows (inline text, PDF/TXT upload, visibility-policy edits)
- model-selection precedence UI (scenario default, GM override, avatar override) blocks submission on partial (one-field) input
- no locally duplicated backend DTOs in `apps/admin`; all request/response contracts and status enums (`ScenarioStatus`, `AvatarStatus`, `KnowledgeVisibilityPolicy`) are consumed from `@gami/shared`

### Avatar Trait Preparation Admin Trigger (EPIC 8.1)

**Goals:** the admin trigger and read-only trait inspection are covered independently of the
existing scenario-detail suite, and the read-only surface never grows editable trait controls.

Coverage expectations by module:

| Module path                                               | Required coverage                                                                                                                                                                                                                                                                                                |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/scenarios.ts#prepareAvatarTraits`                    | Unit test verifying the wrapper calls `adminRequest('POST', '/v1/scenarios/{scenarioId}/prepare-avatar-traits')` with no body and returns the response unchanged                                                                                                                                                 |
| `scenarios/ScenarioDetailPage.trait-preparation.test.tsx` | Behavior-level tests: `Prepared`/`Not prepared` list signal, trigger disabled + "Preparing…" while in flight, avatars re-fetched via `listScenarioAvatars` and success message shown after completion, failure message rendering, and read-only seven-section trait display (present/absent) in `AvatarEditForm` |

Must test:

- the trigger never mutates avatars locally from the prepare response — it always re-fetches via `listScenarioAvatars` after a successful call
- the read-only trait block only renders when `avatar.computedTraits` is non-null, and never renders as editable inputs
- no scoring, approval, or manual-override controls are introduced alongside the trait display

---

## Seed Parity Checklist (EPIC 6.1)

**Goal:** manual admin workflows must be able to fully replace or update the content currently produced by seed scripts for the supported scenario-builder surfaces, with no representational gap in those surfaces.

The murder-party seed script (`apps/core/src/seed/murder-party/setup-via-api.ts`) is itself API-first — it calls the same canonical Core endpoints (`POST/PATCH /v1/scenarios`, `POST/PATCH /v1/scenarios/{id}/avatars`, `POST/PATCH /v1/knowledge-sources`) that the admin app uses, so parity is largely guaranteed by construction. This checklist tracks the specific constructs verified during the EPIC 6.1 final-hardening pass:

| Construct                                                                               | Seed script                                                                                     | Admin app                                                                                                                                                    | Parity                                                 |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Scenario name/status/objectives/worldContext                                            | `ensureScenario` via `POST`/`PATCH /v1/scenarios`                                               | `ScenarioCreatePage`/`ScenarioEditForm` via same endpoints                                                                                                   | ✅                                                     |
| Avatar name/personaPrompt/status                                                        | `ensureAvatars` via `POST`/`PATCH /v1/scenarios/{id}/avatars`                                   | `AvatarCreateForm`/`AvatarEditForm` via same endpoints                                                                                                       | ✅                                                     |
| Avatar initial visibility (`avatarAvailability.initialAvatarIds`/`unlockableAvatarIds`) | `buildAvatarAvailability` via `PATCH /v1/scenarios/{id}`                                        | Visibility toggle in `ScenarioDetailPage` via same endpoint                                                                                                  | ✅                                                     |
| Knowledge source content (text)                                                         | `ensureKnowledgeSources` via `POST`/`PATCH /v1/knowledge-sources` (`metadata.inlineText`)       | `KnowledgeSourceCreateForm` plus `KnowledgeSourceEditForm` (inline replacement)                                                                              | ✅                                                     |
| Knowledge source content (file)                                                         | n/a (seed script always sends inline text)                                                      | `KnowledgeSourceCreateForm` via `POST /v1/knowledge-sources/upload`; `KnowledgeSourceEditForm` via `PATCH /v1/knowledge-sources` with `content` + `filename` | ✅ (admin-only path, additive)                         |
| Knowledge visibility — shared/world                                                     | `visibility: 'public'` → no `visibilityPolicy`/`visibleToAvatarIds` set                         | `visibilityPolicy: 'all'`                                                                                                                                    | ✅                                                     |
| Knowledge visibility — avatar-scoped                                                    | `visibility: 'avatar-<slug>'` → `visibilityPolicy: 'avatars'`, `visibleToAvatarIds: [avatarId]` | `visibilityPolicy: 'avatars'` + avatar picker                                                                                                                | ✅                                                     |
| Knowledge visibility — GM-only                                                          | `visibility: 'gm-only'` → `visibilityPolicy: 'none'`                                            | `visibilityPolicy: 'none'`                                                                                                                                   | ✅ (fixed during this pass — see below)                |
| Scenario default/GM-override model selection                                            | `getScenarioBaseConfig` does not set `modelSelection` (out of seed scope)                       | `ModelSelectionFields` via `PATCH /v1/scenarios/{id}`                                                                                                        | N/A — seed intentionally leaves this at global default |
| Avatar `llmOverride`                                                                    | not set by seed (out of seed scope)                                                             | Avatar form model-override fields via `PATCH /v1/avatars/{id}`                                                                                               | N/A — seed intentionally leaves this unset             |

**Found and fixed during this pass:** the seed script and the console runtime inspector both represented "GM-only" visibility using a legacy sentinel value (`visibleToAvatarIds: ['__GM_ONLY__']`) predating the canonical `visibilityPolicy: 'none'` field introduced in the EPIC 6.1 knowledge-visibility slice. This meant seed-created GM-only sources were structurally different from admin-created ones, and the console inspector didn't recognize admin-created GM-only sources at all (it would have mislabeled them as "all avatars"). Fixed by:

- updating `setup-via-api.ts`/`setup-via-api.seed.ts` to emit `visibilityPolicy: 'none'` (no sentinel) for GM-only sources
- updating `runtime-inspector-tab-content.tsx` to detect GM-only via `visibilityPolicy === 'none'`, falling back to the legacy sentinel check for sources created before this fix (backward-compatible, does not require re-seeding existing environments)

**Known gap, not fixed (out of EPIC 6.1 scope):** scenario-specific orchestration config (`scenario.config`, e.g. `progressionMilestones`, `solution`) has no admin editor — it remains seed/API-only. This is intentional: EPIC 6.1's admin scope is objectives/world context/persona/visibility/model-selection, not free-form scenario-specific game state.

---

## Metrics Module

**Goals:** reliable per-turn metric reconstruction from persisted events and safe admin exposure.

Coverage expectations by module:

| Module path                               | Required coverage                                                                |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| `domain/metrics/metrics.types.ts`         | Types only; no runtime logic (N/A for behavioral unit assertions)                |
| `application/use-cases/get-turn-metrics/` | Unit tests for all logical branches (empty, avatar-only, GM, legacy/orphan data) |
| `api/routes/admin-metrics.ts`             | Route tests for auth, not-found, empty session metrics, and populated data cases |

Must test:

- `GetTurnMetricsUseCase` empty event log behavior (`turns: []`, zero/null summary)
- correlation join between `turn_completed` and `gm_triggered`
- mixed sessions where only some turns have GM metrics
- legacy `gm_triggered` payloads missing latency/token fields
- orphan `gm_triggered` correlation IDs ignored
- duplicate `gm_triggered` correlation IDs keep first match and warn
- admin route `GET /v1/admin/sessions/{sessionId}/metrics` auth (`401`), missing session (`404`), and happy-path response envelope/shape (`200`)
- stack-E2E auth/not-found checks for `GET /v1/admin/sessions/{sessionId}/metrics`

---

## User Persona Module (EPIC 5.5)

**Goals:** reliable persona persistence and safe persona-aware context injection.

Coverage expectations by module:

| Module path                                                | Required coverage                                                                                                                            |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `domain/user/user.types.ts`                                | Types only; no runtime logic (N/A for behavioral unit assertions)                                                                            |
| `application/use-cases/upsert-user-persona/`               | Unit tests for create/update flow and input hardening paths                                                                                  |
| `application/use-cases/get-user-persona/`                  | Unit tests for found/missing user and missing persona                                                                                        |
| `api/routes/users.ts`                                      | Route tests for auth, validation, idempotent write/read, unknown user null behavior                                                          |
| `infrastructure/db/repositories/postgres-user.repository`  | Integration tests for upsert/find behavior and JSONB persona round-trip                                                                      |
| `domain/avatar/persona-prompt.service.ts`                  | Unit tests for persona role sentence inclusion and boundary cases                                                                            |
| `application/use-cases/send-message/send-message.use-case` | Unit tests for persona + typed-retrieval context assembly, graceful degradation, and non-sensitive `contextSelection` observability payloads |
| `application/use-cases/run-game-master/run-game-master`    | Unit tests for persona threading into GM input JSON                                                                                          |

Must test:

- `PUT /v1/users/{userId}/persona` accepts partial/empty persona objects and rejects unknown fields
- `GET /v1/users/{userId}/persona` returns `200` with `persona: null` for unknown users
- persona role context appears in avatar prompt only when role is non-empty
- persona lookup failures never break avatar turn delivery
- GM input JSON includes `context.userPersona` only when provided

---

## Runtime Events Module (EPIC 4.5)

**Goals:** session-scoped realtime runtime updates without blocking avatar response flow.

Must test:

- SSE connection lifecycle (`GET /v1/sessions/{sessionId}/events/stream` connect, heartbeat, disconnect)
- authenticated session subscriber receives runtime events emitted after GM runs
- no cross-session event leakage (session A events are never received by session B subscriber)
- reconnect behavior (new connection receives subsequent events and remains stable after transient disconnect)
- runtime-state snapshot consistency (`GET /v1/sessions/{sessionId}/runtime-state`) with latest emitted runtime signals
- async-first guarantee: runtime-event publication failures do not fail avatar turn responses

Avoid:

- introducing WebSocket-only test paths in Phase A
- heavy persistence assumptions for runtime events beyond existing event log diagnostics

---

# Critical E2E Flows

Minimum set that must pass on every release:

1. create session
2. start conversation
3. send message (conversationId)
4. read conversation history
5. create additional conversations in same session and verify history isolation
6. create scenario
7. register source
8. ingest source
9. ask question that uses retrieved knowledge
10. close conversation and verify memory compaction is scheduled and later reflected in session memory

---

# Conversation Regression Format

Each regression case must include:

- **setup:** scenario and persona config
- **input turns:** the message sequence
- **expected properties:** what the response must contain or do (not exact wording)
- **forbidden properties:** what must never appear
- **review notes:** why this case exists

Example expected properties: response stays in persona · references a prior known fact · uses a retrieved concept · does not repeat the previous answer.

---

# Fixture Sets Needed

### Scenarios

- basic conversation
- memory-heavy scenario
- knowledge-enabled scenario
- GM-enabled scenario

### Conversations

- short session (happy path)
- long session (30+ turns for memory testing)
- bounded-memory session (verify only last 2 exchanges enter short-term context)
- adversarial inputs (injection attempts, gibberish, very long messages)
- user fact emergence across turns

### Knowledge

- small valid markdown source
- source with overlapping topics
- mixed-layer sources (avatar-memory + world + media metadata)
- corrupted / invalid source

### Provider responses

- normal response
- timeout
- malformed JSON response
- empty response
- partial stream failure

---

# Resilience: Failure Modes to Cover

| Failure                | What to verify                                    |
| ---------------------- | ------------------------------------------------- |
| Provider timeout       | Graceful error response, no hung sessions         |
| Partial stream failure | Clean error, no corrupted output                  |
| DB unavailable         | Proper error propagation, no data corruption      |
| Redis unavailable      | Fallback or clean error                           |
| Retry storm            | Backoff in place, upstream pressure not amplified |
| Duplicate GM event     | Idempotent handling                               |
| Queue delay            | Eventual consistency holds                        |
| Stale cache read       | TTL and invalidation working                      |

---

# Security Testing Scope

### Per PR (static)

- SAST scan on TypeScript source
- Dependency vulnerability scan (`pnpm-lock.yaml`)
- Secrets scan (no credentials committed)

### On main

- Container image scan for OS/package CVEs

### Nightly (dynamic)

- API auth abuse: missing/expired/malformed keys rejected; timing-safe comparison in use
- Rate limit verification
- Injection tests: user inputs cannot escape context (prompt injection, SQL injection)
- Session isolation: one API key cannot read or influence another session
- DAST scan against staging

Policy: no critical/high CVEs on main. Security findings are bugs, not tech debt.

---

# Performance Targets

### Per PR

Micro benchmarks on changed hot paths: token budget logic, context assembly, GM trigger evaluation.

### On main

k6 smoke; fail if p95 regresses beyond threshold.

### Nightly

Soak, spike, concurrency, RSS leak check, DB query regression vs baseline.

| Metric                          | Target             |
| ------------------------------- | ------------------ |
| p50 response latency            | TBD after baseline |
| p95 response latency            | TBD after baseline |
| Throughput (req/s)              | TBD after baseline |
| Time-to-first-token (streaming) | TBD after baseline |
| DB query count per request      | TBD after baseline |
| Memory (RSS) under soak         | TBD after baseline |

Do not invent hard numbers before measurement.

---

# Mutation Testing Targets

Run nightly on Stryker (or equivalent). Priority modules:

- Game Master trigger logic and state transitions
- Memory rules (fact extraction, summarization decisions)
- Token budget logic
- Input validation rules

Mutation score tracked as a trend metric — not a hard gate until a baseline exists.

---

# Engineering Quality Metrics to Track

| Metric                  | Purpose                                         |
| ----------------------- | ----------------------------------------------- |
| Flaky test count        | Detect unreliable tests before they erode trust |
| Suite runtime (PR gate) | Prevent gate creep that leads to bypassing      |
| Escaped defects         | Bugs found in production with no covering test  |
| Mutation score          | Confidence in assertion quality                 |
| p95 latency trend       | Early warning for performance regression        |
| Provider failure rate   | LLM availability signal                         |
| Token cost per session  | Cost regression detection                       |

---

# Release Validation Checklist

Before a release or major demo:

- [ ] Core API flows pass
- [ ] Stream flow works end-to-end
- [ ] Memory works across multiple turns
- [ ] Reset works cleanly
- [ ] Scenario config loads correctly
- [ ] Knowledge ingestion works on test content
- [ ] Logs and metrics visible in Langfuse
- [ ] Fallback behavior acceptable under provider failure
- [ ] No major token/cost explosion
- [ ] Representative demo scenarios still feel coherent

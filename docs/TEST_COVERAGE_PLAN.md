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
- typed retrieval by `memory` / `world` / `media`
- avatar visibility filtering
- GM unrestricted retrieval behavior
- retrieval diagnostics staying bounded

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
- tool-owned report types distinguish API errors, judge errors, and valid quality failures
- the Core HTTP client normalizes base URLs, sends API-key headers, decodes `ApiResponse<T>`, validates
  successful session/conversation/avatar/message payloads, and handles timeout/caller-abort paths
  with phase-aware contract errors
- the sequential runner resolves direct or unique normalized name-based Avatars, preserves request
  order and session/conversation identity, extracts response metrics, exposes model mismatches, and
  retains completed results when a message request fails
- semantic judge serialization stays within raw-exchange body limits, accepts only validated
  result objects (with deterministic fenced JSON), and distinguishes paraphrase passes, relevant
  additional information, structured required facts/alternatives/forbidden claims, missing
  criteria, contradictions, score-three partial outcomes, malformed judge output, and judge
  transport/API errors; the declared judge model is asserted in the raw request
- report aggregation uses valid judge results for the pass-rate denominator, keeps Avatar metrics
  separate from judge model metadata, retains judge latency/token metrics, leaves cost nullable when
  incomplete, and atomically writes valid incremental reports with bounded console summaries
- the local report viewer serves the dashboard and report JSON on loopback, rejects unknown paths,
  and reads updated report snapshots without restarting
- valid judge quality results flow through `runEvaluation` into passed, partial, or failed
  question/report outcomes;
  real-file interruption coverage proves readable partial output and temporary-file cleanup
- direct CLI help and configuration-failure behavior preserve exit-code and secret-safety contracts
- evaluator progress messages cover setup, request, judging, completion, and the five-second
  inter-question wait required for asynchronous Game Master and memory work
- the composed integration-style fake-HTTP test proves three ordered questions, one session and
  conversation, authenticated request shaping, and judge completion before the next Avatar request
- the seeded Villa Miralac definition is loadable but is not executed by default tests

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

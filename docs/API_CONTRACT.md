# API contract

This document records the stable HTTP surface and invariants. Exact request/response fields and
schemas belong to `packages/shared/src/` and route schemas; do not copy them here.

## Base rules

- Versioned base path: `/v1`; health compatibility route: `GET /health`.
- Authentication: `x-api-key`.
- IDs are opaque strings; timestamps are ISO-8601 UTC strings.
- JSON success/error responses use `ApiResponse<T>`. SSE uses shared event DTOs. Binary audio is the only intentional non-envelope success response.
- Public payloads are projections, never database rows. Unknown fields are rejected at input boundaries.
- Errors use stable `ErrorCode` categories: `UNAUTHORIZED`, `VALIDATION_ERROR`, `FORBIDDEN`,
  `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `EXTERNAL_SERVICE_ERROR`/`PROVIDER_ERROR`, `TIMEOUT`, and
  `INTERNAL_ERROR`. Do not invent a route-local error code.

## Canonical contract owners

- Entities and lifecycle: `entity-types.ts`, `lifecycle-types.ts`.
- Conversation and message responses: `conversation-contract-types.ts`.
- Streaming frames: `conversation-stream-contract-types.ts` and `sse.ts`.
- Knowledge/retrieval: `knowledge-contract-types.ts`.
- Runtime inspection: `runtime-inspector-types.ts` and `runtime-types.ts`.
- Voice/audio: `voice-contract-types.ts`.
- Raw provider exchange: `raw-exchange-contract-types.ts`.

## Public routes

### Raw exchange

- `POST /v1/exchange` — authenticated raw provider exchange for smoke tests and evaluation judging.

### Sessions and conversations

- `POST /v1/sessions`
- `GET /v1/sessions`, `GET /v1/sessions/{sessionId}`
- `POST /v1/sessions/{sessionId}/reset`
- `GET /v1/sessions/{sessionId}/available-avatars`
- `GET /v1/sessions/{sessionId}/avatar-transitions`
- `POST /v1/sessions/{sessionId}/conversations`
- `GET /v1/sessions/{sessionId}/conversations`
- `POST /v1/sessions/{sessionId}/switch-avatar`
- `POST /v1/sessions/{sessionId}/conversations/{conversationId}/end`
- `GET /v1/conversations/{conversationId}/history`
- `POST /v1/conversations/{conversationId}/messages` — normal JSON turn.
- `POST /v1/conversations/{conversationId}/messages/stream` — additive SSE turn.
- `POST /v1/conversations/{conversationId}/voice-messages` — bounded raw-audio turn.
- `POST /v1/conversations/{conversationId}/voice-messages/stream` — bounded raw-audio SSE turn.
- `POST /v1/conversations/{conversationId}/messages/{messageId}/audio` — optional audio for a completed Avatar message.

### Runtime

- `GET /v1/sessions/{sessionId}/runtime-state`
- `GET /v1/sessions/{sessionId}/events/stream`

### Scenarios and Avatars

- `GET|POST /v1/scenarios`
- `GET|PATCH|DELETE /v1/scenarios/{scenarioId}`
- `POST /v1/scenarios/{scenarioId}/prepare-avatar-traits`
- `POST /v1/scenarios/{scenarioId}/avatars`
- `GET /v1/scenarios/{scenarioId}/avatars`
- `PATCH|DELETE /v1/avatars/{avatarId}`

### Knowledge

- `POST /v1/knowledge-sources`
- `POST /v1/knowledge-sources/upload`
- `PATCH /v1/knowledge-sources/{sourceId}`
- `GET /v1/scenarios/{scenarioId}/knowledge-sources`
- `POST /v1/knowledge-sources/{sourceId}/ingest`
- `GET /v1/knowledge-sources/{sourceId}/ingestion-jobs`
- `GET /v1/ingestion-jobs/{ingestionJobId}`

### User persona and facts

- `PUT|GET /v1/users/{userId}/persona`
- `GET /v1/users/{userId}/memory-facts`
- `DELETE /v1/users/{userId}/memory-facts/{factId}`

## Admin routes

All admin routes use `/v1/admin/*` and the same API key in Phase A.

- `GET /v1/admin/health`
- `GET|PUT /v1/admin/model-config`
- `GET /v1/admin/sessions/{sessionId}/inspect`
- `GET /v1/admin/sessions/{sessionId}/events`
- `GET /v1/admin/sessions/{sessionId}/context`
- `GET /v1/admin/sessions/{sessionId}/metrics`
- `GET /v1/admin/sessions/{sessionId}/memory`
- `GET /v1/admin/sessions/{sessionId}/memory-layers`
- `POST /v1/admin/sessions/{sessionId}/gm/replay`
- `POST /v1/admin/sessions/{sessionId}/memory/refresh`
- `POST /v1/admin/sessions/{sessionId}/memory/clear`
- `POST /v1/admin/knowledge/retrieval`
- `POST /v1/admin/knowledge/reindex`
- `GET /v1/admin/knowledge/reindex/{reindexOperationId}`
- `POST /v1/admin/knowledge/reindex/{reindexOperationId}/retry`

Admin projections are bounded and must not expose raw prompts, secrets, raw audio, raw vectors,
provider payloads, or unbounded transcript content.

## Stable invariants

### Conversation turns

- Avatar responds directly; GM and memory work start only after successful completion.
- JSON turns return `ApiResponse<SendMessageResponse>`.
- Streams emit `started`, ordered `delta` frames, then exactly one `completed` or `interrupted` terminal frame.
- An interrupted stream keeps the user message, discards partial Avatar content, and skips post-turn work.
- Avatar text is cleaned before persistence and delivery (presentation-only speaker labels and
  `*stage direction*` blocks are stripped); clients must not invent a second cleanup policy.
- `StartSessionRequest` accepts an optional session-scoped `model` override (reused for Avatar, GM,
  and memory calls in that session) and `avatarOptions.retrieval` (`maxChunks` 1-9, default 7;
  per-source `minimumChunksBySource`, default 1 for GM sources and 3 for `last_user_input`). These
  settings are stored on the session and apply to every message in it, not per-message.
- `SendMessageRequest` accepts an optional additive `model` override for that one request only
  (evaluation/tooling use, not a replacement for persisted scenario/avatar config); the streaming
  route reuses the same request shape.

### Voice and audio

- Voice input is raw bounded audio (`audio/flac|mpeg|mp4|ogg|wav|webm`, <=10MB) with a required
  `x-utterance-id` header; it reuses the existing turn flow and the same terminal-frame contract as
  text streaming. `x-language` and `x-audio-duration-ms` are optional hints; a Scenario language,
  when set, is authoritative over the header.
- Missing provider configuration (`DEEPGRAM_API_KEY` absent) makes voice return `502
PROVIDER_ERROR`; text routes remain unaffected. Duplicate/cancelled voice work returns `409
CONFLICT`, provider timeout `504`, rate limiting `429`.
- Audio playback (`POST .../messages/{messageId}/audio`) is requested only after a completed text
  message, using the persisted cleaned Avatar `Message.content` as the only synthesis source. It
  returns a bounded binary body (not an `ApiResponse` envelope) with `Content-Type`,
  `Content-Length`, `Content-Disposition: inline`, `X-Request-Id`, `X-Message-Id`, and optional
  `X-Audio-Duration-Ms`. Audio bytes are transient and never change message/GM/memory behavior;
  repeated requests are independent reads.
- Provider credentials, voice IDs, and provider-native options are not public fields; a client may
  only pick a shared `format` (default `audio/wav`).

### Content and model selection

- Active Scenarios require canonical BCP-47 `language`; active Avatars require prepared traits
  (`AvatarComputedTraits`) — creation/activation/serving reject incomplete Avatars.
- Static knowledge accepts only `avatar_knowledge`, `world`, and `media`. The removed `memory` value
  is rejected with `400 VALIDATION_ERROR`. Source/chunk metadata is validated recursively; reserved
  keys `userId`, `sessionId`, `conversationId` are rejected the same way.
- `visibilityPolicy` (`'all' | 'avatars' | 'none'`) is required on source create/upload; `'none'`
  means GM-only. `'avatars'` requires at least one avatar ID; `'all'`/`'none'` clear any provided
  IDs. Providing `visibleToAvatarIds` on update still requires an explicit policy.
- Upload accepts `.pdf`/`.txt`/`.text` only, base64-encoded, bounded to ~14MB base64 (~10MB raw);
  replacing content/filename resets source status to `pending`; file replacement cannot combine
  with direct `metadata`/`uriOrPath` edits in the same request.
- Avatar retrieval filters visibility; GM retrieval can request an explicit unrestricted
  (`gm_unrestricted`) view but still enforces scenario/type/readiness/corpus rules.
- Static retrieval (`POST /v1/admin/knowledge/retrieval`) accepts scenario/query/visibility/limit
  inputs only — `sessionId`/`userId`/`conversationId` are rejected; conversational memory is never a
  RAG filter or ranking input.
- Model/provider pairs come from the shared catalog (`packages/shared/src/model-catalog.ts`).
  `scenario.modelSelection` needs `defaultProfile` or `gameMasterOverride` when present; `null`
  clears it. `avatar.llmOverride`, when an object, requires both `provider` and `model`; `null`
  clears it. Runtime precedence: session override (if present, wins for all roles) else, per role —
  Avatar: request model -> `avatar.llmOverride` -> `scenario.modelSelection.defaultProfile` ->
  global avatar override -> global default; GM: `scenario.modelSelection.gameMasterOverride` ->
  `scenario.modelSelection.defaultProfile` -> global GM override -> global default; Memory:
  scenario memory/default profile -> global memory override -> global default.
- `POST /v1/scenarios/{scenarioId}/prepare-avatar-traits` takes no request body. One avatar's
  failure (e.g. `provider_unavailable`) never fails the whole batch, and preparation overwrites only
  `computedTraits`, never authored fields.
- Reindex routes (`POST reindex`, `GET .../{id}`, `POST .../{id}/retry`) return `202` when started,
  `200` when the profile is already active, `404` for an unknown operation, and `409` on retry unless
  the operation is `failed`. The active corpus stays unchanged until every snapshotted source
  validates and promotion commits atomically.

### Diagnostics and evolution

- Retrieval similarity (`1 - distance`) is a presenter-level normalized value; raw cosine distance
  remains an internal repository diagnostic and never crosses into DTOs, events, logs, or errors.
- Context projections separate `conversationState` (messages/working memory/episodic
  memories/facts) from `retrievedContext` (static `avatar_knowledge`/`world`/`media` with
  provenance) — retrieved documents are never emitted as conversational memory.
- Session-context inspection and `turn_completed` events share the same bounded retrieval-trace and
  kept/trimmed selection diagnostics; fields are optional because not every event carries every one.
- Prefer additive changes, preserve field meaning, and update shared DTOs plus consumer tests together.

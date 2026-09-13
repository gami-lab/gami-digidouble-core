# API contract

This document records the stable HTTP surface and invariants. Exact request/response fields and
schemas belong to `packages/shared/src/` and route schemas; do not copy them here.

## Base rules

- Versioned base path: `/v1`; health compatibility route: `GET /health`.
- Authentication: `x-api-key`.
- IDs are opaque strings; timestamps are ISO-8601 UTC strings.
- JSON success/error responses use `ApiResponse<T>`. SSE uses shared event DTOs. Binary audio is the only intentional non-envelope success response.
- Public payloads are projections, never database rows. Unknown fields are rejected at input boundaries.
- Errors use stable categories: unauthorized, validation, forbidden, not-found, conflict, rate-limit, provider, timeout, and internal.

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
- Avatar text is cleaned before persistence and delivery; clients must not invent a second cleanup policy.

### Voice and audio

- Voice input is raw bounded audio with an utterance identity; it reuses the existing turn flow.
- Missing provider configuration makes voice unavailable but does not affect text routes.
- Audio playback is requested only after a completed text message. Audio bytes are transient and never change message/GM/memory behavior.
- Provider credentials, voice IDs, and provider-native options are not public fields.

### Content and model selection

- Active Scenarios require canonical language; active Avatars require prepared traits.
- Static knowledge accepts only `avatar_knowledge`, `world`, and `media`. `memory` is invalid.
- `visibilityPolicy` is explicit. Avatar retrieval filters visibility; GM retrieval can request an explicit unrestricted view but still enforces scenario/type/readiness/corpus rules.
- Static retrieval accepts scenario/query/visibility inputs only; user/session/conversation scope is conversational memory, not a RAG filter.
- Model/provider pairs come from the shared catalog. Runtime precedence is session override, then Avatar/Scenario/role/global configuration as defined by the model-resolution service.

### Diagnostics and evolution

- Retrieval similarity is a presenter-level normalized value; raw distance remains internal.
- Context projections separate `conversationState` from `retrievedContext`.
- Prefer additive changes, preserve field meaning, and update shared DTOs plus consumer tests together.

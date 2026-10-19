# API contract

This document records the stable HTTP surface and invariants. Exact request/response fields and
schemas belong to `packages/shared/src/` and route schemas; do not copy them here.

## Base rules

- Versioned base path: `/v1`; health compatibility route: `GET /health`.
- Authentication depends on the route tier: player routes take `Authorization: Bearer <player
token>`, admin routes the admin session cookie or `x-admin-service-key`, open routes nothing.
- IDs are opaque strings; timestamps are ISO-8601 UTC strings.
- JSON success/error responses use `ApiResponse<T>`. SSE uses shared event DTOs. Binary audio is the only intentional non-envelope success response.
- Public payloads are projections, never database rows. Unknown fields are rejected at input boundaries.
- Player-facing projections (`AvailableAvatarSummary`) are explicit field picks and never carry
  authoring internals: `personaPrompt`, `adjustments`, raw `config`, `computedTraits`, model or
  voice configuration stay on admin projections. The typed `presentation` is the only
  config-derived field that reaches the player, with its media slots resolved to
  `PublicMediaAsset`.
- Authentication runs before the request body is read, so an unauthenticated request gets `401`
  even when its body is malformed or oversized.
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
- Player presentation: `presentation-contract-types.ts`.
- Media assets, references, kinds, MIME types, and limits: `media-contract-types.ts`.
- Raw provider exchange: `raw-exchange-contract-types.ts`.
- Client protocol guards and environment-neutral operator request mappers:
  `api-client-protocol.ts` and `model-config-contract-mappers.ts`.

## Route tiers

Every route declares one tier: `public` (player), `admin` (authoring, operators, tools), or `open`
(no credential). All `/v1/admin/*` routes are `admin`; no authoring route exists outside it.

## Player identity and ownership

- `POST /v1/auth/player` (open) returns `PlayerTokenResponse` (`userId`, `token`, `expiresAt`). With
  no credential it creates a Core-generated player; with `Authorization: Bearer <token>` (valid, or
  expired by less than `PLAYER_TOKEN_REFRESH_WINDOW_SECONDS`) it issues a fresh token for the same
  player; a token it cannot verify returns `401`.
- Every public route requires `Authorization: Bearer <player token>`; `userId` always comes from the
  token. No public request names a user: `StartSessionRequest` has no `userId`, `GET /v1/sessions`
  lists only the caller's sessions, and persona lives at `/v1/me/persona`. A body or query that
  still names a `userId` is an unknown field and returns `400 VALIDATION_ERROR`.
- A `sessionId` or `conversationId` in a public path must belong to the caller. A foreign id returns
  the same `404 NOT_FOUND` as an unknown one, checked before the body is read (voice, audio, and SSE
  routes never start work for another player).
- A player token on an admin route returns `403 FORBIDDEN`.

## Abuse controls

- Rate limits return `429 RATE_LIMITED` with `Retry-After` (seconds). Player routes are limited per
  player, `open` routes per client IP. Policies: `playerToken` (`POST /v1/auth/player`),
  `adminLogin`, `sessionStart` (`POST /v1/sessions`), `message` (JSON and SSE turns), `voice`
  (both voice routes), `audio` (message audio). If the limiter is unavailable the request proceeds
  (fail-open) and a warning is logged.
- Every JSON route has a body limit: 4 KB on `open` routes, 32 KB on player routes, 1 MB on admin
  routes, and ~15 MB on knowledge create/upload/update. Voice audio is bounded at 10 MB. An
  oversized body returns `400 VALIDATION_ERROR`.
- CORS follows the tier: player routes allow `PLAYER_ORIGINS` without credentials and only the
  `Content-Type`, `Authorization`, and voice headers; `/v1/admin/*` allows only `ADMIN_ORIGINS`,
  with credentials. A player origin gets no CORS grant on admin routes.

## Open routes

- `GET /health`
- `POST /v1/auth/player`
- `POST /v1/admin/auth/login` — `AdminLoginRequest` (`password`); sets the admin session cookie.
  A wrong password returns `401 UNAUTHORIZED` with no hint about what was wrong.

## Public routes

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

Session projections always include `unlockedAvatarIds`; an empty array means no Avatar is unlocked
for that session. The list is fixed when the session starts: a scenario with no availability policy
unlocks every Avatar that is active at that moment, and a scenario with a policy unlocks only its
`initialAvatarIds`. Later unlocks come only from the Game Master; Avatars added to or activated in
the scenario afterwards stay locked for existing sessions.

### Runtime

- `GET /v1/sessions/{sessionId}/runtime-state`
- `GET /v1/sessions/{sessionId}/events/stream`

### Scenario catalogue

- `GET /v1/scenarios` — active scenarios only, as `PublicScenarioSummary`
  (`scenarioId`, `name`, `language`, `presentation`). Avatars reach the player through
  `GET /v1/sessions/{sessionId}/available-avatars` (`AvailableAvatarSummary` includes the Avatar
  `presentation`).
- Player presentations carry media slots as `PublicMediaAsset` (`assetId`, `kind`, `url`, optional
  `posterUrl` and `durationMs`, `description`); a slot whose asset no longer resolves is omitted.
  `url` is absolute for URL assets and a path relative to the Core API origin for uploads
  (`/v1/media/{assetId}`); clients resolve it against their API base URL and never build media
  URLs from ids.

### User persona

- `PUT|GET /v1/me/persona` — the caller's persona.

## Admin routes

All admin routes use `/v1/admin/*` and accept only an admin session cookie or the
`x-admin-service-key` header; the player credential is never accepted. A cookie-authenticated
`POST`/`PUT`/`PATCH`/`DELETE` from an origin outside `ADMIN_ORIGINS` (or with no `Origin`) returns
`403 FORBIDDEN`.

### Admin authentication

- `POST /v1/admin/auth/logout` — ends the cookie session and clears the cookie.
- `GET /v1/admin/auth/me` — `AdminMeResponse` (`authenticatedBy: 'session' | 'service_key'`).
- `POST /v1/admin/player-tokens` — `IssuePlayerTokenRequest` (`userId`) returns a player token
  acting as that player, for the console and the evaluation tool.

### Raw exchange

- `POST /v1/admin/exchange` — raw provider exchange for smoke tests and evaluation judging.

### Scenarios and Avatars

- `GET|POST /v1/admin/scenarios`
- `GET|PATCH|DELETE /v1/admin/scenarios/{scenarioId}`
- `POST /v1/admin/scenarios/{scenarioId}/prepare-avatar-traits`
- `POST /v1/admin/scenarios/{scenarioId}/avatars`
- `GET /v1/admin/scenarios/{scenarioId}/avatars`
- `PATCH|DELETE /v1/admin/avatars/{avatarId}`

### Knowledge

- `POST /v1/admin/knowledge-sources`
- `POST /v1/admin/knowledge-sources/upload`
- `PATCH|DELETE /v1/admin/knowledge-sources/{sourceId}`
- `GET /v1/admin/scenarios/{scenarioId}/knowledge-sources`
- `POST /v1/admin/knowledge-sources/{sourceId}/ingest`
- `GET /v1/admin/knowledge-sources/{sourceId}/ingestion-jobs`
- `GET /v1/admin/knowledge-sources/{sourceId}/chunks`
- `GET /v1/admin/ingestion-jobs/{ingestionJobId}`

### Operations

- `GET /v1/admin/sessions?scenarioId=&userId=&status=` — cross-user session listing
- `DELETE /v1/admin/sessions/{sessionId}`
- `GET /v1/admin/health`
- `GET|PUT /v1/admin/model-config`
- `GET /v1/admin/voices?provider=&language=` — `providers` (text-to-speech providers with an API
  key on Core), `defaultProvider`, and the voices of `provider` (the requested one, else the
  default, else the first available) plus its default voice for that language; `provider: null`
  with no voices when that provider has no API key or none is available
- `GET /v1/admin/sessions/{sessionId}/inspect`
- `GET /v1/admin/sessions/{sessionId}/events`
- `GET /v1/admin/sessions/{sessionId}/context`
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
  streams a bounded binary body (not an `ApiResponse` envelope, no `Content-Length`) as the provider
  produces it, with `Content-Type`, `Content-Disposition: inline`, `Cache-Control: no-store`,
  `X-Request-Id`, and `X-Message-Id`. Failures before the first audio chunk return the standard
  error envelope; a failure after it ends the stream early. Closing the connection cancels
  synthesis. `audio/pcm` is raw 16-bit little-endian mono PCM at 24 kHz, playable chunk by chunk.
  Audio bytes are transient and never change message/GM/memory behavior; repeated requests are
  independent reads.
- Scenario and Avatar `voiceConfig` is `{ provider, voiceId? }`, a provider (and optionally one of
  its voices) picked from `GET /v1/admin/voices`. Saving a provider without an API key on Core
  returns `400 VALIDATION_ERROR`. Synthesis uses the Avatar provider, else the
  Scenario provider, else Core's default provider (`TTS_PROVIDER`); selections for a provider
  without an API key are skipped. The voice is the Avatar's, else the Scenario's, for that provider,
  else the provider's default voice for the Scenario language. With no provider, audio returns
  `502 PROVIDER_ERROR`; with no usable voice, `409 CONFLICT` (`no_voice_available`).
- Scenario and Avatar `presentation` (canonical owner `presentation-contract-types.ts`, limits in
  `PRESENTATION_LIMITS`) is a top-level create/update field. An update replaces the whole object
  and `null` clears it; omitting it keeps the stored value, including when `config` is replaced.
  Unknown keys, blank text, over-limit text, more than three starter questions, or `uiHints`
  inside `config` return `400 VALIDATION_ERROR`.
- Presentation media slots hold a `MediaRef` (asset id). Scenario: `cover` (image), `introMedia`
  and `outroMedia` (image or video). Avatar: `portrait` (image), `idleLoop` (video). A ref that is
  not an asset id, names an asset of another scenario or a missing asset, or has a kind the slot
  does not accept returns `400 VALIDATION_ERROR`; a scenario create cannot reference media because
  the scenario has no assets yet.
- Provider credentials and provider-native options are not public fields; a client may only pick a
  shared `format` (default `audio/wav`).

### Content and model selection

- Active Scenarios require canonical BCP-47 `language`; active Avatars require prepared traits
  (`AvatarComputedTraits`) — creation/activation/serving reject incomplete Avatars.
- Static knowledge accepts only `avatar_knowledge` and `world`; source formats are `pdf`, `text`,
  `markdown`, and `url`. Images and video are media assets, not knowledge. The removed `memory`
  and `media` values are rejected with `400 VALIDATION_ERROR`. Source/chunk metadata is validated recursively; reserved
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
  `scenario.modelSelection` needs at least one of `defaultProfile`, `avatarOverride`,
  `gameMasterOverride`, or `memoryOverride` when present; `null`
  clears it. The scenario selection has four independent slots: `defaultProfile`,
  `avatarOverride`, `gameMasterOverride`, and `memoryOverride`. `avatar.llmOverride`, when an
  object, requires both `provider` and `model`; `null` clears it. Runtime precedence is session
  override (if present, wins for all roles) otherwise, per role — Avatar: request model ->
  `avatar.llmOverride` -> `scenario.modelSelection.avatarOverride` ->
  `scenario.modelSelection.defaultProfile` -> global avatar override -> global default; GM:
  `scenario.modelSelection.gameMasterOverride` -> `scenario.modelSelection.defaultProfile` ->
  global GM override -> global default; Memory: `scenario.modelSelection.memoryOverride` ->
  `scenario.modelSelection.defaultProfile` -> global memory override -> global default.
- `POST /v1/admin/scenarios/{scenarioId}/prepare-avatar-traits` takes an optional body
  `PrepareAvatarTraitsRequest`: `avatarId` prepares only that avatar (`404` when it is not in the
  scenario); otherwise `scope` is `all` (default, re-prepares every avatar) or `unprepared` (only
  avatars without `computedTraits`; skipped avatars are omitted from `results`). Each avatar's
  preparation input includes only the `avatar_knowledge`/`world` sources whose visibility policy
  admits that avatar, the same rule as runtime retrieval. One avatar's
  failure (e.g. `provider_unavailable`) never fails the whole batch; `output_truncated` means the
  model hit the trait-preparation output token cap before finishing the JSON, while
  `unparseable_output` means complete output that is not valid trait JSON. Preparation overwrites only
  `computedTraits`, never authored fields. Trait preparation resolves `scenario.modelSelection.defaultProfile`
  and falls back directly to the global default, independently of the Avatar role override,
  scenario `avatarOverride`, and Avatar entity `llmOverride`.
- Reindex routes (`POST reindex`, `GET .../{id}`, `POST .../{id}/retry`) return `202` when an
  operation is started or reused, `404` for an unknown operation, and `409` on retry unless the
  operation is `failed`. A same-profile `POST reindex` is an explicit replacement run: unchanged
  chunks may be copied forward, while the active corpus stays unchanged until every snapshotted
  source validates and promotion commits atomically. Reindex source progress includes bounded
  `embeddedChunkCount` and `reusedChunkCount` values.

### Diagnostics and evolution

- Retrieval similarity (`1 - distance`) is a presenter-level normalized value; raw cosine distance
  remains an internal repository diagnostic and never crosses into DTOs, events, logs, or errors.
- Retrieved knowledge references may include `matchType` (`vector`, `lexical`, or `both`) to explain
  which bounded candidate paths returned the item; lexical-only items have no cosine similarity.
- Retrieval visibility diagnostics report the visibility mode and considered candidates; they do not
  expose an excluded-row count because filtering is performed inside the SQL query.
- Context projections separate `conversationState` (messages/working memory/episodic
  memories) from `retrievedContext` (static `avatar_knowledge`/`world` with
  provenance) — retrieved documents are never emitted as conversational memory.
- Session-context inspection and `turn_completed` events share the same bounded retrieval-trace and
  kept/trimmed selection diagnostics; fields are optional because not every event carries every one.
- Session events link to Langfuse instead of carrying prompts: a `turn_completed` event's
  `correlationId` is the Avatar call's trace id, and GM and memory-refresh payloads carry
  `llmTraceId`. These are Core ids; the Langfuse (OpenTelemetry) trace id is the first 32 hex
  characters of the id's SHA-256 (`createTraceId` in `@langfuse/tracing`). Trait-preparation traces (one per avatar LLM call plus a run summary) are grouped
  under the Langfuse session `trait-preparation:{scenarioId}`. `turn_completed` records `inputMode`, plus `speechToTextLatencyMs` (voice turns,
  outside `totalTurnLatencyMs`) and `avatarFirstTokenLatencyMs` (streamed turns). Post-turn memory
  refreshes that the cadence skips log no event. Conversation-close memory work (episodic
  generation) is listed too; events outside a turn use
  their own request id as `correlationId`. Each reply audio synthesis is listed
  (`message_audio_synthesized`/`message_audio_failed`, keyed by `messageId`, with total `latencyMs`
  and, on success, `firstAudioMs` until the first audio chunk).
- Prefer additive changes, preserve field meaning, and update shared DTOs plus consumer tests together.

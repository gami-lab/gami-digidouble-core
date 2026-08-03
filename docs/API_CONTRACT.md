# API Contract

## Purpose

Compact HTTP contract reference for Gami DigiDouble Core Phase A.

Exact wire types live in:

- `packages/shared/src/entity-types.ts`
- `packages/shared/src/conversation-contract-types.ts`
- `packages/shared/src/conversation-stream-contract-types.ts`
- `packages/shared/src/web-contract-types.ts`
- `packages/shared/src/knowledge-contract-types.ts`
- `packages/shared/src/runtime-inspector-types.ts`
- `packages/shared/src/lifecycle-types.ts`

Use those files as the canonical field-level source of truth. This document keeps the stable surface area, invariants, and route inventory in one place.

## Base Rules

- Base path: `/v1`
- Compatibility route outside `/v1`: `GET /health`
- Content types: `application/json`, `text/event-stream`
- Auth: `x-api-key: <API_KEY>`
- Timestamps: ISO-8601 UTC strings
- IDs: opaque strings
- Non-streaming responses use `ApiResponse<T>`

```ts
type ApiResponse<T> = {
  data: T | null
  error: {
    code: ErrorCode
    message: string
    details?: unknown
  } | null
  meta?: {
    requestId?: string
    timestamp?: string
  }
}

type ErrorCode =
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'TIMEOUT'
  | 'INTERNAL_ERROR'
```

## Core Shared Shapes

Only the highest-value DTOs are summarized here. For exact fields, read the shared types.

```ts
type UserPersona = {
  name?: string
  roleInWorld?: string
  avatarRelationships?: string[]
  dialogGuidance?: string
}

type AvatarComputedTraits = {
  identity: string[]
  personality: string[]
  speakingStyle: string[]
  background: string[]
  timeline: string[]
  currentSituation: string[]
  behaviouralRules: string[]
}

type RuntimeState = {
  sessionId: string
  conversationId?: string
  canSendMessage: boolean
  isProcessing: boolean
  updatedAt: string
}
```

Compatibility rules:

- `AvatarSummary.computedTraits: null` is valid for avatars that have not been prepared yet.
- `AvailableAvatarSummary` is intentionally narrower than `AvatarSummary`; do not leak `config` or `llmOverride` into player-facing discovery routes.
- `SessionSummary.activeAvatarId` is optional; use explicit `null` only where a route contract says so.

## Public Routes

### Raw Exchange

- `GET /health` -> basic process health check
- `POST /v1/exchange` -> raw provider smoke-test path. Request body: `{ message: string; systemPrompt?: string; model?: { provider?: 'openai' | 'anthropic' | 'mistral' | 'xai'; model?: string; serviceTier?: 'fast' } }`; `message` and `systemPrompt` are limited to 4000 characters and `model.model` to 200 characters. When provided, `model` is an explicit request-level selection for this exchange; `serviceTier: 'fast'` requests OpenAI Fast mode; omitted fields continue to use the configured provider/model resolution.
  The success payload is `ApiResponse<RawExchangeResponse>` with `{ requestId, reply, model,
inputTokens, outputTokens, latencyMs }`. The route does not guarantee `costUsd`; consumers must
  treat cost as unavailable unless a future additive API field supplies it.

`RawExchangeResponse` is owned by `packages/shared/src/raw-exchange-contract-types.ts`. The
application use case keeps its internal `SendRawMessageOutput`, and the API route maps that output
to the shared wire type.

### Sessions

- `POST /v1/sessions` -> `StartSessionRequest` -> `StartSessionResponse`
- `GET /v1/sessions/{sessionId}` -> `GetSessionResponse`
- `GET /v1/sessions` -> `ListSessionsResponse`
- `POST /v1/sessions/{sessionId}/reset` -> `ResetSessionResponse`
- `GET /v1/sessions/{sessionId}/available-avatars` -> `GetAvailableAvatarsResponse`
- `GET /v1/sessions/{sessionId}/avatar-transitions` -> `{ sessionId: string; transitions: AvatarTransitionRecord[] }`

### Conversations

- `POST /v1/sessions/{sessionId}/conversations` -> `StartConversationRequest` -> `StartConversationResponse`
- `GET /v1/sessions/{sessionId}/conversations` -> `ListSessionConversationsResponse`
- `POST /v1/sessions/{sessionId}/switch-avatar` -> `SwitchAvatarResponse`
- `POST /v1/sessions/{sessionId}/conversations/{conversationId}/end` -> `EndConversationRequest` -> `EndConversationResponse`
- `POST /v1/conversations/{conversationId}/messages` -> `SendMessageRequest` -> `ApiResponse<SendMessageResponse>`
- `POST /v1/conversations/{conversationId}/messages/stream` -> `SendMessageRequest` -> SSE
  `MessageStreamEvent` frames
- `GET /v1/conversations/{conversationId}/history` -> `ConversationHistoryResponse`

`StartSessionRequest` accepts an optional session-scoped `model` override and Avatar retrieval
settings. The model override is reused for Avatar, Game Master, and memory-compaction calls in the
session:

```json
{
  "userId": "user_1",
  "scenarioId": "scenario_1",
  "model": {
    "provider": "openai",
    "model": "gpt-5.6-luna",
    "serviceTier": "fast"
  },
  "avatarOptions": {
    "retrieval": {
      "maxChunks": 7,
      "minimumChunksBySource": {
        "gm_required_fact": 1,
        "gm_retrieval_query": 1,
        "last_user_input": 3
      }
    }
  }
}
```

`maxChunks` is an integer from 1 to 9 and defaults to 7. Source minimums default to 1 for GM
sources and 3 for `last_user_input`; they are bounded by available retrieval results and the total
chunk limit. The settings are stored on the
session and reused for every synchronous and streaming message in that session; they are not
changed per message.

`SendMessageRequest` requires `{ message: { content: string } }` and accepts an optional additive
`model` selection `{ provider?: 'openai' | 'anthropic' | 'mistral' | 'xai'; model?: string; serviceTier?: 'fast' }`.
When supplied, its provider/model fields take precedence for that Avatar request only; omitted
fields continue through the normal server model-resolution precedence. The same request shape is
used by the streaming route. This is intended for controlled clients such as evaluation tooling,
not as a replacement for persisted scenario or Avatar configuration.

Avatar responses are cleaned before persistence and before they are returned or streamed to clients.
Presentation-only labels or stage-direction blocks that begin a line with `*` or `**` are removed
through their closing marker; dialogue following a leading speaker label is preserved.

Message-stream contract ownership:

- The message-stream request reuses `SendMessageRequest`; no parallel stream request DTO is
  introduced.
- Public stream events are defined by `MessageStreamEvent` in
  `packages/shared/src/conversation-stream-contract-types.ts`.
- Provider adapters and the application streaming use case now expose the internal streaming
  capability behind `ILlmAdapter`; the use case persists the user before streaming, persists the
  final avatar only after terminal completion, and leaves the user message intact on interruption.
- The streaming route emits one `data:` JSON payload per event with `event: conversation_message`
  over `text/event-stream`; events are emitted as `started`, zero or more monotonically sequenced
  `delta` events, then exactly one terminal `completed` or `interrupted` event. A client/provider
  abort never persists a partial avatar message or schedules post-turn GM/memory work. The route
  is additive and does not change the existing JSON send-message route, which continues to return
  `ApiResponse<SendMessageResponse>`. Public clients decode frames through the shared
  `parseMessageStreamEvent` boundary before applying state changes. The observed provider wrapper
  records interruption outcome and reason on the existing request trace without creating a trace
  per delta.

### Runtime

- `GET /v1/sessions/{sessionId}/runtime-state` -> `{ runtimeState: RuntimeState }`
- `GET /v1/sessions/{sessionId}/events/stream` -> SSE runtime events
- GM switch decisions update the session’s next active Avatar only. They do not create or close
  conversations and do not emit a second switch event; clients use the existing
  `POST /v1/sessions/{sessionId}/switch-avatar` mechanism to complete the conversation handoff.

### Scenarios

- `GET /v1/scenarios` -> `ListScenariosResponse`
- `POST /v1/scenarios` -> `CreateScenarioRequest` -> `CreateScenarioResponse`
- `GET /v1/scenarios/{scenarioId}` -> `GetScenarioResponse`
- `PATCH /v1/scenarios/{scenarioId}` -> `UpdateScenarioRequest` -> `UpdateScenarioResponse`
- `DELETE /v1/scenarios/{scenarioId}` -> `DeleteScenarioResponse`
- `POST /v1/scenarios/{scenarioId}/prepare-avatar-traits` -> `PrepareAvatarTraitsResponse`

### Avatars

- `POST /v1/scenarios/{scenarioId}/avatars` -> `CreateAvatarRequest` -> `CreateAvatarResponse`
- `GET /v1/scenarios/{scenarioId}/avatars` -> `ListScenarioAvatarsResponse`
- `PATCH /v1/avatars/{avatarId}` -> `UpdateAvatarRequest` -> `UpdateAvatarResponse`
- `DELETE /v1/avatars/{avatarId}` -> `DeleteAvatarResponse`

### Knowledge

- `POST /v1/knowledge-sources` -> `CreateKnowledgeSourceRequest` -> `CreateKnowledgeSourceResponse`
- `POST /v1/knowledge-sources/upload` -> `UploadKnowledgeSourceRequest` -> `UploadKnowledgeSourceResponse`
- `PATCH /v1/knowledge-sources/{sourceId}` -> `UpdateKnowledgeSourceRequest` -> `UpdateKnowledgeSourceResponse`
- `GET /v1/scenarios/{scenarioId}/knowledge-sources` -> `ListKnowledgeSourcesResponse`
- `POST /v1/knowledge-sources/{sourceId}/ingest` -> `TriggerIngestionRequest` -> `TriggerIngestionResponse`
- `GET /v1/knowledge-sources/{sourceId}/ingestion-jobs` -> `ListIngestionJobsResponse`
- `GET /v1/ingestion-jobs/{ingestionJobId}` -> `GetIngestionJobResponse`

`TriggerIngestionRequest` accepts an optional `chunkSize` integer from 100 to 10000. It controls
the target character size for that asynchronous ingestion job, is persisted for retries, and keeps
the default 1500-character target when omitted.

### User Persona And Memory

- `PUT /v1/users/{userId}/persona` -> `UpsertUserPersonaRequest` -> `UpsertUserPersonaResponse`
- `GET /v1/users/{userId}/persona` -> `UserPersonaResponse`
- `GET /v1/users/{userId}/memory-facts` -> user fact list
- `DELETE /v1/users/{userId}/memory-facts/{factId}` -> fact deletion result

## Admin Routes

All admin endpoints live under `/v1/admin/*`.

### Health And Model Configuration

- `GET /v1/admin/health`
- `GET /v1/admin/model-config` -> effective global/role config
- `PUT /v1/admin/model-config` -> update global default plus optional role overrides

### Session Inspection

- `GET /v1/admin/sessions/{sessionId}/inspect` -> session, GM state, transition history, unlocks, notes, effective models
- `GET /v1/admin/sessions/{sessionId}/events` -> safe event-log view
- `GET /v1/admin/sessions/{sessionId}/context` -> bounded `avatarContext`, `gmContext`, and `contextTrace`
- `GET /v1/admin/sessions/{sessionId}/metrics`
- `GET /v1/admin/sessions/{sessionId}/memory`
- `GET /v1/admin/sessions/{sessionId}/memory-layers`

### Runtime Actions

- `POST /v1/admin/sessions/{sessionId}/gm/replay`
- `POST /v1/admin/sessions/{sessionId}/memory/refresh`
- `POST /v1/admin/sessions/{sessionId}/memory/clear`

### Knowledge Diagnostics

- `POST /v1/admin/knowledge/retrieval` -> `QueryKnowledgeRetrievalResponse`; an omitted
  `activeAvatarId` requests the unrestricted GM diagnostic view, while an explicit avatar ID
  applies avatar visibility filtering. The response trace includes the query variants used and
  each result may include its matched query source/text.

Runtime `turn_completed` event retrieval references include the selected chunk content and matched
query source/text so the console can inspect the exact knowledge passed to the Avatar prompt. GM
events include the retrieval plan's required flag, proposed queries, and required facts. When a
subsequent Avatar turn consumes that plan, its `turn_completed` event records the source turn and
plan contents so the console can show which proposals produced matching chunks.

## Route-Specific Invariants

### Scenario And Avatar Model Selection

- Scenario `modelSelection` must contain `defaultProfile` or `gameMasterOverride` when present.
- Avatar `llmOverride`, when provided as an object, requires both `provider` and `model`.
- `modelSelection: null` clears stored scenario-level model selection.
- `llmOverride: null` clears the stored avatar override.
- Provider/model pairs must come from the canonical catalog in `packages/shared/src/model-catalog.ts`.

Runtime precedence:

- Avatar runtime: `avatar.llmOverride` -> `scenario.modelSelection.defaultProfile` -> global avatar override -> global default
- When a session `model` override is present, it takes precedence for all three runtime roles,
  including over per-message Avatar model overrides.
- Avatar runtime without a session override: request `model` -> `avatar.llmOverride` -> `scenario.modelSelection.defaultProfile` -> global avatar override -> global default
- GM runtime without a session override: `scenario.modelSelection.gameMasterOverride` -> `scenario.modelSelection.defaultProfile` -> global GM override -> global default
- Memory runtime without a session override: scenario memory/default profile -> global memory override -> global default

### Avatar Trait Preparation

- `POST /v1/scenarios/{scenarioId}/prepare-avatar-traits` is explicit and synchronous.
- The route accepts no request body; any JSON body returns `400 VALIDATION_ERROR`.
- One failed avatar preparation must not fail the whole scenario batch.
- Preparation overwrites `computedTraits` only; it never edits authored avatar fields.

### Knowledge Visibility

- `KnowledgeVisibilityPolicy` is `'all' | 'avatars' | 'none'`.
- `'none'` means GM-only: excluded from avatar retrieval, still visible to GM/debug paths where explicitly allowed.
- Providing `visibleToAvatarIds` without `visibilityPolicy` normalizes to `'avatars'`.
- `'all'` or `'none'` clears any provided `visibleToAvatarIds`.
- `'avatars'` requires at least one avatar ID after trimming.

### Knowledge Upload And Update

- Upload accepts `.pdf`, `.txt`, and `.text` only.
- Upload `content` is base64-encoded file bytes; extracted text is stored as `metadata.inlineText`.
- Max upload size is approximately 14 MB base64 / 10 MB raw.
- For updates, `content` and `filename` must be provided together.
- File replacement cannot be combined with direct `metadata` or `uriOrPath` edits in the same request.
- Replacing inline text or file content resets the source status to `pending`.

### Runtime Diagnostics

- Admin event payloads may include counts, flags, latency, effective models, and bounded selection metadata.
- Admin event payloads must not include raw prompt text, secrets, or unbounded transcript content.
- Session context is a bounded current snapshot, not a replay of a specific historical turn.
- Current shared GM state projections expose progression and interaction count; covered topics are
  exposed only under memory-owned working-memory sections.
- Legacy `gm_states.topics_covered` data may be read for persistence compatibility but is omitted
  from current admin DTOs and runtime event summaries.

## Validation And Status Rules

- Message content must be non-empty after trimming and stay within route-specific limits.
- Config fields are JSON objects, never JSON-encoded strings.
- Success statuses: `200`, `201`, `202`, `204`
- Common error statuses: `400`, `401`, `403`, `404`, `409`, `429`, `500`, `502`, `503`, `504`

## Evolution Rules

- Prefer additive changes.
- Do not silently change field meaning.
- Keep public payloads thinner than internal runtime state.
- Reuse canonical shared DTOs instead of re-declaring route-local variants.

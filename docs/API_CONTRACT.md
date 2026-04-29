# API_CONTRACT.md

## Purpose

Define the first version of the public API contract for the MVP Core.

This contract is designed for Phase A:

- text in / text out
- API-first
- headless core
- back-office compatible
- easy to evolve

The goal is not to model every future capability now.

The goal is to define a clean, stable, minimal API that supports:

- starting a session
- sending messages
- streaming responses
- reading history
- configuring scenarios
- registering knowledge sources
- inspecting basic runtime state

---

# Design Principles

## 1. API First

Everything the Core does must be reachable through explicit contracts.

## 2. Minimal Surface

Only expose what Phase A needs.

## 3. Stable Shapes

Prefer predictable JSON objects over overly clever polymorphism.

## 4. Headless by Default

The API describes orchestration behavior, not UI behavior.

## 5. Structured Metadata

Responses may include metadata, but metadata must never make the core payload hard to use.

## 6. Versioned from Day 1

All endpoints live under `/v1`.

---

# Base Rules

## Base URL

```text
/v1
```

## Content Type

```text
application/json
```

Streaming endpoints may additionally use:

```text
text/event-stream
```

or WebSocket.

## Authentication

Phase A uses simple API key authentication.

### Header

```text
x-api-key: <API_KEY>
```

## Timestamps

All timestamps are ISO 8601 strings in UTC.

## IDs

All IDs are opaque strings.

Examples:

- `user_...`
- `scenario_...`
- `session_...`
- `msg_...`
- `source_...`

No client should infer meaning from IDs.

---

# Common Response Envelope

Use a simple envelope for non-streaming responses.

```ts id="z94aos"
type ApiResponse<T> = {
  data: T
  error: null | {
    code: string
    message: string
    details?: unknown
  }
  meta?: {
    requestId?: string
    timestamp?: string
  }
}
```

Successful responses set:

- `error = null`

Failed responses set:

- `data = null`
- `error != null`

---

# Common Error Codes

```ts id="h7kflt"
type ErrorCode =
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'PROVIDER_ERROR'
  | 'TIMEOUT'
  | 'INTERNAL_ERROR'
```

---

# Core Types

## User Reference

```ts id="cjjlwm"
type UserRef = {
  userId: string
}
```

## Scenario Summary

```ts id="e3su3b"
type ScenarioSummary = {
  scenarioId: string
  name: string
  status: 'draft' | 'active' | 'archived'
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

`config` is a JSON object in all scenario responses and must never be returned as a JSON-encoded string.
```

## Avatar Summary

```ts
type AvatarSummary = {
  avatarId: string
  scenarioId: string
  name: string
  status: 'draft' | 'active' | 'archived'
  personaPrompt: string
  tone?: string
  description?: string
  adjustments?: string[]
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}
```

## Session Summary

```ts id="744oc5"
type SessionSummary = {
  sessionId: string
  userId: string
  scenarioId: string
  activeAvatarId?: string | null
  unlockedAvatarIds?: string[]
  status: 'active' | 'closed' | 'archived'
  startedAt: string
  lastActivityAt: string
  endedAt?: string | null
}
```

## Conversation Summary

```ts
type ConversationSummary = {
  conversationId: string
  sessionId: string
  avatarId: string
  status: 'active' | 'closed' | 'archived'
  startedAt: string
  lastActivityAt: string
  endedAt?: string | null
}
```

## Avatar Transition Record

```ts
type AvatarTransitionRecord = {
  toConversationId: string
  toAvatarId: string
  fromConversationId: string | null
  fromAvatarId: string | null
  reason: string | null
  startedBy: 'user' | 'gm' | 'system' | null
  transitionedAt: string
}
```

## Message

```ts id="1esb1v"
type Message = {
  messageId: string
  conversationId: string
  role: 'user' | 'avatar' | 'system'
  content: string
  createdAt: string
  metadata?: {
    model?: string
    latencyMs?: number
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    costUsd?: number
    triggerSource?: string
  }
}
```

## Session Memory Summary

```ts id="qndh2r"
type SessionMemorySummary = {
  sessionId: string
  summary: string
  updatedAt: string
}
```

## Knowledge Source Summary

```ts id="8tpxe0"
type KnowledgeSourceSummary = {
  sourceId: string
  scenarioId: string
  name: string
  type: 'pdf' | 'text' | 'markdown' | 'url' | 'media'
  status: 'pending' | 'ready' | 'error'
  uriOrPath: string
  createdAt: string
  metadata?: Record<string, unknown>
}
```

---

# Session + Conversation API

## 0. Raw Exchange (EPIC 1.2)

Minimal non-session endpoint used to validate the first HTTP → use case → LLM loop.

### Endpoint

```text
POST /v1/exchange
```

### Error Mapping

- `401` → `UNAUTHORIZED`
- `400` → `VALIDATION_ERROR`
- `502` → `EXTERNAL_SERVICE_ERROR`
- `500` → `INTERNAL_ERROR`

---

## Core semantics

- **Session** = one user run inside one scenario (durable container)
- **Conversation** = one bounded dialogue episode with one avatar inside a session
- **Message** always belongs to a **conversation**
- Switching avatar creates a new conversation
- Returning later to the same avatar also creates a new conversation
- Send-message targets conversationId and does **not** accept avatarId

---

## 1. Create Session

### Endpoint

```text
POST /v1/sessions
```

### Request

```ts
type CreateSessionRequest = {
  userId: string
  scenarioId: string
}
```

### Response

```ts
type CreateSessionResponse = {
  session: SessionSummary
}
```

### Error Mapping

- `401` → `UNAUTHORIZED`
- `400` → `VALIDATION_ERROR`
- `404` → `NOT_FOUND` (scenario missing)
- `500` → `INTERNAL_ERROR`

---

## 2. Get Session

### Endpoint

```text
GET /v1/sessions/{sessionId}
```

### Response

```ts
type GetSessionResponse = {
  session: SessionSummary
}
```

---

## 2.1 List Sessions

### Endpoint

```text
GET /v1/sessions
```

### Query Parameters

All parameters are optional.

| Parameter    | Type                               | Description                 |
| ------------ | ---------------------------------- | --------------------------- |
| `scenarioId` | string                             | Filter sessions by scenario |
| `userId`     | string                             | Filter sessions by user     |
| `status`     | `active` \| `closed` \| `archived` | Filter sessions by status   |

### Response

```ts
type ListSessionsResponse = {
  sessions: SessionSummary[]
}
```

Sessions are ordered by `lastActivityAt DESC` (most recently active first). Phase A returns the full result set without pagination.

### Error Mapping

- `401` → `UNAUTHORIZED`
- `400` → `VALIDATION_ERROR` (invalid status filter value)
- `500` → `INTERNAL_ERROR`

---

## 2.2 Reset Session

### Endpoint

```text
POST /v1/sessions/{sessionId}/reset
```

### Semantics

A reset is a hard reset to a clean slate. The session record is **not deleted**, only its runtime state is cleared:

- All **messages** for all conversations in the session are deleted
- All **conversations** for the session are deleted
- `activeAvatarId` is cleared to `null`
- `unlockedAvatarIds` is reset to `[]`
- `gmNotes` is cleared to `null`
- `status` is reset to `'active'` (even if previously `'closed'`)
- `lastActivityAt` is refreshed to now

The session's `userId` and `scenarioId` binding is preserved.

### Request

No request body required.

### Response

```ts
type ResetSessionResponse = {
  session: SessionSummary
}
```

Returns the updated session record (`200 OK`).

### Error Mapping

- `401` → `UNAUTHORIZED`
- `404` → `NOT_FOUND` (session not found)
- `500` → `INTERNAL_ERROR`

---

## 3. Start Conversation in Session

### Endpoint

```text
POST /v1/sessions/{sessionId}/conversations
```

### Request

```ts
type StartConversationRequest = {
  avatarId: string
}
```

### Response

```ts
type StartConversationResponse = {
  conversation: ConversationSummary
}
```

### Error Mapping

- `401` → `UNAUTHORIZED`
- `400` → `VALIDATION_ERROR`
- `403` → `FORBIDDEN` (avatar locked for this session)
- `404` → `NOT_FOUND` (session or avatar missing)
- `409` → `CONFLICT` (session not active)
- `500` → `INTERNAL_ERROR`

---

## 3.5 Manual Avatar Switch in Session

### Endpoint

```text
POST /v1/sessions/{sessionId}/switch-avatar
```

### Request

```ts
type SwitchAvatarRequest = {
  avatarId: string
  reason?: string // optional free-text reason label, max 200 chars
}
```

### Response

```ts
type SwitchAvatarOutput = {
  session: SessionSummary
  conversation: ConversationSummary
  previousConversationId: string | null
}
```

### Semantics

- Manual switch requires an unlocked avatar when `session.unlockedAvatarIds` is present.
- Current active conversation is closed if present.
- A new conversation is always created, including when switching to the same avatar.
- New conversation carries `startedBy = 'user'`.
- `reason` defaults to `'manual_switch'` when omitted.
- `handoffFromConversationId` is set to the previous active conversation when one existed.

### Error Mapping

- `401` → `UNAUTHORIZED`
- `400` → `VALIDATION_ERROR`
- `403` → `FORBIDDEN` (avatar locked for this session)
- `404` → `NOT_FOUND` (session or avatar missing)
- `409` → `CONFLICT` (session not active)
- `500` → `INTERNAL_ERROR`

---

## 3.6 Get Available Avatars in Session

### Endpoint

```text
GET /v1/sessions/{sessionId}/available-avatars
```

### Response

```ts
type GetAvailableAvatarsOutput = {
  sessionId: string
  currentAvatarId: string | null
  avatars: AvatarSummary[]
}
```

### Semantics

- `avatars` contains only avatars with `status = 'active'` in the session's scenario.
- When `session.unlockedAvatarIds` exists, `avatars` is additionally filtered to that unlocked set.
- Legacy sessions without `unlockedAvatarIds` return all active scenario avatars.

### Error Mapping

- `401` → `UNAUTHORIZED`
- `404` → `NOT_FOUND` (session missing)
- `500` → `INTERNAL_ERROR`

---

## 3.7 Get Avatar Transitions in Session

### Endpoint

```text
GET /v1/sessions/{sessionId}/avatar-transitions
```

### Response

```ts
type GetAvatarTransitionsOutput = {
  sessionId: string
  transitions: AvatarTransitionRecord[]
}
```

### Semantics

- Returns transitions ordered by `transitionedAt ASC`.
- When there are no conversations in the session, returns `transitions: []`.
- The first conversation transition always has:
  - `fromConversationId = null`
  - `fromAvatarId = null`
  - `reason = 'session_start'`

### Error Mapping

- `401` → `UNAUTHORIZED`
- `404` → `NOT_FOUND` (session missing)
- `500` → `INTERNAL_ERROR`

---

## 4. List Session Conversations

### Endpoint

```text
GET /v1/sessions/{sessionId}/conversations
```

### Response

```ts
type ListSessionConversationsResponse = {
  conversations: ConversationSummary[]
}
```

---

## 5. Send Message to Conversation

### Endpoint

```text
POST /v1/conversations/{conversationId}/messages
```

### Request

```ts
type SendMessageRequest = {
  message: {
    content: string
  }
}
```

### Response

```ts
type SendMessageResponse = {
  conversation: ConversationSummary
  session: SessionSummary
  userMessage: Message
  avatarMessage: Message
  debug: {
    requestId: string
    model: string
    latencyMs: number
    inputTokens: number
    outputTokens: number
  }
}
```

### Error Mapping

- `401` → `UNAUTHORIZED`
- `400` → `VALIDATION_ERROR`
- `404` → `NOT_FOUND` (conversation missing)
- `409` → `CONFLICT` (conversation or session not active)
- `502` → `EXTERNAL_SERVICE_ERROR`
- `500` → `INTERNAL_ERROR`

> **Game Master integration:** If the Game Master has stored guidance notes for this session (set asynchronously after a previous turn), they are appended to the Avatar's assembled system prompt before the LLM call. This is transparent to API consumers — the envelope shape is unchanged.

---

## 6. Get Conversation History

### Endpoint

```text
GET /v1/conversations/{conversationId}/history
```

### Response

```ts
type GetConversationHistoryResponse = {
  conversation: ConversationSummary
  messages: Message[]
}
```

---

# Scenario API

## 7. List Scenarios

### Endpoint

```text
GET /v1/scenarios
```

### Response

```ts id="9g19yq"
type ListScenariosResponse = {
  scenarios: ScenarioSummary[]
}
```

### Behavior

- Returns `200 OK` with `scenarios: []` when no scenarios exist.
- Ordering is deterministic: `createdAt DESC` (newest first).
- Each scenario includes its persisted `config` object.

---

## 8. Create Scenario

### Endpoint

```text
POST /v1/scenarios
```

### Request

```ts id="re7n8a"
type CreateScenarioRequest = {
  name: string
  status?: 'draft' | 'active' | 'archived'
  config?: Record<string, unknown>
}
```

### Response

```ts id="wab0ne"
type CreateScenarioResponse = {
  scenario: ScenarioSummary
}
```

### Sprint 2 implementation notes

- `POST /v1/scenarios` returns `201 Created` on success.
- `status` defaults to `draft` when omitted.

---

## 9. Get Scenario

### Endpoint

```text
GET /v1/scenarios/{scenarioId}
```

### Response

```ts id="bjlwm4"
type GetScenarioResponse = {
  scenario: ScenarioSummary
}
```

---

## 9.5. Create Avatar for Scenario

### Endpoint

```text
POST /v1/scenarios/{scenarioId}/avatars
```

### Request

```ts
type CreateAvatarRequest = {
  name: string
  personaPrompt: string
  tone?: string
  description?: string
  adjustments?: string[]
  config?: Record<string, unknown>
  status?: 'draft' | 'active' | 'archived'
}
```

### Response

```ts
type CreateAvatarResponse = {
  avatar: AvatarSummary
}
```

### Error Mapping

- `401` → `UNAUTHORIZED` (missing/invalid API key)
- `400` → `VALIDATION_ERROR` (schema or domain validation failure)
- `404` → `NOT_FOUND` (scenario not found)
- `500` → `INTERNAL_ERROR` (unexpected failure)

---

## 9.6. List Avatars for Scenario

### Endpoint

```text
GET /v1/scenarios/{scenarioId}/avatars
```

### Response

```ts
type ListScenarioAvatarsResponse = {
  avatars: AvatarSummary[]
}
```

### Behavior

- Returns `404 NOT_FOUND` when the scenario does not exist.
- Returns `200 OK` with `avatars: []` when the scenario exists but has no avatars.
- Ordering is deterministic: `createdAt DESC` (newest first).
- Each avatar includes its persisted `config` object.

---

## 9.7. Delete Avatar

### Endpoint

```text
DELETE /v1/avatars/{avatarId}
```

### Response

```ts
type DeleteAvatarResponse = {
  avatarId: string
  deleted: true
}
```

### Error Mapping

- `404` → `NOT_FOUND` (avatar not found)
- `409` → `CONFLICT` (avatar deletion blocked by active sessions in its scenario)

---

## 9.7b. Update Avatar

### Endpoint

```text
PATCH /v1/avatars/{avatarId}
```

### Request

Partial update — only fields present in the request body are written. Fields absent from the body are left unchanged. `scenarioId` is immutable and is not accepted.

```ts
type PatchAvatarRequest = {
  name?: string
  personaPrompt?: string
  tone?: string
  description?: string
  adjustments?: string[]
  config?: Record<string, unknown>
  status?: 'draft' | 'active' | 'archived'
}
```

At least one field must be present in the body; an empty `{}` body is rejected.

### Response

```ts
type PatchAvatarResponse = {
  avatar: AvatarSummary
}
```

`updatedAt` is always refreshed when the update succeeds.

### Error Mapping

- `400` → `VALIDATION_ERROR` (empty body — no fields provided)
- `404` → `NOT_FOUND` (avatar not found)

---

## 9.8. Delete Scenario

### Endpoint

```text
DELETE /v1/scenarios/{scenarioId}
```

### Response

```ts
type DeleteScenarioResponse = {
  scenarioId: string
  deleted: true
}
```

### Deletion Rule (Phase A)

- Scenario deletion is **rejected** with `409 CONFLICT` if the scenario still has **any avatars** or **any sessions**.
- No force-delete semantics are supported in this slice.

### Error Mapping

- `404` → `NOT_FOUND` (scenario not found)
- `409` → `CONFLICT` (dependent avatars or sessions exist)

---

## 10. Update Scenario

### Endpoint

```text
PATCH /v1/scenarios/{scenarioId}
```

### Request

Partial update — only fields present in the request body are written. Fields absent from the body are left unchanged.

```ts id="pvwq0y"
type UpdateScenarioRequest = {
  name?: string
  status?: 'draft' | 'active' | 'archived'
  config?: Record<string, unknown>
}
```

At least one field must be provided. An empty body `{}` returns `400 VALIDATION_ERROR`.

### Response

```ts id="rfsx9e"
type UpdateScenarioResponse = {
  scenario: ScenarioSummary
}
```

### Notes

- `updatedAt` is always refreshed on a successful update.
- `config` is fully replaced when provided — it is not deep-merged.
- `PATCH` with an unknown `scenarioId` returns `404 NOT_FOUND`.

### Error Mapping

- `400` → `VALIDATION_ERROR` (empty body — no updatable fields provided)
- `404` → `NOT_FOUND` (scenario not found)

---

# Knowledge API

## 11. Register Knowledge Source

Register a document, URL, text block, or media metadata for a scenario.

### Endpoint

```text
POST /v1/knowledge-sources
```

### Request

```ts id="9eszkj"
type RegisterKnowledgeSourceRequest = {
  scenarioId: string
  name: string
  type: 'pdf' | 'text' | 'markdown' | 'url' | 'media'
  uriOrPath: string
  metadata?: Record<string, unknown>
}
```

### Response

```ts id="f8kpph"
type RegisterKnowledgeSourceResponse = {
  source: KnowledgeSourceSummary
}
```

### Notes

This endpoint registers the source.

Ingestion may happen asynchronously.

---

## 12. List Scenario Knowledge Sources

### Endpoint

```text
GET /v1/scenarios/{scenarioId}/knowledge-sources
```

### Response

```ts id="namarv"
type ListScenarioKnowledgeSourcesResponse = {
  sources: KnowledgeSourceSummary[]
}
```

---

## 13. Trigger Knowledge Ingestion

### Endpoint

```text
POST /v1/knowledge-sources/{sourceId}/ingest
```

### Request

```ts id="v1su4c"
type TriggerKnowledgeIngestionRequest = {
  options?: {
    force?: boolean
  }
}
```

### Response

```ts id="n92ozv"
type TriggerKnowledgeIngestionResponse = {
  sourceId: string
  status: 'pending' | 'ready' | 'error'
}
```

---

# User Memory API

## 14. List User Memory Facts

### Endpoint

```text
GET /v1/users/{userId}/memory-facts
```

### Response

```ts id="f5ry8e"
type ListUserMemoryFactsResponse = {
  facts: Array<{
    id: string
    userId: string
    category: string
    key: string
    value: string
    confidence?: number | null
    updatedAt: string
  }>
}
```

---

## 15. Delete One User Memory Fact

### Endpoint

```text
DELETE /v1/users/{userId}/memory-facts/{factId}
```

### Response

```ts id="gajtsb"
type DeleteUserMemoryFactResponse = {
  factId: string
  deleted: true
}
```

---

# Observability / Admin API

## 16. Get Session Events

Deprecated draft section. The implemented Phase A endpoint is `GET /v1/admin/sessions/{sessionId}/events`; see Admin / Operations API A6 for the authoritative contract.

---

## 17. Get Basic Metrics

### Endpoint

```text
GET /v1/metrics/summary
```

### Response

```ts id="n75j3b"
type GetMetricsSummaryResponse = {
  totals: {
    sessions: number
    messages: number
    totalTokens?: number
    totalCostUsd?: number
  }
  latency: {
    p50Ms?: number
    p95Ms?: number
    p99Ms?: number
  }
  errors: {
    total: number
    byCode: Record<string, number>
  }
}
```

### Notes

This is intentionally simple.

Detailed observability remains in the logging system.

---

# Admin / Operations API

All admin endpoints live under `/v1/admin/`.

**Access:** same `x-api-key` header as the public API. In Phase B+, admin routes may require additional guards (IP allowlist, admin role).

**Principle:** these endpoints are not for end-user clients. They exist for the back-office, operators, and internal tooling. They may expose internal state that should never surface in public API responses.

---

## A1. Platform Health (rich)

### Endpoint

```text
GET /v1/admin/health
```

### Response

```ts
type AdminHealthResponse = {
  status: 'ok' | 'degraded' | 'error'
  version: string
  timestamp: string
}
```

Same as `/health` but auth-protected. Useful for monitoring systems that use the same API key.

---

## A2. Dependency Health

### Endpoint

```text
GET /v1/admin/dependencies
```

### Response

```ts
type DependenciesResponse = {
  dependencies: Array<{
    name: 'postgres' | 'redis' | 'llm_provider'
    status: 'ok' | 'degraded' | 'error'
    latencyMs?: number
    detail?: string
  }>
}
```

### Notes

- Postgres: send a simple ping query
- Redis: send `PING`
- LLM provider: optional lightweight probe (can be skipped if too costly)

---

## A3. List Sessions

### Endpoint

```text
GET /v1/admin/sessions
```

### Query Parameters

- `status` (optional): `active` | `closed` | `archived`
- `scenarioId` (optional)
- `limit` (optional, default 50, max 200)
- `offset` (optional, default 0)

### Response

```ts
type AdminListSessionsResponse = {
  sessions: SessionSummary[]
  total: number
}
```

---

## A4. Admin: Inspect Session

Implemented Phase A endpoint for GM Debug Panel state inspection.

### Endpoint

```text
GET /v1/admin/sessions/{sessionId}/inspect
```

### Response

```ts
type InspectSessionResponse = {
  inspect: {
    session: SessionSummary
    gmState: {
      currentAvatarId?: string
      progression: string
      topicsCovered: string[]
      interactionCount: number
    } | null
    transitionHistory: Array<{
      fromAvatarId: string | null
      toAvatarId: string
      reason: string | null
      startedBy: 'user' | 'gm' | 'system' | null
      transitionedAt: string
    }>
    unlockedAvatarIds: string[]
    gmNotes: string | null
  }
}
```

### Semantics

- `gmState` is `null` until the Game Master has run for the session.
- `transitionHistory` is derived from the session's conversation sequence and returned newest-first.
- Raw message content, prompt text, credentials, and LLM model names are never included.
- `gmNotes` is safe to surface because it is director guidance, not raw user input.

### Error Mapping

- `401` → `UNAUTHORIZED`
- `404` → `NOT_FOUND` (session missing)
- `500` → `INTERNAL_ERROR`

---

## A5. Get Session Memory

### Endpoint

```text
GET /v1/admin/sessions/{sessionId}/memory
```

### Response

```ts
type AdminSessionMemoryResponse = {
  session: SessionMemorySummary
  avatarMemories: Array<{
    avatarId: string
    summary: string
    updatedAt: string
  }>
  userFacts: Array<{
    id: string
    category: string
    key: string
    value: string
    confidence?: number | null
    updatedAt: string
  }>
}
```

---

## A6. Admin: List Session Events

### Endpoint

```text
GET /v1/admin/sessions/{sessionId}/events
```

### Query Parameters

| Parameter | Type    | Default | Max | Description                    |
| --------- | ------- | ------- | --- | ------------------------------ |
| `limit`   | integer | `50`    | 200 | Max number of events to return |

### Response

```ts
type AdminSessionEventsResponse = {
  events: Array<{
    type: 'gm_triggered' | 'gm_error'
    correlationId: string
    createdAt: string
    payload: {
      triggerReason: string | null
      turnIndex: number
      interactionCount: number
      stateBefore: {
        currentAvatarId?: string
        progression: string
        topicsCovered: string[]
      }
      decision?: {
        avatarId: string
        conversationMode: 'new' | 'continue'
        notesInjected: boolean
        directiveCount: number
        unlockedAvatarIds?: string[]
        suggestedAvatarId?: string
        suggestedAvatarReason?: string
        switchedAvatarId?: string
      }
      stateAfter?: {
        currentAvatarId?: string
        progression: string
        topicsCovered: string[]
      }
      latencyMs: number
      inputTokens?: number
      outputTokens?: number
      errorCode?: string
    }
  }>
}
```

### Semantics

- Returns only `gm_triggered` and `gm_error` diagnostic events.
- Results are ordered newest-first.
- Non-GM event types are silently excluded.
- Raw user message content, prompt text, credentials, and LLM model names are never included.

### Error Mapping

- `401` → `UNAUTHORIZED`
- `400` → `VALIDATION_ERROR` (invalid `limit`)
- `404` → `NOT_FOUND` (session missing)
- `500` → `INTERNAL_ERROR`

---

## A7. Reset Session

Deletes runtime conversation data. Does NOT delete the session record itself.

### Endpoint

```text
POST /v1/admin/sessions/{sessionId}/reset
```

### Response

```ts
type AdminResetSessionResponse = {
  sessionId: string
  deleted: {
    messages: number
    sessionMemory: boolean
    avatarMemories: number
    events: number
  }
}
```

### Notes

- This action is logged in `AdminActionLog`
- Audit entry includes actor, target session ID, and timestamp

---

## A8. Replay Last Turn

Re-runs the Avatar call for the last user message without re-storing the user message. Useful for debugging quality issues on a specific turn.

### Endpoint

```text
POST /v1/admin/sessions/{sessionId}/replay-last-turn
```

### Response

```ts
type AdminReplayTurnResponse = {
  sessionId: string
  replayedMessage: {
    content: string
    model?: string
    latencyMs?: number
    inputTokens?: number
    outputTokens?: number
  }
}
```

### Notes

- The replayed response is **not** stored
- This action is logged in `AdminActionLog`

---

## A9. List Ingestion Jobs

### Endpoint

```text
GET /v1/admin/jobs
```

### Query Parameters

- `status` (optional): `pending` | `running` | `completed` | `failed`
- `sourceId` (optional)
- `limit` (optional, default 50)

### Response

```ts
type AdminListJobsResponse = {
  jobs: Array<{
    id: string
    sourceId: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    attempts: number
    startedAt?: string
    completedAt?: string
    errorMessage?: string
    createdAt: string
  }>
  total: number
}
```

---

## A10. Retry Ingestion Job

### Endpoint

```text
POST /v1/admin/jobs/{jobId}/retry
```

### Response

```ts
type AdminRetryJobResponse = {
  jobId: string
  status: 'pending' | 'running'
}
```

### Notes

- Idempotent: if the job is already pending/running, returns current status without creating a duplicate
- This action is logged in `AdminActionLog`

---

## A11. Metrics Overview

### Endpoint

```text
GET /v1/admin/metrics/overview
```

### Query Parameters

- `since` (optional): ISO 8601 datetime, defaults to last 24h

### Response

```ts
type AdminMetricsOverviewResponse = {
  period: {
    from: string
    to: string
  }
  sessions: {
    total: number
    active: number
  }
  messages: {
    total: number
  }
  tokens: {
    input?: number
    output?: number
    total?: number
    estimatedCostUsd?: number
  }
  latency: {
    p50Ms?: number
    p95Ms?: number
  }
  errors: {
    total: number
    byCode: Record<string, number>
  }
}
```

---

## A12. Recent Errors

### Endpoint

```text
GET /v1/admin/errors
```

### Query Parameters

- `limit` (optional, default 50)

### Response

```ts
type AdminErrorsResponse = {
  errors: Array<{
    id: string
    type: string
    sessionId?: string
    requestId?: string
    createdAt: string
    payload?: Record<string, unknown>
  }>
}
```

---

## A13. Audit Log

### Endpoint

```text
GET /v1/admin/audit-log
```

### Query Parameters

- `targetType` (optional): `session` | `job` | `scenario` | `source`
- `targetId` (optional)
- `limit` (optional, default 50)
- `offset` (optional, default 0)

### Response

```ts
type AdminAuditLogResponse = {
  entries: Array<{
    id: string
    actor: string
    actionType: string
    targetType: string
    targetId: string
    payload?: Record<string, unknown>
    createdAt: string
  }>
  total: number
}
```

---

# Game Master / Internal Runtime Shapes

These are not necessarily public endpoints, but they define stable internal contract shapes that influence API payloads.

## Game Master State

```ts id="9xjlwm"
type GameMasterState = {
  currentAvatarId?: string
  progression: string
  topicsCovered: string[]
  interactionCount: number
  transitionHistory?: Array<{
    fromAvatarId?: string
    toAvatarId: string
    reason?: string
    atTurn: number
  }>
}
```

## Game Master Output

```ts id="vvjlyw"
type GameMasterOutput = {
  avatarId: string
  nextAvatarId?: string
  transitionReason?: string
  recommendedChoices?: Array<{
    id: string
    label: string
  }>
  contentTrigger?: string
  unlockAvatarIds?: string[]
  suggestedAvatarId?: string
  suggestedAvatarReason?: string
  conversationMode: 'new' | 'continue'
  context?: {
    notes?: string
  }
  stateUpdate: {
    progression?: 'none' | 'increase'
    topicCovered?: string
    activeAvatarId?: string
    interactionIncrement: 1
  }
}
```

These shapes should stay aligned with `GAME_MASTER_CONTRACT.md`.

---

# HTTP Status Rules

## Success

- `200 OK` for reads and successful actions
- `201 Created` for creates
- `202 Accepted` for async jobs accepted
- `204 No Content` only when no response body is useful

## Errors

- `400 Bad Request` → invalid input
- `401 Unauthorized` → missing/invalid API key
- `403 Forbidden` → known but not allowed
- `404 Not Found` → missing entity
- `409 Conflict` → invalid state transition or conflicting state
- `429 Too Many Requests` → throttling
- `500 Internal Server Error` → unexpected failure
- `502/503/504` → upstream / provider issues where relevant

---

# Validation Rules

## Minimal Input Validation

### Message content

- required
- non-empty after trimming
- maximum size configurable

### Source registration

- `scenarioId` required
- `type` required
- `uriOrPath` required

---

# Non-Goals for v1

Do not include yet:

- multi-avatar active orchestration endpoints
- voice upload endpoints
- media trigger APIs for frontend playback
- tenant management
- user auth flows beyond API key
- prompt management endpoints
- benchmark control endpoints
- fine-grained GM manual controls

These can be added later without breaking the basic surface.

---

# Evolution Rules

When extending the API:

1. Prefer additive changes
2. Do not break existing field meanings
3. Keep core payloads stable
4. Introduce new endpoints rather than overloading old ones
5. Keep public contracts thinner than internal implementation details

---

# Minimal MVP Endpoint Set

If we need the absolute minimum set to start implementation, it is:

- `POST /v1/sessions`
- `GET /v1/sessions/{sessionId}`
- `POST /v1/sessions/{sessionId}/conversations`
- `POST /v1/sessions/{sessionId}/switch-avatar`
- `GET /v1/sessions/{sessionId}/available-avatars`
- `GET /v1/sessions/{sessionId}/avatar-transitions`
- `GET /v1/sessions/{sessionId}/conversations`
- `POST /v1/conversations/{conversationId}/messages`
- `GET /v1/conversations/{conversationId}/history`
- `GET /v1/scenarios`
- `POST /v1/scenarios`
- `POST /v1/scenarios/{scenarioId}/avatars`
- `GET /v1/scenarios/{scenarioId}/avatars`
- `DELETE /v1/avatars/{avatarId}`
- `DELETE /v1/scenarios/{scenarioId}`
- `PUT /v1/scenarios/{scenarioId}`
- `PATCH /v1/scenarios/{scenarioId}`
- `POST /v1/knowledge-sources`
- `POST /v1/knowledge-sources/{sourceId}/ingest`

Everything else is useful, but not required to begin.

---

# Final Rule

If an endpoint exists before there is a concrete Phase A use case for it, it probably should not exist yet.

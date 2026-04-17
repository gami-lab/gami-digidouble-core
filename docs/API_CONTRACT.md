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
  slug: string
  status: 'draft' | 'active' | 'archived'
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
  status: 'active' | 'closed' | 'archived'
  startedAt: string
  lastActivityAt: string
  endedAt?: string | null
}
```

## Message

```ts id="1esb1v"
type Message = {
  messageId: string
  sessionId: string
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

# Conversation API

## 0. Raw Exchange (EPIC 1.2)

Minimal non-session endpoint used to validate the first HTTP → use case → LLM loop.

### Endpoint

```text
POST /v1/exchange
```

### Auth

```text
x-api-key: <API_KEY>
```

### Request

```ts
type ExchangeRequest = {
  message: string
  systemPrompt?: string
}
```

Validation rules:

- `message`: required, string, min length 1, max length 4000
- `systemPrompt`: optional, string, max length 2000

### Success Response (200)

```ts
ApiResponse<{
  requestId: string
  reply: string
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
}>
```

### Error Mapping

- `401` → `UNAUTHORIZED` (missing/invalid API key)
- `400` → `VALIDATION_ERROR` (invalid request body)
- `502` → `EXTERNAL_SERVICE_ERROR` (LLM/provider failure)
- `500` → `INTERNAL_ERROR` (unexpected server error)

### Observability Side Effects

Each successful call emits an internal `llm.completion` trace event carrying:

- `requestId`
- `latencyMs`
- `inputTokens`
- `outputTokens`
- `metadata.model`

## 1. Start Session

Create a new conversation session.

### Endpoint

```text
POST /v1/conversations/start
```

### Request

```ts id="za0q2v"
type StartSessionRequest = {
  user: {
    userId?: string
    externalId?: string
    email?: string
    metadata?: Record<string, unknown>
  }
  scenarioId: string
  initialContext?: {
    notes?: string
    userFacts?: Array<{
      category: string
      key: string
      value: string
    }>
  }
}
```

### Response

```ts id="jy22i6"
type StartSessionResponse = {
  session: SessionSummary
  gameMaster?: {
    mode: 'init'
    avatarId?: string
    notes?: string
    directives?: string[]
  }
}
```

### Notes

- If the user does not already exist, the system may create a minimal user.
- Session start may synchronously initialize minimal Game Master state.

---

## 2. Send Message

Send one user message and receive one avatar response.

### Endpoint

```text
POST /v1/conversations/{sessionId}/messages
```

### Request

```ts id="uw9g8l"
type SendMessageRequest = {
  message: {
    content: string
  }
  options?: {
    stream?: boolean
    debug?: boolean
  }
}
```

### Non-Streaming Response

```ts id="d0b3wa"
type SendMessageResponse = {
  session: SessionSummary
  userMessage: Message
  avatarMessage: Message
  memory?: SessionMemorySummary
  debug?: {
    requestId?: string
    model?: string
    latencyMs?: number
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    costUsd?: number
    gmTriggered?: boolean
  }
}
```

### Behavior

- Stores user message
- Builds runtime context
- Runs Avatar response generation
- Stores avatar response
- Launches async post-processing when relevant:
  - Game Master observation
  - memory update
  - event logging

---

## 3. Stream Message Response (SSE)

Streaming version for Phase A compatibility.

### Endpoint

```text
POST /v1/conversations/{sessionId}/messages/stream
```

### Request

Same as `SendMessageRequest`.

### Response Stream Events

```ts id="wlkb96"
type StreamEvent =
  | {
      type: 'message_started'
      sessionId: string
      requestId?: string
    }
  | {
      type: 'token'
      content: string
    }
  | {
      type: 'message_completed'
      avatarMessage: Message
      debug?: {
        model?: string
        latencyMs?: number
        inputTokens?: number
        outputTokens?: number
        totalTokens?: number
        costUsd?: number
        gmTriggered?: boolean
      }
    }
  | {
      type: 'error'
      error: {
        code: string
        message: string
      }
    }
```

### Notes

- SSE is the simplest first contract.
- WebSocket can be added later without changing core payload shapes.

---

## 4. Get Conversation History

Return all stored messages for a session.

### Endpoint

```text
GET /v1/conversations/{sessionId}/history
```

### Response

```ts id="22th8c"
type GetHistoryResponse = {
  session: SessionSummary
  messages: Message[]
  memory?: SessionMemorySummary
}
```

---

## 5. Get Session State

Debug-oriented endpoint for back-office and development.

### Endpoint

```text
GET /v1/conversations/{sessionId}/state
```

### Response

```ts id="c1hh90"
type GetSessionStateResponse = {
  session: SessionSummary
  memory?: SessionMemorySummary
  gameMasterState?: {
    currentAvatarId?: string
    progression: string
    topicsCovered: string[]
    interactionCount: number
  }
  lastEvents?: Array<{
    type: string
    createdAt: string
    payload?: Record<string, unknown>
  }>
}
```

### Notes

- This endpoint is not for end-user UI.
- It exists for back-office, testing, and debugging.

---

## 6. Reset Session

Delete conversation runtime data for one session.

### Endpoint

```text
DELETE /v1/conversations/{sessionId}
```

### Response

```ts id="6kkvkt"
type ResetSessionResponse = {
  sessionId: string
  deleted: {
    messages: number
    sessionMemory: boolean
    events: number
  }
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
  slug: string
  status?: 'draft' | 'active' | 'archived'
  config: {
    avatar?: {
      name?: string
      personaPrompt?: string
      style?: {
        tone?: string
        verbosity?: 'low' | 'medium' | 'high'
      }
    }
    world?: {
      description?: string
      objectives?: string[]
      constraints?: string[]
    }
    features?: {
      knowledgeEnabled?: boolean
      gameMasterEnabled?: boolean
      streamingEnabled?: boolean
    }
    sourceIds?: string[]
  }
}
```

### Response

```ts id="wab0ne"
type CreateScenarioResponse = {
  scenario: ScenarioSummary & {
    config: Record<string, unknown>
  }
}
```

---

## 9. Get Scenario

### Endpoint

```text
GET /v1/scenarios/{scenarioId}
```

### Response

```ts id="bjlwm4"
type GetScenarioResponse = {
  scenario: ScenarioSummary & {
    config: Record<string, unknown>
  }
}
```

---

## 10. Update Scenario

### Endpoint

```text
PUT /v1/scenarios/{scenarioId}
```

### Request

Same shape as create, but partial updates allowed.

```ts id="pvwq0y"
type UpdateScenarioRequest = Partial<CreateScenarioRequest>
```

### Response

```ts id="rfsx9e"
type UpdateScenarioResponse = {
  scenario: ScenarioSummary & {
    config: Record<string, unknown>
  }
}
```

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

### Endpoint

```text
GET /v1/conversations/{sessionId}/events
```

### Response

```ts id="ovq9az"
type GetSessionEventsResponse = {
  events: Array<{
    id: string
    type: string
    createdAt: string
    payload?: Record<string, unknown>
  }>
}
```

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

# Game Master / Internal Runtime Shapes

These are not necessarily public endpoints, but they define stable internal contract shapes that influence API payloads.

## Game Master State

```ts id="9xjlwm"
type GameMasterState = {
  currentAvatarId?: string
  progression: string
  topicsCovered: string[]
  interactionCount: number
}
```

## Game Master Output

```ts id="vvjlyw"
type GameMasterOutput = {
  avatarId?: string
  mode: 'init' | 'background_trigger'
  trigger?: 'time_elapsed' | 'topic_covered' | 'stalled_progression' | 'state_change' | 'manual'
  context?: {
    notes?: string
    directives?: string[]
  }
  stateUpdate: {
    progression?: 'none' | 'increase'
    topicCovered?: string
    interactionIncrement?: 1
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
- `409 Conflict` → duplicate slug, invalid state transition
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

### Scenario slug

- unique
- lowercase kebab-case preferred

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

- `POST /v1/conversations/start`
- `POST /v1/conversations/{sessionId}/messages`
- `POST /v1/conversations/{sessionId}/messages/stream`
- `GET /v1/conversations/{sessionId}/history`
- `DELETE /v1/conversations/{sessionId}`
- `GET /v1/scenarios`
- `POST /v1/scenarios`
- `PUT /v1/scenarios/{scenarioId}`
- `POST /v1/knowledge-sources`
- `POST /v1/knowledge-sources/{sourceId}/ingest`

Everything else is useful, but not required to begin.

---

# Final Rule

If an endpoint exists before there is a concrete Phase A use case for it, it probably should not exist yet.

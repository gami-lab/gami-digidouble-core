# API_CONTRACT.md

# Purpose

Define the public HTTP API contract for Gami DigiDouble Core Phase A.

This document defines:

- public endpoints
- admin endpoints
- DTO contracts
- validation rules
- response/error formats

Architecture semantics are defined in:

- `ARCHITECTURE.md`
- `GAME_MASTER_CONTRACT.md`
- `MEMORY_SYSTEM_SPEC.md`

---

# Design Principles

API-first, stable JSON contracts, headless core, additive evolution, bounded payloads, versioned endpoints (`/v1`). See `PRINCIPLES.md` for engineering philosophy.

---

# Base Rules

## Base URL

```text
/v1
```

## Content Types

```text
application/json
text/event-stream
```

## Authentication

```text
x-api-key: <API_KEY>
```

## Conventions

- timestamps are ISO-8601 UTC
- IDs are opaque strings
- all non-streaming responses use `ApiResponse<T>`

---

# Common Contracts

## ApiResponse

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
```

## ErrorCode

```ts
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

---

# Core DTOs

## UserPersona

```ts
type UserPersona = {
  name?: string
  roleInWorld?: string
  avatarRelationships?: string[]
  dialogGuidance?: string
}
```

## ScenarioSummary

```ts
type ScenarioSummary = {
  scenarioId: string
  name: string
  status: 'draft' | 'active' | 'archived'
  objectives: string[]
  worldContext: string
  avatarAvailability: {
    initialAvatarIds: string[]
    unlockableAvatarIds?: string[]
  }
  modelSelection?: {
    defaultProfile?: {
      provider: 'openai' | 'anthropic' | 'mistral' | 'xai'
      model: string
    }
    gameMasterOverride?: {
      provider: 'openai' | 'anthropic' | 'mistral' | 'xai'
      model: string
    }
  }
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}
```

## AvatarSummary

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
  llmOverride?: {
    provider?: 'openai' | 'anthropic' | 'mistral' | 'xai'
    model?: string
  }
  computedTraits: AvatarComputedTraits | null
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}
```

## AvatarComputedTraits

Fixed, derived trait structure computed from an avatar's source material (author input,
memory documents, world context). See EPIC 8.1. Field names are stable — they are reused by
the trait generation prompt and by Avatar Prompt Assembly (EPIC 8.2). `null` on
`AvatarSummary.computedTraits` means preparation has not run yet.

Runtime compatibility note:

- `computedTraits: null` is a supported compatibility state for avatars created before or outside the preparation flow
- runtime prompt assembly must fall back to the existing authored `personaPrompt` when `computedTraits` is `null`; clients must not treat `null` as an invalid avatar configuration

```ts
type AvatarComputedTraits = {
  identity: string[]
  personality: string[]
  speakingStyle: string[]
  background: string[]
  timeline: string[]
  currentSituation: string[]
  behaviouralRules: string[]
}
```

Persistence and write path:

- stored in a dedicated `avatars.computed_traits JSONB` column, never inside `config`
- written only through a narrow repository method (`IAvatarRepository.saveComputedTraits`),
  never through the generic avatar create/update path
- does not replace or modify the source `personaPrompt` / `description` / `tone` /
  `adjustments` fields it is derived from

## SessionSummary

```ts
type SessionSummary = {
  sessionId: string
  userId: string
  scenarioId: string
  activeAvatarId?: string
  unlockedAvatarIds?: string[]
  status: 'active' | 'closed' | 'archived'
  startedAt: string
  lastActivityAt: string
  endedAt?: string
}
```

## ConversationSummary

```ts
type ConversationSummary = {
  conversationId: string
  sessionId: string
  avatarId: string
  status: 'active' | 'closed' | 'archived'
  startedAt: string
  lastActivityAt: string
  endedAt?: string
}
```

## Message

```ts
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
  }
}
```

## RuntimeState

```ts
type RuntimeState = {
  sessionId: string
  conversationId?: string
  canSendMessage: boolean
  isProcessing: boolean
  updatedAt: string
}
```

---

# Public API

---

# Sessions

## Create Session

```text
POST /v1/sessions
```

```ts
type CreateSessionRequest = {
  userId: string
  scenarioId: string
}
```

```ts
type CreateSessionResponse = {
  session: SessionSummary
}
```

---

## Get Session

```text
GET /v1/sessions/{sessionId}
```

---

## List Sessions

```text
GET /v1/sessions
```

Query params:

- `scenarioId`
- `userId`
- `status`

---

## Reset Session

```text
POST /v1/sessions/{sessionId}/reset
```

Resets runtime state while preserving session identity.

---

# Conversations

## Start Conversation

```text
POST /v1/sessions/{sessionId}/conversations
```

```ts
type StartConversationRequest = {
  avatarId: string
}
```

---

## Switch Avatar

```text
POST /v1/sessions/{sessionId}/switch-avatar
```

```ts
type SwitchAvatarRequest = {
  avatarId: string
  reason?: string
}
```

---

## End Conversation

```text
POST /v1/sessions/{sessionId}/conversations/{conversationId}/end
```

```ts
type EndConversationRequest = {
  reason?: 'user_end' | 'operator_end' | 'scenario_complete' | 'safety_stop'
}
```

---

## Send Message

```text
POST /v1/conversations/{conversationId}/messages
```

```ts
type SendMessageRequest = {
  message: {
    content: string
  }
}
```

```ts
type SendMessageResponse = {
  conversation: ConversationSummary
  session: SessionSummary
  userMessage: Message
  avatarMessage: Message
}
```

---

## Conversation History

```text
GET /v1/conversations/{conversationId}/history
```

---

# Runtime

## Runtime State

```text
GET /v1/sessions/{sessionId}/runtime-state
```

---

## Runtime Events (SSE)

```text
GET /v1/sessions/{sessionId}/events/stream
```

Content-Type:

```text
text/event-stream
```

---

# Scenarios

## List Scenarios

```text
GET /v1/scenarios
```

---

## Create Scenario

```text
POST /v1/scenarios
```

```ts
type CreateScenarioRequest = {
  name: string
  status?: 'draft' | 'active' | 'archived'
  objectives?: string[]
  worldContext?: string
  avatarAvailability?: ScenarioAvatarAvailability
  modelSelection?: {
    defaultProfile?: {
      provider: 'openai' | 'anthropic' | 'mistral' | 'xai'
      model: string
    }
    gameMasterOverride?: {
      provider: 'openai' | 'anthropic' | 'mistral' | 'xai'
      model: string
    }
  }
  config?: Record<string, unknown>
}
```

Validation:

- if `modelSelection` is provided, it must define `defaultProfile` or `gameMasterOverride`
- each provided profile must use an allowed `provider/model` pair from the canonical model catalog

Response: `ApiResponse<{ scenario: ScenarioSummary }>`

---

## Get Scenario

```text
GET /v1/scenarios/{scenarioId}
```

Response: `ApiResponse<{ scenario: ScenarioSummary }>`

---

## Update Scenario

```text
PATCH /v1/scenarios/{scenarioId}
```

```ts
type UpdateScenarioRequest = Partial<
  Pick<
    ScenarioSummary,
    | 'name'
    | 'status'
    | 'objectives'
    | 'worldContext'
    | 'avatarAvailability'
    | 'modelSelection'
    | 'config'
  >
>
```

Response: `ApiResponse<{ scenario: ScenarioSummary }>`

At least one field is required (enforced by the use case, not the request schema).

`modelSelection: null` clears stored scenario-scoped model selection.

---

## Delete Scenario

```text
DELETE /v1/scenarios/{scenarioId}
```

---

# Avatars

## Create Avatar

```text
POST /v1/scenarios/{scenarioId}/avatars
```

```ts
type CreateAvatarRequest = {
  name: string
  personaPrompt: string
  tone?: string
  description?: string
  adjustments?: string[]
  llmOverride?: {
    provider?: 'openai' | 'anthropic' | 'mistral' | 'xai'
    model?: string
  } | null
  config?: Record<string, unknown>
  status?: 'draft' | 'active' | 'archived'
}
```

Validation:

- if `llmOverride` is provided as an object, both `llmOverride.provider` and `llmOverride.model` are required
- `llmOverride.provider` must be one of `openai | anthropic | mistral | xai`
- `llmOverride.model` must be a non-empty allowed catalog model for the selected provider
- sending `llmOverride: null` clears the stored override

---

## List Scenario Avatars

```text
GET /v1/scenarios/{scenarioId}/avatars
```

---

## Update Avatar

```text
PATCH /v1/avatars/{avatarId}
```

```ts
type UpdateAvatarRequest = {
  name?: string
  personaPrompt?: string
  tone?: string
  description?: string
  adjustments?: string[]
  llmOverride?: {
    provider?: 'openai' | 'anthropic' | 'mistral' | 'xai'
    model?: string
  } | null
  config?: Record<string, unknown>
  status?: 'draft' | 'active' | 'archived'
}
```

---

## Delete Avatar

```text
DELETE /v1/avatars/{avatarId}
```

---

## Prepare Scenario Avatar Traits (EPIC 8.1)

```text
POST /v1/scenarios/{scenarioId}/prepare-avatar-traits
```

Explicit, scenario-scoped, synchronous action that (re)computes `AvatarComputedTraits`
for every avatar in the scenario and persists the result via the existing narrow
`saveComputedTraits` write path. This is an explicit preparation step, not runtime
prompt assembly — it must never be triggered implicitly from a `GET` route, and it
is rerunnable at any time (each run overwrites `computedTraits` with a fresh result;
author-authored avatar fields are never touched).

No request body — the route rejects any parsed JSON body value with
`400 VALIDATION_ERROR` (object, array, string, number, boolean, or `null`);
sending no body at all is the expected call shape.

Response: `ApiResponse<PrepareAvatarTraitsResponse>`

```ts
type PrepareAvatarTraitsResponse = {
  scenarioId: string
  results: AvatarTraitPreparationResult[]
}

type AvatarTraitPreparationResult =
  | { avatarId: string; status: 'prepared'; computedTraits: AvatarComputedTraits }
  | {
      avatarId: string
      status: 'failed'
      reason: 'unparseable_output' | 'llm_error' | 'persistence_error' | 'unknown_error'
    }
```

Behavior:

- `404 NOT_FOUND` when `scenarioId` does not exist
- one result per avatar in the scenario (empty `results` array for a scenario with no avatars)
- per-avatar failures (unparseable LLM output, provider error) are isolated as a `failed`
  entry and never fail the whole batch
- uses the same `'avatar'` model-role resolution path as live avatar responses
  (`avatar.llmOverride` -> `scenario.modelSelection` -> global config), so provider/model
  choice for preparation matches the avatar's normal runtime configuration
- source material is read only from existing canonical storage — avatar author fields,
  `scenario.worldContext`, and `knowledge_sources` rows (`memory`/`world` types, inline
  text only); no new storage or upload path is introduced by this endpoint

---

# Knowledge

## Register Knowledge Source

```text
POST /v1/knowledge-sources
```

Request body (`CreateKnowledgeSourceRequest`):

- `scenarioId: string`
- `name: string`
- `knowledgeType: KnowledgeType` — `'world' | 'memory' | 'media'`
- `format: KnowledgeSourceFormat`
- `uriOrPath: string`
- `visibilityPolicy?: KnowledgeVisibilityPolicy` — `'all' | 'avatars' | 'none'`; defaults to `'all'` when omitted
- `visibleToAvatarIds?: string[]` — only meaningful when `visibilityPolicy === 'avatars'`
- `metadata?: Record<string, unknown>` — set `metadata.inlineText` for inline text content

Visibility policy semantics:

- `'all'` — visible to all avatars (default; backward-compatible with pre-EPIC-6.1 records)
- `'avatars'` — visible only to avatars listed in `visibleToAvatarIds`
- `'none'` — GM-only; excluded from all avatar retrieval; still accessible via `bypassVisibilityFilter` (GM omniscience path)

Normalization rules:

- if `visibleToAvatarIds` is provided without `visibilityPolicy`, the server normalizes the source to `visibilityPolicy: 'avatars'`
- if `visibilityPolicy` is `'all'` or `'none'`, any provided `visibleToAvatarIds` are ignored and cleared
- if `visibilityPolicy` is `'avatars'`, `visibleToAvatarIds` must contain at least one avatar ID after trimming

---

## Upload Knowledge Source (Text / PDF)

```text
POST /v1/knowledge-sources/upload
```

Request body (`UploadKnowledgeSourceRequest`):

- `scenarioId: string`
- `name: string`
- `knowledgeType: KnowledgeType`
- `content: string` — base64-encoded file bytes
- `filename: string` — must end in `.pdf`, `.txt`, or `.text`; determines extraction path
- `visibilityPolicy?: KnowledgeVisibilityPolicy` — same semantics as Register above
- `visibleToAvatarIds?: string[]` — same normalization and validation rules as Register above

Notes:

- uploaded PDF/TXT bytes are parsed before dispatch to the knowledge-source use case; extracted text is stored as `metadata.inlineText`
- Max base64 payload: ~14 MB (~10 MB raw); 400 returned if exceeded or extension unsupported
- Returns the same `CreateKnowledgeSourceResponse` shape as POST /v1/knowledge-sources

---

## Update Knowledge Source

```text
PATCH /v1/knowledge-sources/{sourceId}
```

Patch body (`UpdateKnowledgeSourceRequest`):

- `name?: string`
- `metadata?: Record<string, unknown>` — set `metadata.inlineText` to replace inline text content directly
- `uriOrPath?: string`
- `content?: string` — base64-encoded replacement file bytes for an existing PDF/TXT-backed source
- `filename?: string` — replacement filename for `content`; must end in `.pdf`, `.txt`, or `.text`
- `visibilityPolicy?: KnowledgeVisibilityPolicy`
- `visibleToAvatarIds?: string[]`

`visibilityPolicy` is patchable. Updates are idempotent and safe for partial edits.

Patch normalization rules:

- updating only `visibleToAvatarIds` normalizes the source to `visibilityPolicy: 'avatars'`
- patching `visibilityPolicy: 'all'` or `'none'` clears any stored `visibleToAvatarIds`
- patching `visibilityPolicy: 'avatars'` without avatar IDs returns `400 VALIDATION_ERROR`
- `content` and `filename` must be provided together
- `content`/`filename` replacement cannot be combined with direct `metadata`/`uriOrPath` patch fields in the same request
- replacing inline text or a backing file resets source `status` to `pending` so ingestion can be rerun against the new content

---

## List Knowledge Sources

```text
GET /v1/scenarios/{scenarioId}/knowledge-sources
```

---

## Trigger Ingestion

```text
POST /v1/knowledge-sources/{sourceId}/ingest
```

---

## List Ingestion Jobs For Source

```text
GET /v1/knowledge-sources/{sourceId}/ingestion-jobs
```

---

## Get Ingestion Job

```text
GET /v1/ingestion-jobs/{ingestionJobId}
```

---

## Query Typed Retrieval (Admin/Debug)

```text
POST /v1/admin/knowledge/retrieval
```

Notes:

- admin/debug endpoint only (API-key protected in Phase A)
- response remains typed (`memory`/`world`/`media` + trace metadata)
- retrieved `content` is bounded/truncated for safe debug inspection payloads
- retrieval items may expose `visibleToAvatarIds` metadata for visibility observability
- optional `activeAvatarId` request field applies avatar-scoped visibility filtering before context assembly
- retrieval trace may include bounded visibility explainability counts (`consideredChunkCount`, `excludedChunkCount`) per type
- GM/runtime context diagnostics may include bounded `gmRetrievalCounts` with `gmUnrestricted=true` to show omniscient retrieval scope without exposing raw hidden content

---

# User Persona

## Upsert Persona

```text
PUT /v1/users/{userId}/persona
```

---

## Get Persona

```text
GET /v1/users/{userId}/persona
```

---

# User Memory Facts

## List Facts

```text
GET /v1/users/{userId}/memory-facts
```

---

## Delete Fact

```text
DELETE /v1/users/{userId}/memory-facts/{factId}
```

---

# Metrics

## Metrics Summary

```text
GET /v1/metrics/summary
```

---

# Admin API

All admin endpoints are under:

```text
/v1/admin/*
```

---

# Health

## Platform Health

```text
GET /v1/admin/health
```

---

# Model Configuration

## Get Model Config

```text
GET /v1/admin/model-config
```

```ts
type ModelConfigResponse = {
  globalDefault: { provider: string; model: string }
  roleOverrides: {
    avatar?: { provider?: string; model?: string }
    gameMaster?: { provider?: string; model?: string }
    memory?: { provider?: string; model?: string }
  }
  updatedAt: string
}
```

Response:

```ts
ApiResponse<{ modelConfig: ModelConfigResponse }>
```

Always returns `200` with effective config (falls back to default when no DB row exists).

## Update Model Config

```text
PUT /v1/admin/model-config
```

Request:

```ts
type UpdateModelConfigRequest = {
  globalDefault: { provider: string; model: string }
  roleOverrides?: {
    avatar?: { provider?: string; model?: string }
    gameMaster?: { provider?: string; model?: string }
    memory?: { provider?: string; model?: string }
  }
}
```

Validation:

- provider fields must be one of `openai | anthropic | mistral | xai | null`
- model fields must be non-empty strings when provided
- `globalDefault.model` must be non-empty and at most 200 chars after trimming
- unknown fields are rejected

Response:

```ts
ApiResponse<{ modelConfig: ModelConfigResponse }>
```

Validation failures return `400` with `VALIDATION_ERROR`.

---

# Inspector

## Inspect Session

```text
GET /v1/admin/sessions/{sessionId}/inspect
```

Response:

```ts
ApiResponse<{
  inspect: {
    session: SessionSummary
    gmState: GmStateSummary | null
    transitionHistory: SessionTransitionRecord[]
    unlockedAvatarIds: string[]
    gmNotes: string | null
    effectiveModels: {
      avatar: { provider: string; model: string }
      gameMaster: { provider: string; model: string }
      memory: { provider: string; model: string }
    }
  }
}>
```

---

## Session Events

```text
GET /v1/admin/sessions/{sessionId}/events
```

Response notes:

- Returns `ApiResponse<AdminSessionEventsResponse>`
- `gm_triggered` decision payloads may include bounded unlock diagnostics (`avatarId`, `avatarName`, `reason`, `outcome`)
- `turn_completed` payloads may include per-turn retrieval timing (`retrievalLatencyMs`) and remaining non-LLM overhead (`otherOverheadMs`)

---

## Session Context

```text
GET /v1/admin/sessions/{sessionId}/context
```

Response notes:

- Returns `ApiResponse<AdminSessionContextResponse>`
- Returns the stable prompt inputs only: `avatarPrompt`, `worldContext`, `worldObjectives`, `gmInstruction`, `workingMemory`, and `currentExchanges`
- Does not return retrieval output; turn-specific RAG usage must be inspected from session events

---

## Session Metrics

```text
GET /v1/admin/sessions/{sessionId}/metrics
```

Response notes:

- Returns `ApiResponse<AdminSessionTurnMetricsResponse>`
- Each turn entry includes `conversationId`
- Each turn entry may include `retrievalLatencyMs` when typed retrieval ran for that turn

---

## Session Memory

```text
GET /v1/admin/sessions/{sessionId}/memory
```

---

## Session Memory Layers

```text
GET /v1/admin/sessions/{sessionId}/memory-layers
```

---

# Runtime Actions

## Replay GM

```text
POST /v1/admin/sessions/{sessionId}/gm/replay
```

---

## Refresh Memory

```text
POST /v1/admin/sessions/{sessionId}/memory/refresh
```

---

## Clear Session Memory

```text
POST /v1/admin/sessions/{sessionId}/memory/clear
```

---

# Jobs

## List Jobs

```text
GET /v1/admin/jobs
```

---

## Retry Job

```text
POST /v1/admin/jobs/{jobId}/retry
```

---

# Audit & Errors

## Recent Errors

```text
GET /v1/admin/errors
```

---

## Audit Log

```text
GET /v1/admin/audit-log
```

---

# Validation Rules

## Message Content

- required
- trimmed non-empty
- bounded max size

## Config Objects

- always JSON objects
- never JSON-encoded strings

---

# HTTP Status Rules

## Success

- `200 OK`
- `201 Created`
- `202 Accepted`
- `204 No Content`

## Errors

- `400 Bad Request`
- `401 Unauthorized`
- `403 Forbidden`
- `404 Not Found`
- `409 Conflict`
- `429 Too Many Requests`
- `500 Internal Server Error`
- `502/503/504 Upstream Errors`

---

# Contract Ownership

## Shared DTOs

```text
packages/shared/src/*
```

## Domain Contracts

```text
apps/core/src/domain/*
```

## Memory Contracts

```text
apps/core/src/domain/memory/*
packages/shared/src/memory-contract-types.ts
```

## Runtime Inspector Contracts

```text
packages/shared/src/runtime-inspector-types.ts
```

## Knowledge/Retrieval Contracts

```text
apps/core/src/domain/knowledge/knowledge.types.ts
packages/shared/src/knowledge-contract-types.ts
```

## Conversation Contracts

```text
packages/shared/src/conversation-contract-types.ts
```

## Scenario/Avatar Contracts (EPIC 6.1)

```text
apps/core/src/domain/scenario/scenario.types.ts
apps/core/src/domain/avatar/avatar.types.ts
packages/shared/src/entity-types.ts        -- summaries + create/update avatar shapes
packages/shared/src/web-contract-types.ts  -- scenario/avatar route request/response wrappers
```

Route handlers (`apps/core/src/api/routes/scenarios.ts`, `avatars.ts`) must import these
canonical types rather than re-declaring local request/response shapes.

`AvatarComputedTraits` (EPIC 8.1) is defined once in `packages/shared/src/entity-types.ts`
and re-exported (not re-declared) by `apps/core/src/domain/avatar/avatar.types.ts` for
domain/internal use, following the same pattern as `AvatarLlmOverride`.

`PrepareAvatarTraitsResponse` / `AvatarTraitPreparationResult` (EPIC 8.1) are defined once
in `packages/shared/src/web-contract-types.ts`; the `PrepareScenarioAvatarTraitsUseCase`
output type (`apps/core/.../prepare-scenario-avatar-traits.types.ts`) reuses them directly
rather than re-declaring the same shape.

## Model Configuration Contracts (EPIC 6.1)

```text
apps/core/src/domain/model-config/model-config.types.ts  -- ModelConfig, ModelRole, ProviderName
packages/shared/src/runtime-inspector-types.ts            -- ModelConfigResponse, UpdateModelConfigRequest
packages/shared/src/model-catalog.ts                     -- provider catalog + scenario model-selection contracts
```

Runtime precedence:

- avatar runtime: `avatar.llmOverride` -> `scenario.modelSelection.defaultProfile` -> global avatar role override -> global default
- Game Master runtime: `scenario.modelSelection.gameMasterOverride` -> `scenario.modelSelection.defaultProfile` -> global Game Master role override -> global default
- memory runtime: global memory role override -> global default

---

# Non Goals

Not part of Phase A:

- voice APIs
- media playback orchestration
- tenant management
- fine-grained GM controls
- raw prompt management
- benchmark APIs

---

# Evolution Rules

- additive changes preferred
- avoid changing field meanings
- keep payloads stable
- prefer new endpoints over polymorphic overloads
- public contracts remain thinner than internal architecture

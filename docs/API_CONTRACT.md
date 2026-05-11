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
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}
```

## SessionSummary

```ts
type SessionSummary = {
  sessionId: string
  userId: string
  scenarioId: string
  activeAvatarId?: string | null
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

---

## Get Scenario

```text
GET /v1/scenarios/{scenarioId}
```

---

## Update Scenario

```text
PATCH /v1/scenarios/{scenarioId}
```

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

---

## Delete Avatar

```text
DELETE /v1/avatars/{avatarId}
```

---

# Knowledge

## Register Knowledge Source

```text
POST /v1/knowledge-sources
```

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

# Inspector

## Inspect Session

```text
GET /v1/admin/sessions/{sessionId}/inspect
```

---

## Session Events

```text
GET /v1/admin/sessions/{sessionId}/events
```

---

## Session Context

```text
GET /v1/admin/sessions/{sessionId}/context
```

---

## Session Metrics

```text
GET /v1/admin/sessions/{sessionId}/metrics
```

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

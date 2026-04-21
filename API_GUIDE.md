# API Guide — Gami DigiDouble Core

This guide is for **developers and integrators** who want to test the API, build a frontend, or
automate workflows. It covers every currently implemented endpoint with full request/response
examples using `curl`.

For the formal spec (all types, error codes, future endpoints), see
[API_CONTRACT.md](API_CONTRACT.md).

---

## Quick Reference

| Method   | Path                                    | Description                       | Auth |
| -------- | --------------------------------------- | --------------------------------- | ---- |
| `GET`    | `/health`                               | Engine health check               | No   |
| `POST`   | `/v1/scenarios`                         | Create a scenario                 | Yes  |
| `POST`   | `/v1/scenarios/:scenarioId/avatars`     | Create an avatar for a scenario   | Yes  |
| `POST`   | `/v1/conversations/start`               | Start a session                   | Yes  |
| `POST`   | `/v1/conversations/:sessionId/messages` | Send a message, get avatar reply  | Yes  |
| `GET`    | `/v1/conversations/:sessionId/history`  | Get full conversation history     | Yes  |
| `DELETE` | `/v1/conversations/:sessionId`          | Reset a session (delete messages) | Yes  |
| `POST`   | `/v1/exchange`                          | Raw LLM exchange (no session)     | Yes  |

---

## Base URL & Authentication

All examples use:

```
BASE_URL=http://localhost:3000
API_KEY=your-secret-key
```

Every endpoint under `/v1` requires the header:

```
x-api-key: <API_KEY>
```

Requests without the header, or with the wrong key, receive `401 UNAUTHORIZED`.

Set these once in your shell before running any example:

```bash
export BASE_URL=http://localhost:3000
export API_KEY=your-secret-key
```

> **Note:** When running the Docker E2E stack (`docker-compose.e2e.yml`), the fixed key is
> `e2e-stack-secret`. For local development, set `API_KEY_SECRET` in your `.env` file.

---

## Response Envelope

All endpoints return a standard envelope:

```json
{
  "data": { ... },
  "error": null
}
```

On failure:

```json
{
  "data": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "Session not found"
  }
}
```

Always check `error` before reading `data`. Common error codes:

| Code                     | Typical HTTP status | Meaning                               |
| ------------------------ | ------------------- | ------------------------------------- |
| `UNAUTHORIZED`           | 401                 | Missing or wrong API key              |
| `VALIDATION_ERROR`       | 400                 | Invalid request body or params        |
| `NOT_FOUND`              | 404                 | Resource (session, avatar, …) missing |
| `CONFLICT`               | 409                 | Session is closed or archived         |
| `EXTERNAL_SERVICE_ERROR` | 502                 | LLM provider failure                  |
| `INTERNAL_ERROR`         | 500                 | Unexpected server error               |

---

## Typical Integration Flow

The standard flow for testing or building a frontend:

```
1. Create a Scenario          POST /v1/scenarios
2. Create an Avatar           POST /v1/scenarios/:scenarioId/avatars
3. Start a Session            POST /v1/conversations/start
4. Send Messages              POST /v1/conversations/:sessionId/messages  (repeat)
5. Read History               GET  /v1/conversations/:sessionId/history
6. Reset (optional)           DELETE /v1/conversations/:sessionId
```

Steps 1 and 2 are configuration — they only need to happen once per experience.
Steps 3–6 are runtime — they happen per user session.

---

## Endpoint Reference

### Health Check

Verify the server is reachable. Does not require authentication.

```bash
curl "$BASE_URL/health"
```

**Response (200):**

```json
{
  "data": {
    "status": "ok",
    "timestamp": "2026-04-20T10:00:00.000Z"
  },
  "error": null
}
```

---

### 1. Create a Scenario

A **Scenario** defines an interactive experience: its name and optional configuration.
At least one Avatar must be attached before users can start a session.

```bash
curl -X POST "$BASE_URL/v1/scenarios" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "name": "Museum Guide",
    "status": "active"
  }'
```

**Request fields:**

| Field    | Type                                    | Required | Notes                            |
| -------- | --------------------------------------- | -------- | -------------------------------- |
| `name`   | string                                  | Yes      | Display name                     |
| `status` | `"draft"` \| `"active"` \| `"archived"` | No       | Defaults to `"draft"`            |
| `config` | object                                  | No       | Arbitrary scenario configuration |

**Response (201):**

```json
{
  "data": {
    "scenario": {
      "scenarioId": "scenario_01jwxxxxxx",
      "name": "Museum Guide",
      "status": "active",
      "config": {},
      "createdAt": "2026-04-20T10:00:00.000Z",
      "updatedAt": "2026-04-20T10:00:00.000Z"
    }
  },
  "error": null
}
```

Save the `scenarioId` — it is required for avatar creation and session start.

---

### 2. Create an Avatar

An **Avatar** is a persona attached to a scenario. The `personaPrompt` is injected as the
system prompt for every LLM call in sessions using this avatar.

```bash
curl -X POST "$BASE_URL/v1/scenarios/$SCENARIO_ID/avatars" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "name": "Marie Curie",
    "personaPrompt": "You are Marie Curie, speaking to a museum visitor. You are passionate about science, approachable, and historically accurate. Respond in the first person.",
    "tone": "warm and enthusiastic",
    "description": "A historically-grounded avatar of Marie Curie for the science wing."
  }'
```

**Request fields:**

| Field           | Type                                    | Required | Notes                                         |
| --------------- | --------------------------------------- | -------- | --------------------------------------------- |
| `name`          | string                                  | Yes      | Display name                                  |
| `personaPrompt` | string                                  | Yes      | System prompt defining the avatar's character |
| `tone`          | string                                  | No       | Optional tone descriptor passed to the LLM    |
| `description`   | string                                  | No       | Human-readable description (not sent to LLM)  |
| `adjustments`   | string[]                                | No       | Additional persona modifiers                  |
| `config`        | object                                  | No       | Avatar-specific configuration                 |
| `status`        | `"draft"` \| `"active"` \| `"archived"` | No       | Defaults to `"draft"`                         |

**Response (201):**

```json
{
  "data": {
    "avatar": {
      "avatarId": "avatar_01jwxxxxxx",
      "scenarioId": "scenario_01jwxxxxxx",
      "name": "Marie Curie",
      "status": "draft",
      "personaPrompt": "You are Marie Curie...",
      "tone": "warm and enthusiastic",
      "description": "A historically-grounded avatar of Marie Curie for the science wing.",
      "adjustments": [],
      "createdAt": "2026-04-20T10:00:00.000Z",
      "updatedAt": "2026-04-20T10:00:00.000Z"
    }
  },
  "error": null
}
```

**Error cases:**

- `404 NOT_FOUND` — the `scenarioId` in the URL does not exist
- `400 VALIDATION_ERROR` — missing required fields or invalid input

Save the `avatarId` — it is required when sending messages.

---

### 3. Start a Session

A **Session** represents one user's conversation within a scenario. Each session has its own
message history and memory.

```bash
curl -X POST "$BASE_URL/v1/conversations/start" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "userId": "user_alice",
    "scenarioId": "scenario_01jwxxxxxx"
  }'
```

**Request fields:**

| Field        | Type   | Required | Notes                                                   |
| ------------ | ------ | -------- | ------------------------------------------------------- |
| `userId`     | string | Yes      | Any stable identifier for the user (your app's user ID) |
| `scenarioId` | string | Yes      | ID of the scenario to run                               |

**Response (201):**

```json
{
  "data": {
    "session": {
      "sessionId": "session_01jwxxxxxx",
      "userId": "user_alice",
      "scenarioId": "scenario_01jwxxxxxx",
      "status": "active",
      "startedAt": "2026-04-20T10:01:00.000Z",
      "lastActivityAt": "2026-04-20T10:01:00.000Z"
    }
  },
  "error": null
}
```

Save the `sessionId` — it is the key for all subsequent calls in this conversation.

> **Note (Sprint 2):** The `scenarioId` is not validated for existence at session start yet.
> Validation happens at message-send time when the avatar is loaded.

---

### 4. Send a Message

Send one user message and receive one avatar reply. This is the main runtime loop.

```bash
curl -X POST "$BASE_URL/v1/conversations/$SESSION_ID/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "avatarId": "avatar_01jwxxxxxx",
    "message": {
      "content": "Tell me about your discovery of polonium."
    }
  }'
```

**Request fields:**

| Field             | Type   | Required | Constraints       |
| ----------------- | ------ | -------- | ----------------- |
| `avatarId`        | string | Yes      | Must exist        |
| `message.content` | string | Yes      | 1–4000 characters |

**Response (200):**

```json
{
  "data": {
    "session": {
      "sessionId": "session_01jwxxxxxx",
      "userId": "user_alice",
      "scenarioId": "scenario_01jwxxxxxx",
      "status": "active",
      "startedAt": "2026-04-20T10:01:00.000Z",
      "lastActivityAt": "2026-04-20T10:02:00.000Z"
    },
    "userMessage": {
      "messageId": "msg_01jwxxxxxx",
      "sessionId": "session_01jwxxxxxx",
      "role": "user",
      "content": "Tell me about your discovery of polonium.",
      "createdAt": "2026-04-20T10:02:00.000Z"
    },
    "avatarMessage": {
      "messageId": "msg_01jwxxxxxy",
      "sessionId": "session_01jwxxxxxx",
      "role": "avatar",
      "content": "Polonium was the first element I discovered, named after my homeland Poland...",
      "createdAt": "2026-04-20T10:02:01.200Z",
      "metadata": {
        "model": "gpt-4o-mini",
        "latencyMs": 1200,
        "inputTokens": 312,
        "outputTokens": 87,
        "totalTokens": 399
      }
    },
    "debug": {
      "requestId": "req_01jwxxxxxx",
      "model": "gpt-4o-mini",
      "latencyMs": 1200,
      "inputTokens": 312,
      "outputTokens": 87
    }
  },
  "error": null
}
```

**Key response fields:**

| Field                                 | Description                                 |
| ------------------------------------- | ------------------------------------------- |
| `avatarMessage.content`               | The avatar's reply — render this in your UI |
| `avatarMessage.metadata.model`        | Which LLM model generated the reply         |
| `avatarMessage.metadata.latencyMs`    | End-to-end generation time in milliseconds  |
| `avatarMessage.metadata.inputTokens`  | Tokens consumed by the prompt               |
| `avatarMessage.metadata.outputTokens` | Tokens in the avatar reply                  |
| `debug.requestId`                     | Use this to correlate with Langfuse traces  |

**Error cases:**

- `404 NOT_FOUND` — `sessionId` or `avatarId` does not exist
- `409 CONFLICT` — session is closed or archived
- `400 VALIDATION_ERROR` — missing fields or content exceeds 4000 chars
- `502 EXTERNAL_SERVICE_ERROR` — LLM provider call failed

> **LLM_PROVIDER=null:** When the server is configured with `LLM_PROVIDER=null` (default for
> local dev and E2E tests), the avatar replies with a fixed stub: `"[null] ..."`. This lets you
> test the full API flow without real provider credentials.

---

### 5. Get Conversation History

Retrieve all messages for a session in chronological order.

```bash
curl "$BASE_URL/v1/conversations/$SESSION_ID/history" \
  -H "x-api-key: $API_KEY"
```

**Response (200):**

```json
{
  "data": {
    "session": {
      "sessionId": "session_01jwxxxxxx",
      "userId": "user_alice",
      "scenarioId": "scenario_01jwxxxxxx",
      "status": "active",
      "startedAt": "2026-04-20T10:01:00.000Z",
      "lastActivityAt": "2026-04-20T10:02:01.200Z"
    },
    "messages": [
      {
        "messageId": "msg_01jwxxxxxx",
        "sessionId": "session_01jwxxxxxx",
        "role": "user",
        "content": "Tell me about your discovery of polonium.",
        "createdAt": "2026-04-20T10:02:00.000Z"
      },
      {
        "messageId": "msg_01jwxxxxxy",
        "sessionId": "session_01jwxxxxxx",
        "role": "avatar",
        "content": "Polonium was the first element I discovered...",
        "createdAt": "2026-04-20T10:02:01.200Z",
        "metadata": {
          "model": "gpt-4o-mini",
          "latencyMs": 1200,
          "inputTokens": 312,
          "outputTokens": 87,
          "totalTokens": 399
        }
      }
    ]
  },
  "error": null
}
```

Messages are ordered by `createdAt` ascending (oldest first). Render them top-to-bottom in
your chat UI.

**Error cases:**

- `404 NOT_FOUND` — `sessionId` does not exist

---

### 6. Reset a Session

Delete all messages in a session. The session record is kept (enabling re-use of the same
`sessionId`) but the conversation history is cleared.

```bash
curl -X DELETE "$BASE_URL/v1/conversations/$SESSION_ID" \
  -H "x-api-key: $API_KEY"
```

**Response (200):**

```json
{
  "data": {
    "sessionId": "session_01jwxxxxxx",
    "deleted": {
      "messages": 4,
      "sessionMemory": false,
      "events": 0
    }
  },
  "error": null
}
```

> **Note (Sprint 2):** `sessionMemory` is always `false` (deferred to EPIC 4.2 — Memory Layer).
> `events` is always `0` (deferred to EPIC 3.3 — Game Master Events).

**Error cases:**

- `404 NOT_FOUND` — `sessionId` does not exist

---

### Raw Exchange (no session)

A minimal endpoint that sends a single prompt to the LLM and returns the completion. No session,
no history, no avatar. Used for basic connectivity validation.

```bash
curl -X POST "$BASE_URL/v1/exchange" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "message": "Say hello in exactly three words.",
    "systemPrompt": "You are a concise assistant."
  }'
```

**Response (200):**

```json
{
  "data": {
    "requestId": "req_01jwxxxxxx",
    "reply": "Hello, dear user.",
    "model": "gpt-4o-mini",
    "inputTokens": 24,
    "outputTokens": 7,
    "latencyMs": 580
  },
  "error": null
}
```

---

## Full End-to-End Flow (Shell Script)

Copy-paste this script to run a complete conversation loop. Replace the values at the top with
your own.

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:3000"
API_KEY="your-secret-key"

echo "=== 1. Create Scenario ==="
SCENARIO=$(curl -s -X POST "$BASE_URL/v1/scenarios" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "name": "Demo Experience",
    "status": "active"
  }')
echo "$SCENARIO" | python3 -m json.tool
SCENARIO_ID=$(echo "$SCENARIO" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['scenario']['scenarioId'])")
echo "scenarioId: $SCENARIO_ID"

echo ""
echo "=== 2. Create Avatar ==="
AVATAR=$(curl -s -X POST "$BASE_URL/v1/scenarios/$SCENARIO_ID/avatars" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "name": "AI Guide",
    "personaPrompt": "You are a friendly and knowledgeable guide. Answer clearly and encourage curiosity.",
    "tone": "friendly"
  }')
echo "$AVATAR" | python3 -m json.tool
AVATAR_ID=$(echo "$AVATAR" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['avatar']['avatarId'])")
echo "avatarId: $AVATAR_ID"

echo ""
echo "=== 3. Start Session ==="
SESSION=$(curl -s -X POST "$BASE_URL/v1/conversations/start" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"userId\": \"user_demo_$(date +%s)\",
    \"scenarioId\": \"$SCENARIO_ID\"
  }")
echo "$SESSION" | python3 -m json.tool
SESSION_ID=$(echo "$SESSION" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['session']['sessionId'])")
echo "sessionId: $SESSION_ID"

echo ""
echo "=== 4. Send Message ==="
REPLY=$(curl -s -X POST "$BASE_URL/v1/conversations/$SESSION_ID/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"avatarId\": \"$AVATAR_ID\",
    \"message\": { \"content\": \"Hello! What can you help me with?\" }
  }")
echo "$REPLY" | python3 -m json.tool

echo ""
echo "=== 5. Get History ==="
curl -s "$BASE_URL/v1/conversations/$SESSION_ID/history" \
  -H "x-api-key: $API_KEY" | python3 -m json.tool

echo ""
echo "=== 6. Reset Session ==="
curl -s -X DELETE "$BASE_URL/v1/conversations/$SESSION_ID" \
  -H "x-api-key: $API_KEY" | python3 -m json.tool
```

---

## Frontend Integration Notes

### Typical component model

```
App state:
  scenarioId: string | null
  avatarId: string | null
  sessionId: string | null
  messages: Message[]

Message shape for UI:
  { role: "user" | "avatar", content: string, metadata?: { model, latencyMs, inputTokens, outputTokens } }
```

### Session start

Call `POST /v1/conversations/start` once. Store `sessionId` in component state (or local
storage for page-reload persistence).

### Optimistic message append

After sending a message:

1. Append the user message to the local list immediately (before awaiting the response)
2. Show a loading indicator for the avatar reply
3. On response, append `avatarMessage` and clear the loading indicator
4. On error, remove the optimistic message and display the error

### History hydration

On mount (or session resume), call `GET /v1/conversations/:sessionId/history` to load
previous messages. Map `role: "avatar"` messages to your avatar display format.

### Token / latency metadata

The `avatarMessage.metadata` block is always present on live responses. Surface it in a
debug panel during development; it can be hidden or shown conditionally in production.

### Error display

Never swallow errors silently. If `error !== null` in the response envelope, show the
`error.code` and `error.message` to the user or developer. Common patterns:

- `NOT_FOUND` on session → session expired or never created → show "Start a new session"
- `CONFLICT` → session was reset externally → refresh state
- `EXTERNAL_SERVICE_ERROR` → LLM provider down → show retry prompt

---

## Postman Collection

To import into Postman:

1. Create a new collection
2. Set two **collection variables**: `base_url` and `api_key`
3. Add a request for each endpoint above
4. Use `{{base_url}}` and `{{api_key}}` in URL and header fields
5. For the chained flow, use Postman's **Scripts → Post-response** tab to save IDs:

   ```js
   // After "Create Scenario":
   pm.collectionVariables.set('scenario_id', pm.response.json().data.scenario.scenarioId)

   // After "Create Avatar":
   pm.collectionVariables.set('avatar_id', pm.response.json().data.avatar.avatarId)

   // After "Start Session":
   pm.collectionVariables.set('session_id', pm.response.json().data.session.sessionId)
   ```

---

## IDs and Timestamps

- All IDs are opaque strings prefixed by type: `scenario_...`, `avatar_...`, `session_...`, `msg_...`
- Never parse or generate IDs on the client; always use values returned by the API
- All timestamps are ISO 8601 UTC strings

---

## Not Yet Implemented

These endpoints are defined in [API_CONTRACT.md](API_CONTRACT.md) but not yet live:

| Endpoint                                                | Epic     |
| ------------------------------------------------------- | -------- |
| `GET /v1/conversations/:sessionId/state`                | EPIC 4.1 |
| `GET /v1/scenarios`                                     | EPIC 3.x |
| `GET /v1/scenarios/:scenarioId`                         | EPIC 3.x |
| Streaming: `POST /v1/conversations/:id/messages/stream` | EPIC 3.x |
| Memory: `SessionMemorySummary` in history               | EPIC 4.2 |
| Knowledge: `/v1/knowledge-sources`                      | EPIC 5.x |

> This document should be updated whenever a new endpoint goes live. The source of truth for
> what is currently implemented is [PROJECT_STATUS.md](PROJECT_STATUS.md).

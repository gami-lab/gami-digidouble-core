# API Guide — Gami DigiDouble Core

This guide is for **developers and integrators** who want to test the API, build a frontend, or
automate workflows. It covers every currently implemented endpoint with full request/response
examples using `curl`.

For the formal spec (all types, error codes, future endpoints), see
[API_CONTRACT.md](API_CONTRACT.md).

---

## Quick Reference

| Method   | Path                                         | Description                       | Auth |
| -------- | -------------------------------------------- | --------------------------------- | ---- |
| `GET`    | `/health`                                    | Engine health check               | No   |
| `GET`    | `/v1/scenarios`                              | List scenarios (newest first)     | Yes  |
| `POST`   | `/v1/scenarios`                              | Create a scenario                 | Yes  |
| `PATCH`  | `/v1/scenarios/:scenarioId`                  | Partial-update a scenario         | Yes  |
| `DELETE` | `/v1/scenarios/:scenarioId`                  | Delete scenario (safe checks)     | Yes  |
| `POST`   | `/v1/scenarios/:scenarioId/avatars`          | Create an avatar for a scenario   | Yes  |
| `GET`    | `/v1/scenarios/:scenarioId/avatars`          | List avatars for a scenario       | Yes  |
| `PATCH`  | `/v1/avatars/:avatarId`                      | Partial-update an avatar          | Yes  |
| `DELETE` | `/v1/avatars/:avatarId`                      | Delete avatar (safe checks)       | Yes  |
| `POST`   | `/v1/sessions`                               | Create a session                  | Yes  |
| `GET`    | `/v1/sessions`                               | List sessions (optional filters)  | Yes  |
| `GET`    | `/v1/sessions/:sessionId`                    | Get session                       | Yes  |
| `POST`   | `/v1/sessions/:sessionId/reset`              | Hard-reset session state          | Yes  |
| `POST`   | `/v1/sessions/:sessionId/conversations`      | Start a conversation in a session | Yes  |
| `GET`    | `/v1/sessions/:sessionId/conversations`      | List conversations in a session   | Yes  |
| `POST`   | `/v1/conversations/:conversationId/messages` | Send a message, get avatar reply  | Yes  |
| `GET`    | `/v1/conversations/:conversationId/history`  | Get conversation history          | Yes  |
| `POST`   | `/v1/exchange`                               | Raw LLM exchange (no session)     | Yes  |
| `GET`    | `/v1/admin/sessions/:sessionId/inspect`      | GM orchestration snapshot (admin) | Yes  |
| `GET`    | `/v1/admin/sessions/:sessionId/events`       | GM diagnostic events (admin)      | Yes  |
| `GET`    | `/v1/admin/sessions/:sessionId/metrics`      | Turn performance metrics (admin)  | Yes  |

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
3. Create a Session           POST /v1/sessions
4. Start a Conversation       POST /v1/sessions/:sessionId/conversations
5. Send Messages              POST /v1/conversations/:conversationId/messages  (repeat)
6. Read History               GET  /v1/conversations/:conversationId/history
```

Steps 1 and 2 are configuration — they only need to happen once per experience.
Steps 3–6 are runtime — they happen per user session.

A **Session** is the durable container for one user's run inside a scenario. A **Conversation**
is a bounded dialogue episode with one avatar inside that session. Switching avatars or resuming
later creates a new conversation inside the same session.

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

### 1.1 List Scenarios

Returns scenarios ordered by `createdAt DESC` (newest first).

```bash
curl -X GET "$BASE_URL/v1/scenarios" \
  -H "x-api-key: $API_KEY"
```

**Response (200):**

```json
{
  "data": {
    "scenarios": [
      {
        "scenarioId": "scenario_01jwxxxxxx",
        "name": "Museum Guide",
        "status": "active",
        "config": {
          "worldContext": "A guided learning experience about AI.",
          "objectives": ["Introduce AI concepts progressively."],
          "avatarAvailability": {
            "initialAvatarIds": ["guide"],
            "unlockableAvatarIds": ["theo", "eva"]
          }
        },
        "createdAt": "2026-04-20T10:00:00.000Z",
        "updatedAt": "2026-04-20T10:00:00.000Z"
      }
    ]
  },
  "error": null
}
```

`config` is returned exactly as stored by `POST /v1/scenarios` or `PATCH /v1/scenarios/:scenarioId`.

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
      "config": {
        "scope": "Broad AI literacy"
      },
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

### 2.1 List Avatars for a Scenario

```bash
curl -X GET "$BASE_URL/v1/scenarios/$SCENARIO_ID/avatars" \
  -H "x-api-key: $API_KEY"
```

Behavior:

- `404 NOT_FOUND` if scenario does not exist
- `200` with `avatars: []` if scenario exists with no avatars
- ordered by `createdAt DESC` (newest first)

**Response (200):**

```json
{
  "data": {
    "avatars": [
      {
        "avatarId": "avatar_01jwxxxxxx",
        "scenarioId": "scenario_01jwxxxxxx",
        "name": "Mira",
        "status": "active",
        "personaPrompt": "You are Mira...",
        "tone": "Warm, clear, and approachable.",
        "description": "Friendly first-contact guide for broad AI discovery.",
        "adjustments": [],
        "config": {
          "scope": "Broad AI literacy"
        },
        "createdAt": "2026-04-20T10:00:00.000Z",
        "updatedAt": "2026-04-20T10:00:00.000Z"
      }
    ]
  },
  "error": null
}
```

---

### 2.2 Update an Avatar

Partial update — only the fields you include are written. Absent fields are untouched.
`scenarioId` is immutable and is not accepted.

```bash
curl -X PATCH "$BASE_URL/v1/avatars/$AVATAR_ID" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "name": "Marie Curie (Updated)",
    "tone": "calm and precise"
  }'
```

**Updatable fields:**

| Field           | Type                                    |
| --------------- | --------------------------------------- |
| `name`          | string                                  |
| `personaPrompt` | string                                  |
| `tone`          | string                                  |
| `description`   | string                                  |
| `adjustments`   | string[]                                |
| `config`        | object                                  |
| `status`        | `"draft"` \| `"active"` \| `"archived"` |

At least one field must be present; an empty `{}` body returns `400 VALIDATION_ERROR`.
`updatedAt` is always refreshed on success.

**Response (200):**

```json
{
  "data": {
    "avatar": {
      "avatarId": "avatar_01jwxxxxxx",
      "scenarioId": "scenario_01jwxxxxxx",
      "name": "Marie Curie (Updated)",
      "status": "active",
      "personaPrompt": "You are Marie Curie...",
      "tone": "calm and precise",
      "config": {
        "scope": "Broad AI literacy"
      },
      "updatedAt": "2026-04-29T09:00:00.000Z"
    }
  },
  "error": null
}
```

**Error cases:**

- `400 VALIDATION_ERROR` — empty body, no fields provided
- `404 NOT_FOUND` — avatar does not exist

---

### 2.3 Delete an Avatar

```bash
curl -X DELETE "$BASE_URL/v1/avatars/$AVATAR_ID" \
  -H "x-api-key: $API_KEY"
```

Behavior:

- `404 NOT_FOUND` if avatar does not exist
- `409 CONFLICT` if deletion is blocked because the avatar's scenario still has active sessions

---

### 2.4 Update a Scenario

Partial update — only the fields you include are written. Absent fields are untouched.

```bash
curl -X PATCH "$BASE_URL/v1/scenarios/$SCENARIO_ID" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "name": "Museum Guide v2",
    "status": "active"
  }'
```

**Updatable fields:**

| Field    | Type                                    |
| -------- | --------------------------------------- |
| `name`   | string                                  |
| `status` | `"draft"` \| `"active"` \| `"archived"` |
| `config` | object (fully replaced, not merged)     |

At least one field must be present. `updatedAt` is always refreshed on success.

**Response (200):**

```json
{
  "data": {
    "scenario": {
      "scenarioId": "scenario_01jwxxxxxx",
      "name": "Museum Guide v2",
      "status": "active",
      "config": {
        "worldContext": "A guided learning experience about AI.",
        "objectives": ["Introduce AI concepts progressively."],
        "avatarAvailability": {
          "initialAvatarIds": ["guide"],
          "unlockableAvatarIds": ["theo", "eva"]
        }
      },
      "updatedAt": "2026-04-29T09:00:00.000Z"
    }
  },
  "error": null
}
```

**Error cases:**

- `400 VALIDATION_ERROR` — empty body
- `404 NOT_FOUND` — scenario does not exist

---

### 2.5 Delete a Scenario

```bash
curl -X DELETE "$BASE_URL/v1/scenarios/$SCENARIO_ID" \
  -H "x-api-key: $API_KEY"
```

Behavior:

- `404 NOT_FOUND` if scenario does not exist
- `409 CONFLICT` if the scenario still has avatars or sessions
- no force-delete behavior in this slice

---

### 3. Create a Session

A **Session** is a durable container for one user's run inside a scenario. It holds the session
state and links all conversations that happen during that run.

```bash
curl -X POST "$BASE_URL/v1/sessions" \
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

Save the `sessionId` — you need it to start a conversation.

**Error cases:**

- `404 NOT_FOUND` — the `scenarioId` does not exist
- `400 VALIDATION_ERROR` — missing required fields

---

### 3.1 List Sessions

Returns sessions ordered by `lastActivityAt DESC`. All query parameters are optional.

```bash
curl "$BASE_URL/v1/sessions" \
  -H "x-api-key: $API_KEY"

# With filters:
curl "$BASE_URL/v1/sessions?scenarioId=$SCENARIO_ID&status=active" \
  -H "x-api-key: $API_KEY"
```

**Query parameters:**

| Parameter    | Type                               | Description              |
| ------------ | ---------------------------------- | ------------------------ |
| `scenarioId` | string                             | Filter by scenario       |
| `userId`     | string                             | Filter by user           |
| `status`     | `active` \| `closed` \| `archived` | Filter by session status |

**Response (200):**

```json
{
  "data": {
    "sessions": [
      {
        "sessionId": "session_01jwxxxxxx",
        "userId": "user_alice",
        "scenarioId": "scenario_01jwxxxxxx",
        "status": "active",
        "startedAt": "2026-04-20T10:01:00.000Z",
        "lastActivityAt": "2026-04-20T10:05:00.000Z"
      }
    ]
  },
  "error": null
}
```

**Error cases:**

- `400 VALIDATION_ERROR` — invalid `status` value

---

### 3.2 Reset a Session

Hard-resets session state to a clean slate. The session record itself is **not deleted** — only
its runtime data is cleared:

- All messages and conversations deleted
- `activeAvatarId` cleared to `null`
- `unlockedAvatarIds` reset to `[]`
- `gmNotes` cleared to `null`
- `status` reset to `'active'`
- `lastActivityAt` refreshed to now

The `userId` and `scenarioId` binding are preserved.

```bash
curl -X POST "$BASE_URL/v1/sessions/$SESSION_ID/reset" \
  -H "x-api-key: $API_KEY"
```

No request body required.

**Response (200):**

```json
{
  "data": {
    "session": {
      "sessionId": "session_01jwxxxxxx",
      "userId": "user_alice",
      "scenarioId": "scenario_01jwxxxxxx",
      "status": "active",
      "activeAvatarId": null,
      "unlockedAvatarIds": [],
      "lastActivityAt": "2026-04-29T09:00:00.000Z"
    }
  },
  "error": null
}
```

**Error cases:**

- `404 NOT_FOUND` — session does not exist

---

### 3.5. Start a Conversation

A **Conversation** is a bounded dialogue episode with one avatar inside a session. Create one
after creating the session, then use its `conversationId` for all message calls.

```bash
curl -X POST "$BASE_URL/v1/sessions/$SESSION_ID/conversations" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "avatarId": "avatar_01jwxxxxxx"
  }'
```

**Request fields:**

| Field      | Type   | Required | Notes                                              |
| ---------- | ------ | -------- | -------------------------------------------------- |
| `avatarId` | string | Yes      | ID of the avatar that will respond in this episode |

**Response (201):**

```json
{
  "data": {
    "conversation": {
      "conversationId": "conv_01jwxxxxxx",
      "sessionId": "session_01jwxxxxxx",
      "avatarId": "avatar_01jwxxxxxx",
      "status": "active",
      "startedAt": "2026-04-20T10:01:30.000Z",
      "lastActivityAt": "2026-04-20T10:01:30.000Z"
    }
  },
  "error": null
}
```

Save the `conversationId` — it is the key for all message and history calls.

**Error cases:**

- `404 NOT_FOUND` — `sessionId` or `avatarId` does not exist
- `409 CONFLICT` — session is not active

---

### 4. Send a Message

Send one user message and receive one avatar reply. This is the main runtime loop.

```bash
curl -X POST "$BASE_URL/v1/conversations/$CONVERSATION_ID/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{
    "message": {
      "content": "Tell me about your discovery of polonium."
    }
  }'
```

**Request fields:**

| Field             | Type   | Required | Constraints       |
| ----------------- | ------ | -------- | ----------------- |
| `message.content` | string | Yes      | 1–4000 characters |

The avatar that responds is determined by the `avatarId` set when the conversation was started
(`POST /v1/sessions/:sessionId/conversations`).

**Response (200):**

```json
{
  "data": {
    "conversation": {
      "conversationId": "conv_01jwxxxxxx",
      "sessionId": "session_01jwxxxxxx",
      "avatarId": "avatar_01jwxxxxxx",
      "status": "active",
      "startedAt": "2026-04-20T10:01:30.000Z",
      "lastActivityAt": "2026-04-20T10:02:00.000Z"
    },
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
      "conversationId": "conv_01jwxxxxxx",
      "role": "user",
      "content": "Tell me about your discovery of polonium.",
      "createdAt": "2026-04-20T10:02:00.000Z"
    },
    "avatarMessage": {
      "messageId": "msg_01jwxxxxxy",
      "conversationId": "conv_01jwxxxxxx",
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

- `404 NOT_FOUND` — `conversationId` does not exist
- `409 CONFLICT` — conversation or session is closed or archived
- `400 VALIDATION_ERROR` — missing fields or content exceeds 4000 chars
- `502 EXTERNAL_SERVICE_ERROR` — LLM provider call failed

> **LLM_PROVIDER=null:** When the server is configured with `LLM_PROVIDER=null` (default for
> local dev and E2E tests), the avatar replies with a fixed stub: `"[null] ..."`. This lets you
> test the full API flow without real provider credentials.

---

### 5. Get Conversation History

Retrieve all messages for a conversation in chronological order.

```bash
curl "$BASE_URL/v1/conversations/$CONVERSATION_ID/history" \
  -H "x-api-key: $API_KEY"
```

**Response (200):**

```json
{
  "data": {
    "conversation": {
      "conversationId": "conv_01jwxxxxxx",
      "sessionId": "session_01jwxxxxxx",
      "avatarId": "avatar_01jwxxxxxx",
      "status": "active",
      "startedAt": "2026-04-20T10:01:30.000Z",
      "lastActivityAt": "2026-04-20T10:02:01.200Z"
    },
    "messages": [
      {
        "messageId": "msg_01jwxxxxxx",
        "conversationId": "conv_01jwxxxxxx",
        "role": "user",
        "content": "Tell me about your discovery of polonium.",
        "createdAt": "2026-04-20T10:02:00.000Z"
      },
      {
        "messageId": "msg_01jwxxxxxy",
        "conversationId": "conv_01jwxxxxxx",
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

- `404 NOT_FOUND` — `conversationId` does not exist

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
echo "=== 3. Create Session ==="
SESSION=$(curl -s -X POST "$BASE_URL/v1/sessions" \
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
echo "=== 4. Start Conversation ==="
CONVERSATION=$(curl -s -X POST "$BASE_URL/v1/sessions/$SESSION_ID/conversations" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{
    \"avatarId\": \"$AVATAR_ID\"
  }")
echo "$CONVERSATION" | python3 -m json.tool
CONVERSATION_ID=$(echo "$CONVERSATION" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['conversation']['conversationId'])")
echo "conversationId: $CONVERSATION_ID"

echo ""
echo "=== 5. Send Message ==="
REPLY=$(curl -s -X POST "$BASE_URL/v1/conversations/$CONVERSATION_ID/messages" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"message": { "content": "Hello! What can you help me with?" }}')
echo "$REPLY" | python3 -m json.tool

echo ""
echo "=== 6. Get History ==="
curl -s "$BASE_URL/v1/conversations/$CONVERSATION_ID/history" \
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
  conversationId: string | null
  messages: Message[]

Message shape for UI:
  { role: "user" | "avatar", content: string, metadata?: { model, latencyMs, inputTokens, outputTokens } }
```

### Session and conversation start

Call `POST /v1/sessions` once per user run. Store `sessionId`. Then call
`POST /v1/sessions/:sessionId/conversations` with the desired `avatarId` to open the dialogue
episode. Store `conversationId` in component state (or local storage for page-reload
persistence).

### Optimistic message append

After sending a message:

1. Append the user message to the local list immediately (before awaiting the response)
2. Show a loading indicator for the avatar reply
3. On response, append `avatarMessage` and clear the loading indicator
4. On error, remove the optimistic message and display the error

### History hydration

On mount (or session resume), call `GET /v1/conversations/:conversationId/history` to load
previous messages. Map `role: "avatar"` messages to your avatar display format.

### Token / latency metadata

The `avatarMessage.metadata` block is always present on live responses. Surface it in a
debug panel during development; it can be hidden or shown conditionally in production.

### Error display

Never swallow errors silently. If `error !== null` in the response envelope, show the
`error.code` and `error.message` to the user or developer. Common patterns:

- `NOT_FOUND` on conversation → conversation expired or never created → show "Start a new session"
- `CONFLICT` → conversation or session was closed externally → refresh state
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

   // After "Create Session":
   pm.collectionVariables.set('session_id', pm.response.json().data.session.sessionId)

   // After "Start Conversation":
   pm.collectionVariables.set(
     'conversation_id',
     pm.response.json().data.conversation.conversationId,
   )
   ```

---

## IDs and Timestamps

- All IDs are opaque strings prefixed by type: `scenario_...`, `avatar_...`, `session_...`, `conv_...`, `msg_...`
- Never parse or generate IDs on the client; always use values returned by the API
- All timestamps are ISO 8601 UTC strings

---

## Admin Endpoints

All admin endpoints live under `/v1/admin/` and use the same `x-api-key` authentication.
These endpoints are for operators and back-office tooling — they may surface internal
orchestration state that is never exposed through the public API.

### A1. Inspect Session (GM Debug)

Returns an admin-safe orchestration snapshot for a session: GM state, transition history,
unlocked avatars, and current GM notes. Used by the GM Debug Panel in the test console.

```bash
curl "$BASE_URL/v1/admin/sessions/$SESSION_ID/inspect" \
  -H "x-api-key: $API_KEY"
```

**Response (200):**

```json
{
  "data": {
    "inspect": {
      "session": {
        "sessionId": "session_01jwxxxxxx",
        "userId": "user_alice",
        "scenarioId": "scenario_01jwxxxxxx",
        "activeAvatarId": "avatar_01jwxxxxxy",
        "unlockedAvatarIds": ["avatar_01jwxxxxxx", "avatar_01jwxxxxxy"],
        "status": "active",
        "startedAt": "2026-04-20T10:00:00.000Z",
        "lastActivityAt": "2026-04-20T10:10:00.000Z"
      },
      "gmState": {
        "currentAvatarId": "avatar_01jwxxxxxy",
        "progression": "intro complete",
        "topicsCovered": ["setup", "background"],
        "interactionCount": 5
      },
      "transitionHistory": [
        {
          "fromAvatarId": "avatar_01jwxxxxxx",
          "toAvatarId": "avatar_01jwxxxxxy",
          "reason": "turn_threshold",
          "startedBy": "gm",
          "transitionedAt": "2026-04-20T10:08:00.000Z"
        },
        {
          "fromAvatarId": null,
          "toAvatarId": "avatar_01jwxxxxxx",
          "reason": "session_start",
          "startedBy": "user",
          "transitionedAt": "2026-04-20T10:00:00.000Z"
        }
      ],
      "unlockedAvatarIds": ["avatar_01jwxxxxxx", "avatar_01jwxxxxxy"],
      "gmNotes": "Guide next turn toward reflection topic."
    }
  },
  "error": null
}
```

**Key response fields:**

| Field               | Description                                                               |
| ------------------- | ------------------------------------------------------------------------- |
| `gmState`           | `null` until the Game Master has run at least once for this session       |
| `transitionHistory` | Newest-first list of avatar transitions derived from the conversation log |
| `gmNotes`           | Director guidance injected into the next Avatar turn (safe to display)    |
| `unlockedAvatarIds` | Avatars currently reachable in this session                               |

No raw user message text, prompt content, or LLM model names are ever included in this response.

**Error cases:**

- `401 UNAUTHORIZED` — missing or wrong API key
- `404 NOT_FOUND` — session does not exist

---

### A2. List Session Events

Returns session diagnostic events for a session (newest-first). Supported event types are
`gm_triggered`, `gm_error`, and `turn_completed`. Unknown/internal types are silently excluded.

```bash
curl "$BASE_URL/v1/admin/sessions/$SESSION_ID/events" \
  -H "x-api-key: $API_KEY"

# With limit:
curl "$BASE_URL/v1/admin/sessions/$SESSION_ID/events?limit=10" \
  -H "x-api-key: $API_KEY"
```

**Query parameters:**

| Parameter | Type    | Default | Max | Description                    |
| --------- | ------- | ------- | --- | ------------------------------ |
| `limit`   | integer | `50`    | 200 | Max number of events to return |

**Response (200):**

```json
{
  "data": {
    "events": [
      {
        "type": "gm_triggered",
        "correlationId": "req_01jwxxxxxx",
        "createdAt": "2026-04-20T10:08:00.000Z",
        "payload": {
          "triggerReason": "turn_threshold",
          "turnIndex": 5,
          "interactionCount": 5,
          "stateBefore": {
            "currentAvatarId": "avatar_01jwxxxxxx",
            "progression": "intro",
            "topicsCovered": ["setup"]
          },
          "decision": {
            "avatarId": "avatar_01jwxxxxxy",
            "conversationMode": "new",
            "notesInjected": true,
            "directiveCount": 1
          },
          "stateAfter": {
            "currentAvatarId": "avatar_01jwxxxxxy",
            "progression": "intro complete",
            "topicsCovered": ["setup", "background"]
          },
          "latencyMs": 240,
          "inputTokens": 180,
          "outputTokens": 45,
          "correlationId": "req_01jwxxxxxx"
        }
      },
      {
        "type": "turn_completed",
        "correlationId": "req_01jwxxxxxy",
        "createdAt": "2026-04-20T10:06:00.000Z",
        "payload": {
          "conversationId": "conv_01jwxxxxxx",
          "turnIndex": 4,
          "avatarId": "avatar_01jwxxxxxx",
          "avatarLatencyMs": 1180,
          "totalTurnLatencyMs": 1290,
          "inputTokens": 210,
          "outputTokens": 95,
          "totalTokens": 305,
          "model": "gpt-4o-mini",
          "hasGm": true
        }
      }
    ]
  },
  "error": null
}
```

**Key response fields:**

| Field                        | Description                                                                |
| ---------------------------- | -------------------------------------------------------------------------- |
| `type`                       | `gm_triggered`, `gm_error`, or `turn_completed`                            |
| `payload.decision`           | Present on `gm_triggered` events only                                      |
| `payload.errorCode`          | Present on `gm_error` events only                                          |
| `payload.totalTurnLatencyMs` | Present on `turn_completed` events only                                    |
| `payload.latencyMs`          | GM LLM latency (for `gm_triggered`) or GM failure latency (for `gm_error`) |

No raw user message text, prompt content, or LLM model names are ever included.

**Error cases:**

- `401 UNAUTHORIZED` — missing or wrong API key
- `400 VALIDATION_ERROR` — invalid `limit` (non-integer or less than 1)
- `404 NOT_FOUND` — session does not exist

---

### A3. Session Turn Metrics

Returns per-turn performance metrics and summary aggregates for one session.

```bash
curl "$BASE_URL/v1/admin/sessions/$SESSION_ID/metrics" \
  -H "x-api-key: $API_KEY"
```

**Response (200):**

```json
{
  "data": {
    "sessionId": "session_01jwxxxxxx",
    "checkedAt": "2026-04-30T12:00:00.000Z",
    "summary": {
      "totalTurns": 2,
      "turnsWithGm": 2,
      "avgAvatarLatencyMs": 990,
      "avgTotalTurnLatencyMs": 1145,
      "avgInputTokens": 256,
      "avgOutputTokens": 101,
      "avgGmLatencyMs": 640
    },
    "turns": [
      {
        "turnIndex": 1,
        "correlationId": "req_01jwxxxxxx",
        "avatarLatencyMs": 820,
        "totalTurnLatencyMs": 1100,
        "overheadMs": 280,
        "inputTokens": 300,
        "outputTokens": 90,
        "totalTokens": 390,
        "model": "gpt-4o-mini",
        "hasGm": true,
        "gmLatencyMs": 610,
        "gmInputTokens": 450,
        "gmOutputTokens": 55
      }
    ]
  },
  "error": null
}
```

**Behavior notes:**

- Returns `200` when authenticated and session exists, even when `turns` is empty.
- `summary.avgGmLatencyMs` is `null` when no turns have GM metrics.
- `turns` is ordered by `turnIndex` ascending.

**Error cases:**

- `401 UNAUTHORIZED` — missing or wrong API key
- `404 NOT_FOUND` — session does not exist

---

## Not Yet Implemented

These endpoints are defined in [API_CONTRACT.md](API_CONTRACT.md) but not yet live:

| Endpoint                                                            | Epic     |
| ------------------------------------------------------------------- | -------- |
| `GET /v1/scenarios/:scenarioId`                                     | EPIC 3.x |
| Streaming: `POST /v1/conversations/:conversationId/messages/stream` | EPIC 3.x |
| Memory: `SessionMemorySummary` in history                           | EPIC 4.2 |
| Knowledge: `/v1/knowledge-sources`                                  | EPIC 5.x |

> This document should be updated whenever a new endpoint goes live. The source of truth for
> what is currently implemented is [PROJECT_STATUS.md](PROJECT_STATUS.md).

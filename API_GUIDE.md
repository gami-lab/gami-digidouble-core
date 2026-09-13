# API guide

This is the shortest integration path for Core. The formal route inventory, shared DTO owners, and
invariants are in [docs/API_CONTRACT.md](docs/API_CONTRACT.md); exact fields are defined in
`packages/shared/src/` and route schemas.

## Configure a client

```bash
export BASE_URL=http://localhost:3000
export API_KEY=your-api-key
```

All `/v1` routes require `x-api-key: $API_KEY`. Responses use:

```json
{ "data": {}, "error": null }
```

On failure, `data` is `null` and `error` contains a stable code and message. Always check `error`
before reading `data`.

## Core flow

Create or select a Scenario and Avatar through the authoring routes, then create a session and
conversation for each user run:

```bash
curl -X POST "$BASE_URL/v1/sessions" \
  -H 'Content-Type: application/json' -H "x-api-key: $API_KEY" \
  -d '{"userId":"user_1","scenarioId":"scenario_1"}'

curl -X POST "$BASE_URL/v1/sessions/$SESSION_ID/conversations" \
  -H 'Content-Type: application/json' -H "x-api-key: $API_KEY" \
  -d '{"avatarId":"avatar_1"}'

curl -X POST "$BASE_URL/v1/conversations/$CONVERSATION_ID/messages" \
  -H 'Content-Type: application/json' -H "x-api-key: $API_KEY" \
  -d '{"message":{"content":"Hello."}}'

curl "$BASE_URL/v1/conversations/$CONVERSATION_ID/history" \
  -H "x-api-key: $API_KEY"
```

Use the IDs returned by Core; clients must not generate or parse them. A Conversation is one
bounded Avatar episode inside a Session. Switching, ending, and resetting are explicit lifecycle work.

## Transports

- JSON messages return one completed Avatar response.
- `/messages/stream` is an additive SSE transport: `started`, ordered `delta`, then one terminal event.
- Voice routes accept bounded raw audio and reuse the same turn flow; unavailable voice must not break text.
- Completed-message audio is an optional binary request after text completion. Audio is transient and text remains the source of truth.
- Runtime events/SSE expose asynchronous GM and state changes for client reconciliation.

An interrupted stream keeps the user message, discards partial Avatar text, and does not run post-turn
GM or memory work.

## Common errors

`401` authentication, `400` validation, `404` missing resource, `409` lifecycle/conflict,
`429` rate limit, `502` provider failure, `504` timeout, and `500` internal failure. Error payloads
remain in the standard JSON envelope, including when a binary/audio operation fails.

## Operator and knowledge flows

Admin routes live under `/v1/admin/*` and cover health, model configuration, session inspection,
memory actions, GM replay, retrieval diagnostics, and embedding reindex operations. Static knowledge
setup is documented in [docs/AVATAR_RAG_SETUP_GUIDE.md](docs/AVATAR_RAG_SETUP_GUIDE.md). Do not use
the removed `memory` knowledge type or put user/session/conversation scope in static metadata.

## Client rules

- Treat public DTOs as contracts, not database rows.
- Keep local state keyed by returned opaque IDs.
- Render the text response even if GM, voice, audio, or optional diagnostics fail.
- Decode SSE frames through the shared contract helpers before applying UI state.
- Do not expose provider credentials, raw prompts, raw vectors, or unbounded diagnostics.

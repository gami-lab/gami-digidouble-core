# Prompt 03 — SSE Event Stream Endpoint

## Objective

Implement `GET /v1/sessions/{sessionId}/events/stream` — an SSE (Server-Sent Events) endpoint
that streams `RuntimeEvent` frames to the connected client for the duration of the connection.

No new use case is needed. The route handler orchestrates session validation + publisher
subscription directly.

---

## Prerequisite Reading

- `docs/API_CONTRACT.md` §4.1 "Stream Session Runtime Events (SSE)" — SSE wire format, semantics
- `apps/core/src/api/routes/sessions.ts` — existing session route file (append here, not a new file)
- `apps/core/src/api/server.ts` — how `sessionEventPublisher` is now wired (from Prompt 02)
- `apps/core/src/application/ports/ISessionEventPublisher.ts` — subscribe/unsubscribe contract

After reading, verify that `ISessionEventPublisher` with `subscribe()` and `isProcessing()` is in
place (from Prompts 01–02).

---

## Fastify SSE Pattern

Fastify does not have built-in SSE support but raw Node.js response streams work reliably.
Use the following pattern — do **not** add any external SSE library.

```ts
// Set SSE headers
reply.raw.setHeader('Content-Type', 'text/event-stream')
reply.raw.setHeader('Cache-Control', 'no-cache')
reply.raw.setHeader('Connection', 'keep-alive')
reply.raw.setHeader('X-Accel-Buffering', 'no') // disable nginx buffering

// Send initial comment (flush headers to client immediately)
reply.raw.write(': keepalive\n\n')

// Subscribe to session events
const unsubscribe = publisher.subscribe(sessionId, (event) => {
  const frame =
    `event: runtime_event\n` + `id: ${event.eventId}\n` + `data: ${JSON.stringify(event)}\n\n`
  reply.raw.write(frame)
})

// Clean up on client disconnect
request.raw.on('close', () => {
  unsubscribe()
})

// Return the raw response to prevent Fastify from closing it
await reply.hijack()
```

> **Important:** `reply.hijack()` tells Fastify not to manage the response lifecycle. After this
> point, the route handler must not return a value. The connection stays open until the client
> disconnects.

---

## Step 1 — Route Handler: `registerStreamRuntimeEventsRoute`

Add a new exported function `registerStreamRuntimeEventsRoute` to
`apps/core/src/api/routes/sessions.ts`.

### Route registration

```
GET /:sessionId/events/stream
```

Authentication: `preHandler: authenticateApiKey(options.config.apiKeySecret)`.

### Handler logic (in order)

1. **Parse params** — extract `sessionId` from `request.params`
2. **Validate session exists** — call `sessionRepository.findById(sessionId)`:
   - If `null`, return `reply.status(404).send(fail('NOT_FOUND', ...))`
   - Use the fallback/injected `sessionRepository` exactly as other route handlers do
3. **Set SSE headers** — see pattern above
4. **Send initial keepalive frame** — `reply.raw.write(': keepalive\n\n')`
5. **Subscribe** to `sessionEventPublisher.subscribe(sessionId, handler)`
6. **Register disconnect handler** — `request.raw.on('close', unsubscribe)`
7. **Hijack** — `await reply.hijack()`

### Error handling rules

- Do **not** use `try/catch` around the subscribe/hijack flow (after headers are sent, the
  connection is live — errors should not produce JSON error bodies)
- The only JSON error response is the 404 before headers are committed
- If `sessionRepository` throws unexpectedly (before hijack), let the Fastify error handler
  produce a 500 (standard pattern)

### Route config

Disable Fastify's request body parsing and response serialization for this route:

```ts
{
  config: { rawBody: true },
  schema: { response: {} },   // opt out of schema serialization
}
```

---

## Step 2 — Call `registerStreamRuntimeEventsRoute` inside the plugin

Alongside other `register*Route` calls at the bottom of the session route plugin.

---

## Step 3 — Optional: Periodic Heartbeat (Phase A deferral)

A periodic heartbeat is listed as optional in the API contract. Do **not** implement a
`setInterval`-based heartbeat in Phase A. The initial `': keepalive\n\n'` frame is sufficient
to flush HTTP headers.

Leave a `// TODO(epic-4-5): add periodic keepalive via setInterval if proxies require it` comment
where the heartbeat would be added.

---

## Step 4 — Unit/Route Tests for the SSE Endpoint

Create `apps/core/src/api/routes/stream-runtime-events.test.ts`.

Testing SSE via `app.inject()` is possible but limited. Use inject for:

| Test                | Expected                                                         |
| ------------------- | ---------------------------------------------------------------- |
| No `x-api-key`      | 401 `UNAUTHORIZED` (before hijack — auth preHandler fires first) |
| Wrong API key       | 401 `UNAUTHORIZED`                                               |
| Unknown `sessionId` | 404 `NOT_FOUND` with `ApiResponse` envelope                      |

For the happy path (connection stays open), use a lightweight approach:

- Use `app.inject()` with `payloadAsStream: true` to observe the response headers
- Assert `Content-Type: text/event-stream` and initial `': keepalive'` in the response body
- Do **not** attempt to simulate full streaming event delivery in route unit tests — that is
  covered by the stack-e2e in Prompt 05

> The in-process publisher allows synchronous event delivery in tests. If you can write a
> deterministic test that subscribes, emits, and reads the frame without real async complexity,
> do so. Otherwise mark it as a TODO for the stack-e2e.

---

## Step 5 — Quality Gates

```bash
pnpm --filter @gami/core typecheck
pnpm --filter @gami/core test
pnpm lint
```

All must pass with zero errors.

---

## Commit

```
feat(epic-4-5): implement SSE runtime event stream endpoint [EPIC-4.5]
```

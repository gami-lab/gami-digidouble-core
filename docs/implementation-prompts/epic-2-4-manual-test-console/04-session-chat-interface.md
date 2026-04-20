# 04 — Session & Chat Interface

## Context

This is the core interaction page of the console. The operator starts a session against the
scenario created in Prompt 03, exchanges messages with the Avatar, views the full history, and
can reset the session to start fresh.

The chat interface must be functional and clear, not polished. The primary concern is that
message ordering, session state, and error handling are correct.

---

## Scope

**In scope**

- `SessionPage` component — start session, chat UI, reset
- Session start form: `userId` input + `startSession` call using `scenarioId` from context
- Chat panel: message list + message input + send button
- History load on session start (`getHistory`)
- Message rendering: user messages and avatar replies distinguished visually
- Reset button: calls `resetSession`, clears local message list, sets `sessionId = null`
- Loading state during `sendMessage` (button disabled, spinner or ellipsis)

**Out of scope**

- Streaming / partial token display
- Message editing or deletion
- Conversation branching
- Auto-scroll optimisations beyond basic anchor scrolling

---

## Relevant Docs

- `docs/API_CONTRACT.md` — `POST /v1/conversations/start`, `POST /v1/conversations/:id/messages`, `GET /v1/conversations/:id/history`, `DELETE /v1/conversations/:id`
- `apps/console/src/api/sessions.ts` — `startSession`, `getHistory`, `resetSession` (Prompt 02)
- `apps/console/src/api/messages.ts` — `sendMessage` (Prompt 02)

---

## Implementation Guidance

### Session start

Fields:

- `userId` (required, text — e.g. "operator-001")

On submit:

1. Call `startSession({ scenarioId, userId })` using `scenarioId` from `TestContext`
2. On success: store `sessionId` in `TestContext`; call `getHistory(sessionId)` to load existing messages (may be empty for a new session)
3. On error: display error message, do not advance to chat

### Local message model

```ts
interface LocalMessage {
  id: string
  role: 'user' | 'avatar'
  content: string
  metadata?: {
    model?: string
    latencyMs?: number
    inputTokens?: number
    outputTokens?: number
  }
}
```

Messages are stored in a `useState<LocalMessage[]>` array. On history load, map the API
response to `LocalMessage[]`. On each new exchange, append immediately:

1. Append the user message optimistically (with a generated local ID)
2. Call `sendMessage(sessionId, { userMessage: content })`
3. On success: append the avatar message with its full metadata

### Chat panel layout

```
┌─────────────────────────────────┐
│  Session: <sessionId>       [Reset] │
├─────────────────────────────────┤
│  user: Hello                   │
│  avatar: Hi there!             │
│  …                             │
├─────────────────────────────────┤
│  [Text input             ][Send] │
└─────────────────────────────────┘
```

- Message list scrolls; keep a `ref` on a bottom sentinel `<div>` and call `scrollIntoView()`
  after each new message
- User messages aligned right, avatar messages aligned left (or distinguished by label prefix)
- Avatar messages rendered with role prefix `Avatar:` and user messages with `You:`

### Reset

Reset button calls `resetSession(sessionId)` and on success:

1. Clears the local message list
2. Sets `sessionId = null` in `TestContext`
3. Returns to the session start form (allow operator to start a new session with the same scenario/avatar)

On error: display error message; do not clear local state (avoid losing the message history on a partial failure).

### Loading state

While `sendMessage` is awaiting:

- Disable the text input and send button
- Show a "…" or spinner in the message area
- Append a `{ role: 'avatar', content: '…', id: 'pending' }` placeholder; replace it on response

---

## Constraints

- `sessionId` from `TestContext` must be set before this page is accessible
- All API calls go through `src/api/index.ts` — no raw `fetch`
- `getHistory` is called on session start, not on every render
- No external chat library or component kit
- TypeScript strict — no `any`

---

## Deliverables

- `apps/console/src/pages/SessionPage.tsx`
- `apps/console/src/App.tsx` updated to render `SessionPage` when `page === 'session'`
- `apps/console/src/TestContext` (or equivalent) updated to include `sessionId`

---

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/PROJECT_STATUS.md` — note chat interface complete

---

## Acceptance Criteria

- [ ] Starting a session calls `POST /v1/conversations/start` and stores the returned `sessionId`
- [ ] History is loaded immediately after session start
- [ ] Sending a message appends both the user message and the avatar reply to the list
- [ ] The send button is disabled while a message is in flight
- [ ] Resetting calls `DELETE /v1/conversations/:id` and returns the UI to the session start form
- [ ] API errors are displayed in the UI (not silently swallowed)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

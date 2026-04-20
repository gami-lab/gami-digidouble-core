# 02 — API Client Layer

## Context

The console needs to call every Core endpoint consumed by the manual test flow. All responses
follow the `ApiResponse<T>` envelope defined in `@gami/shared`. Rather than scattering raw
`fetch` calls across React components, this prompt builds a focused API client module that:

- centralises auth header injection
- maps `ApiResponse<T>` envelopes to typed results
- surfaces API errors as structured values (not exceptions) so the UI can display them clearly
- is the only place that knows about `VITE_API_URL` and `VITE_API_KEY`

All subsequent prompts (03, 04, 05) call this client exclusively — no raw `fetch` outside it.

---

## Scope

**In scope**

- `src/api/client.ts` — base fetch wrapper with `x-api-key` injection, JSON parsing, and `ApiResponse<T>` unwrapping
- Individual typed call functions for each endpoint the console uses:
  - `POST /v1/scenarios` → `createScenario(params)`
  - `POST /v1/scenarios/:scenarioId/avatars` → `createAvatar(scenarioId, params)`
  - `POST /v1/conversations/start` → `startSession(params)`
  - `POST /v1/conversations/:sessionId/messages` → `sendMessage(sessionId, params)`
  - `GET /v1/conversations/:sessionId/history` → `getHistory(sessionId)`
  - `DELETE /v1/conversations/:sessionId` → `resetSession(sessionId)`
- A `ApiError` type wrapping the Core error envelope for structured UI error handling
- Re-use of types from `@gami/shared` wherever they exist; extend locally only for response shapes not yet in shared

**Out of scope**

- Retry logic, caching, request deduplication
- `POST /v1/exchange` (raw exchange — not part of the console test flow)
- Any React hooks or UI components (those are in Prompts 03–05)
- Streaming / SSE endpoints

---

## Relevant Docs

- `docs/API_CONTRACT.md` — full request/response contracts for all endpoints listed above
- `packages/shared/src/api-response.ts` — `ApiResponse<T>`, `ok()`, `fail()`, `ErrorCode`
- `docs/PRINCIPLES.md` — no over-engineering, KISS

---

## Implementation Guidance

### File layout

```
apps/console/src/
  api/
    client.ts        # base fetch wrapper
    scenarios.ts     # createScenario, createAvatar
    sessions.ts      # startSession, getHistory, resetSession
    messages.ts      # sendMessage
    index.ts         # re-export all public API functions
  env.ts             # VITE_API_URL, VITE_API_KEY (from Prompt 01)
```

### Base client

`client.ts` exports a single `coreRequest<T>` function:

```ts
async function coreRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> // throws ApiError on non-2xx or envelope error
```

- Reads `VITE_API_URL` and `VITE_API_KEY` from `env.ts`
- Injects `x-api-key` and `Content-Type: application/json` headers
- Parses response as `ApiResponse<T>`
- If `response.error !== null`, throws an `ApiError` carrying the `code` and `message`
- If response is not ok (e.g. network failure), throws an `ApiError` with code `NETWORK_ERROR`
- Returns `response.data` on success (non-null guaranteed by caller contract)

### ApiError

```ts
class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) { ... }
}
```

Keep it simple. The UI will catch `ApiError` and render `error.code + ': ' + error.message`.

### Typed call functions

Each function in `scenarios.ts`, `sessions.ts`, `messages.ts` wraps `coreRequest` with specific
input/output types derived from `API_CONTRACT.md`. Use the `@gami/shared` types where they
exist. For response shapes not in shared (e.g. `CreateScenarioResponse`), define them locally
in the api module.

Example signature:

```ts
// scenarios.ts
export async function createScenario(params: {
  name: string
  slug: string
  status?: 'draft' | 'active' | 'archived'
  config?: Record<string, unknown>
}): Promise<{
  scenarioId: string
  name: string
  slug: string
  status: string
  createdAt: string
  updatedAt: string
}>
```

### sendMessage response shape

The `sendMessage` response includes `avatarMessage.metadata` with `model`, `latencyMs`,
`inputTokens`, `outputTokens`. Make sure these fields are typed in the return type — they are
required by Prompt 05 (debug panel).

---

## Constraints

- `coreRequest` is the only place that calls `fetch` in the console
- `ApiError` is the only exception type thrown by the API layer
- No React imports in `src/api/` — it is framework-agnostic
- Strict TypeScript — no `any` in request/response types
- Does NOT throw on successful non-2xx that carries an error envelope — the envelope unwrap handles it

---

## Deliverables

- `apps/console/src/api/client.ts`
- `apps/console/src/api/scenarios.ts`
- `apps/console/src/api/sessions.ts`
- `apps/console/src/api/messages.ts`
- `apps/console/src/api/index.ts`
- `apps/console/src/env.ts` updated if needed

---

## Mandatory Final Step — Documentation Update

After implementation, verify:

- `docs/API_CONTRACT.md` — no changes needed; the client is a consumer of the existing contract
- `docs/PROJECT_STATUS.md` — note API client layer complete (partial EPIC 2.4 progress)

---

## Acceptance Criteria

- [ ] `createScenario`, `createAvatar`, `startSession`, `sendMessage`, `getHistory`, `resetSession` are all exported from `src/api/index.ts`
- [ ] All functions are correctly typed with no `any`
- [ ] `ApiError` is thrown (not a generic `Error`) on all failure paths
- [ ] `VITE_API_KEY` is injected via `x-api-key` header on every call except `/health`
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] Manual test: calling `createScenario({ name: 'Test', slug: 'test-001' })` from browser console returns a typed scenario object (requires Core to be running)

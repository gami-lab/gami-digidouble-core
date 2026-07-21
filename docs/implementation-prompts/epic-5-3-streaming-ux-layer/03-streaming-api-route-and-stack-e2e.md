# Title

Expose The Streaming Message API Route

# Context

Once the streaming send-message core exists, the public API needs an additive route that clients
can call for progressive avatar rendering. The repository already uses SSE for runtime events, so
the lowest-risk transport is an SSE response emitted from a dedicated message-stream endpoint.

This slice exists to expose that route cleanly, preserve the existing JSON send-message route, and
lock the contract with stack-e2e coverage.

# Scope

Implement now:

- add a new public streaming endpoint for sending one message and receiving progressive avatar output
- reuse the existing send-message request body schema
- emit shared/public stream events over `text/event-stream`
- add route-level tests and a required stack-e2e file

Out of scope:

- public web UI behavior
- console migration to streaming
- WebSocket support

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Add an additive route under the conversations surface:
  - `POST /v1/conversations/{conversationId}/messages/stream`
- Keep `POST /v1/conversations/{conversationId}/messages` unchanged for backward compatibility.
- Reuse the current request body contract from `SendMessageRequest` instead of creating a second request DTO.
- Use SSE framing with `Content-Type: text/event-stream`. The web app will consume it via `fetch(...)` and `ReadableStream`, not `EventSource`, because the request is a `POST`.
- Follow the existing raw-response pattern used by `apps/core/src/api/routes/runtime-events.ts`, but keep the route-specific event contract separate from runtime world events.
- Recommended frame shape:
  - one SSE `data:` JSON payload per public stream event
  - stable `event:` label such as `conversation_message`
  - optional `id:` derived from request or sequence if useful for debugging
- Keep application logic out of the route handler. The route should validate, invoke the streaming use case, and translate yielded events to SSE frames.
- Handle client disconnect by aborting the stream and releasing listeners promptly.
- Add route tests for headers, validation, and basic happy-path framing.
- Add `apps/core/src/api/routes/conversation-message-stream.stack-e2e.test.ts`.

The stack-e2e file must cover at minimum:

1. no API key -> `401`
2. wrong API key -> `401`
3. invalid or missing `message.content` -> `400`
4. unknown `conversationId` -> `404` with the correct `ApiResponse` error code
5. happy path -> ordered stream events ending with one canonical completion payload

- If a helper is needed to read SSE frames in stack-e2e tests, keep it local to the test file or a nearby test helper. Do not create a production dependency for test-only stream parsing.

# Constraints

- Respect the current architecture and existing auth hooks.
- KISS, YAGNI, DRY.
- No WebSocket implementation in this EPIC.
- Preserve existing non-streaming route behavior and contracts.
- Every new HTTP endpoint in this slice must have route tests and stack-e2e coverage.

# Deliverables

- new streaming message endpoint
- SSE framing for public message-stream events
- route-level tests
- `conversation-message-stream.stack-e2e.test.ts`

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] `POST /v1/conversations/{conversationId}/messages/stream` exists and is additive.
- [ ] The route reuses the canonical request body contract.
- [ ] SSE frames emit ordered shared/public message-stream events.
- [ ] Client disconnect aborts the stream and cleans up listeners.
- [ ] Route tests cover headers, validation, and framing basics.
- [ ] `apps/core/src/api/routes/conversation-message-stream.stack-e2e.test.ts` covers auth, validation, not-found, and happy path.
- [ ] Documentation is reviewed and updated where needed.

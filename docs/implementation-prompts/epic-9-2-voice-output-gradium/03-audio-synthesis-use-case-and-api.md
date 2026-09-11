# Title

Expose Bounded Audio For A Completed Avatar Message

# Context

The text runtime already persists the cleaned Avatar response and completes the turn before
asynchronous Game Master and memory work. Audio must consume that canonical persisted message so
stage directions and presentation labels cannot accidentally be spoken, and so audio failures can
never roll back a successful text turn.

This slice adds the application flow and the new HTTP endpoint. Because it introduces a new
endpoint, its stack-e2e contract file is mandatory in this same slice.

# Scope

Implement now:

- an application use case that loads a conversation and a persisted message by ID, verifies the
  message belongs to the conversation and is an Avatar message, resolves voice configuration, and
  calls `ITextToSpeechAdapter`
- reuse of the canonical persisted cleaned content; do not create a second speech-specific text
  cleaning algorithm
- typed handling for missing voice configuration, unavailable provider, timeout, quota, invalid
  request, cancellation, and provider-output failures
- additive route:
  `POST /v1/conversations/{conversationId}/messages/{messageId}/audio`
- bounded binary success delivery with documented browser-compatible `Content-Type`, length,
  inline disposition, request/message identity metadata, and any supported duration metadata
- standard `ApiResponse` JSON error envelopes for auth, validation, lookup, and synthesis failures
- route-level tests and
  `apps/core/src/api/routes/conversation-message-audio.stack-e2e.test.ts`

Out of scope:

- changing `POST /v1/conversations/{conversationId}/messages`
- changing the existing text SSE event union
- audio persistence or asset management
- browser UI/playback
- WebSocket or token-synchronized speech

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`
- `docs/TEST_COVERAGE_PLAN.md`

# Implementation Guidance

- Keep lookup, configuration resolution, provider invocation, and failure mapping in application
  services/use cases. Keep Fastify responsible for auth, schema validation, headers, and binary
  serialization only.
- Use the route's message ID as the source of truth. Reject unknown conversations/messages,
  cross-conversation message IDs, user/system messages, and non-completed/unusable records with
  the repository's typed error conventions.
- Do not add audio fields to `messages.metadata` or a new audio table. The response is transient by
  default. Repeated synthesis requests should be deterministic in behavior but need not be cached.
- Keep the request body minimal, such as an optional supported output format. Client input must not
  choose provider credentials, endpoints, or arbitrary provider-native options.
- Map synthesis categories to stable API statuses/codes without leaking provider payloads. The
  text message remains readable and persisted when synthesis fails.
- The stack-e2e file must cover:
  - no API key -> `401`
  - wrong API key -> `401`
  - invalid/unknown format or malformed body -> `400` with `VALIDATION_ERROR`
  - unknown conversation and unknown message -> `404` with `NOT_FOUND`
  - success response content type, non-empty bytes, and message/request metadata when a seeded
    deterministic adapter is available
- If a full success path cannot run because the live stack has no deterministic voice adapter or
  seeded audio configuration, keep the required auth/validation/not-found tests and add a clear
  `// TODO(EPIC-9.2): deferred until ...` comment for the happy path.

# Constraints

- Preserve existing API auth and `ApiResponse` conventions.
- The route must never call a provider SDK directly.
- Text persistence, turn completion, GM scheduling, and memory maintenance must not await this
  endpoint or depend on its result.
- Bound response size and avoid buffering unbounded provider output.
- TypeScript strict mode; no `any`.

# Deliverables

- audio synthesis application use case and composition wiring
- additive binary audio route with documented headers and error mapping
- route tests for success, lookup, validation, failure, and cancellation behavior
- `conversation-message-audio.stack-e2e.test.ts` with required contract coverage
- public API contract updates describing the binary success exception and JSON errors

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md` to confirm audio is not persisted
- `docs/TEST_STRATEGY.md` and `docs/TEST_COVERAGE_PLAN.md`

If no doc changes are needed, explicitly verify that the docs are still accurate. Code, tests, and
docs move together.

# Acceptance Criteria

- [ ] The new endpoint synthesizes only a persisted cleaned Avatar message in the requested conversation.
- [ ] Success returns bounded browser-playable binary audio and documented metadata.
- [ ] All endpoint errors use the standard JSON error envelope and stable codes/statuses.
- [ ] Text-only routes and stream events remain backward compatible.
- [ ] Audio is not persisted and synthesis does not affect GM/memory scheduling.
- [ ] Required route and stack-e2e tests exist and pass or carry the permitted explicit TODO.
- [ ] Documentation has been reviewed and updated where needed.

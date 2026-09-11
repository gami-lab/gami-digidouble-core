# Add Authenticated Voice HTTP Routes And Stack-E2E Contracts

## Context

The Core is API-first and currently accepts JSON text plus JSON-to-SSE message streams. This slice
adds a narrow binary voice boundary while preserving the existing response contracts and auth
rules. New HTTP endpoints must be tested at the real stack boundary in the same Epic.

## Scope

Implement and test the public voice routes using the application flow from Prompt 03.

Use additive route names aligned with the existing conversation routes:

- `POST /v1/conversations/{conversationId}/voice-messages` → `ApiResponse<SendMessageResponse>`;
- `POST /v1/conversations/{conversationId}/voice-messages/stream` → existing `MessageStreamEvent` SSE frames.

The exact binary transport may be `audio/*` or `application/octet-stream` with explicit headers,
but it must be documented and consistently validated. Include an opaque required utterance ID and
optional language/duration metadata only if the contract from Prompt 01 supports them.

Include:

- Fastify raw-body/content-type handling with strict byte and media limits;
- existing API-key auth and standard `ApiResponse` error envelopes;
- `400 VALIDATION_ERROR` for empty/unsupported/oversized/malformed audio, invalid language/metadata, and missing required identity;
- `404 NOT_FOUND` for unknown conversations with the standard error code;
- typed mapping for timeout/provider/cancellation/duplicate failures to the existing error-code vocabulary;
- SSE headers, framing, event order, interruption cleanup, and no partial Avatar persistence;
- route-level tests and the mandatory `apps/core/src/api/routes/voice-messages.stack-e2e.test.ts` file.

Out of scope:

- changing existing `/messages` or `/messages/stream` JSON contracts;
- multipart upload unless the dependency is justified and documented;
- browser microphone recording, audio playback, or UI work;
- raw audio persistence, downloads, or admin audio inspection.

## Relevant Docs

- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/TECH_STACK.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/PROJECT_STATUS.md`
- `docs/EPICS.md` (Epic 9.1)
- `apps/core/src/api/routes/conversations.ts`
- `apps/core/src/api/routes/conversation-message-stream.stack-e2e.test.ts`
- `apps/core/src/api/routes/exchange.stack-e2e.test.ts`
- `apps/core/src/api/server.ts`
- `apps/core/src/api/hooks/authenticate.ts`

## Implementation Guidance

- Mirror the existing conversation route registration and dependency injection style; keep route handlers thin and provider/application agnostic.
- Reuse `mapSendMessageResponse`, `MessageStreamEvent`, SSE framing, error mapping, and auth behavior where possible instead of introducing parallel response shapes.
- Resolve the Fastify raw-body behavior before writing the route. Tests must cover content-type, empty body, content-length/actual-size limits, and parser failures without allowing a large body to reach Deepgram.
- Treat a client-supplied duration as a validation hint only; enforce authoritative provider-reported duration when available. Do not claim duration enforcement if the chosen transport cannot measure or safely obtain it.
- For stack-E2E, follow the same live HTTP setup as `exchange.stack-e2e.test.ts` and the existing stack preflight. Cover both new routes or document a single route family helper that proves each route's contract.
- The required always-on cases are: no API key → `401`, wrong API key → `401`, invalid/missing audio metadata/body → `400`, unknown conversation with otherwise valid-shaped audio → `404` and `error.code === 'NOT_FOUND'`. If successful provider-backed data is unavailable, skip only the happy path with a clear `// TODO(EPIC-9.1): deferred until ...` comment.

## Constraints

- Keep API → Application → Domain → Infrastructure boundaries intact.
- Do not log body bytes, audio content, transcript text, provider payloads, or credentials.
- Keep the existing text routes and response/stream event contracts unchanged.
- Use explicit route schemas/limits and strict TypeScript; do not rely on unchecked casts.
- Every new HTTP endpoint owns its route tests and stack-E2E coverage in this Epic.

## Deliverables

- Voice route plugin and server composition wiring.
- Binary request parsing/validation and safe error mapping.
- Synchronous and streaming route tests.
- `apps/core/src/api/routes/voice-messages.stack-e2e.test.ts` with required auth, validation, not-found, and available success coverage.
- Updated shared exports only if a public voice contract genuinely requires them.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts, especially `Message`, `SendMessageRequest`, `SendMessageResponse`, `MessageStreamEvent`, and any new voice request metadata.
2. Search for duplicated type definitions, repeated inline response shapes, local copies in console/client/evaluation code, inconsistent optionality/nullability, and field-name drift across layers.
3. Identify the canonical owner of each contract and compare the existing `/messages` and `/messages/stream` route behavior before adding voice variants.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one; do not add a second local copy.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/API_CONTRACT.md` with exact voice route, media, headers, limits, response, error, and cancellation contracts
- `docs/ARCHITECTURE.md` if the API/application flow map changed
- `docs/TECH_STACK.md` if raw-body/multipart support or a dependency was added
- `docs/TEST_STRATEGY.md` and `docs/TEST_COVERAGE_PLAN.md` for the required stack-E2E matrix
- deployment docs and `.env.example` for required voice configuration
- `docs/EPICS.md` if Epic progress changed

If no additional documentation changes are needed, explicitly verify that the docs remain accurate.
Code, tests, and docs move together.

## Acceptance Criteria

- [ ] Both voice routes are authenticated and use documented bounded binary input.
- [ ] Missing/wrong auth, invalid input, and unknown conversation responses match required status/error envelopes.
- [ ] Synchronous voice success returns the canonical `SendMessageResponse` shape.
- [ ] Streaming voice success emits canonical ordered message events and exactly one terminal event.
- [ ] Route cancellation/interruption does not persist partial Avatar output or trigger post-turn work.
- [ ] `voice-messages.stack-e2e.test.ts` exists at the required path and covers both auth cases, validation, resource-not-found, and a gated/deferred success path as appropriate.
- [ ] Existing text endpoint tests continue to pass unchanged.
- [ ] Documentation was reviewed and updated before declaring the slice complete.

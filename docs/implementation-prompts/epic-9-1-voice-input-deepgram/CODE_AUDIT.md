# Code Audit — EPIC 9.1 Voice Input Integration With Deepgram

## Scope audited

Audited the implementation and tests for the voice-input path in `apps/core`, with emphasis on the route layer, the voice-turn application flow, the Deepgram adapter, and the epic-specific documentation and stack E2E coverage.

## Executive Summary

The EPIC is substantially implemented and the core path is clean: raw audio is normalized at the boundary, transcription is provider-neutral, the finalized transcript flows through the existing conversation turn pipeline, and the Deepgram adapter stays confined to infrastructure. Lint, typecheck, unit/integration tests, and coverage all pass.

The remaining gaps are not architectural drift; they are proof and operational gaps. The live-stack happy path is still TODO for both voice route variants, the synchronous route does not propagate client disconnect cancellation, and the idempotency store is still process-local. Those issues keep the EPIC below a clean close.

## Final Grade

C

## Build Health

- lint: PASS
- typecheck: PASS
- tests: PASS
- coverage: PASS (`pnpm test:coverage` passed; detailed report generated)

## Feature Confidence Matrix

| Feature                    | Expected Behavior                                                                                 | Evidence                                                                                                                                                | Confidence (High/Medium/Low) | Notes                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| Sync voice HTTP route      | Valid raw audio becomes one normal `SendMessageResponse` turn or a typed API error                | `apps/core/src/api/routes/voice-messages.ts`, `apps/core/src/api/routes/voice-messages.test.ts`                                                         | Medium                       | Route-level behavior is well covered, but client-disconnect cancellation is missing on the sync path. |
| Streaming voice HTTP route | Valid raw audio streams the canonical `MessageStreamEvent` sequence and cleans up on interruption | `apps/core/src/api/routes/voice-messages.ts`, `apps/core/src/api/routes/voice-messages.test.ts`                                                         | High                         | Unit/in-process coverage is strong; live-stack success is still TODO.                                 |
| Deepgram adapter           | Final transcript only, bounded failures, and redacted observability                               | `apps/core/src/infrastructure/speech/deepgram-speech-to-text.adapter.ts`, `apps/core/src/infrastructure/speech/deepgram-speech-to-text.adapter.test.ts` | High                         | Good provider boundary discipline and good failure mapping.                                           |
| Voice-turn use case        | Reserve utterance identity once, transcribe once, then delegate into existing turn flow           | `apps/core/src/application/use-cases/voice-turn/voice-turn.use-case.ts`, `apps/core/src/application/use-cases/voice-turn/voice-turn.use-case.test.ts`   | High                         | The orchestration slice is deterministic and well tested.                                             |
| Live-stack nominal success | Real HTTP stack proves the voice happy path for sync and streaming routes                         | `apps/core/src/api/routes/voice-messages.stack-e2e.test.ts`                                                                                             | Low                          | Both success cases are still `todo`, so the production-stack nominal flow is unproven.                |

## Strengths

- The implementation keeps provider details out of domain and application contracts.
- The Deepgram adapter has focused tests for request construction, final-transcript normalization, typed failures, timeout/cancellation handling, and observability redaction.
- The route and use-case tests verify consumer-visible behavior rather than private internals.
- The streaming path has interruption cleanup coverage, which is the right risky behavior to protect.
- The repository-wide quality gates are green.

## Findings

### 1. Live-stack success is still TODO for the synchronous voice route

- Severity: Medium
- Category: Test Coverage
- Problem: `apps/core/src/api/routes/voice-messages.stack-e2e.test.ts` still has a TODO for the synchronous provider-backed success path.
- Why it matters: the nominal production-stack request/response flow is the highest-value contract for this EPIC, and it is not yet proven against the real stack.
- Evidence: `apps/core/src/api/routes/voice-messages.stack-e2e.test.ts:100-104`
- Recommendation: add a deterministic audio fixture or a gated provider-backed stack test that asserts the synchronous success path end to end.

### 2. Live-stack success is still TODO for the streaming voice route

- Severity: Medium
- Category: Test Coverage
- Problem: the streaming provider-backed success path is also still a TODO in the stack E2E file.
- Why it matters: the streaming route is a separate public contract with its own framing, interruption, and completion behavior, so it needs its own live-stack proof.
- Evidence: `apps/core/src/api/routes/voice-messages.stack-e2e.test.ts:100-104`
- Recommendation: add a live-stack SSE success assertion that verifies ordered frames and the terminal event for `/voice-messages/stream`.

### 3. The synchronous route does not propagate client disconnect cancellation

- Severity: High
- Category: Operational Behavior
- Problem: the synchronous route calls `voiceTurnUseCase.execute(buildVoiceInput(request))` directly and never installs the abort wiring that the streaming route uses.
- Why it matters: if the client disconnects during transcription or turn execution, the work can continue unnecessarily and may still persist a turn after the caller has gone away.
- Evidence: `apps/core/src/api/routes/voice-messages.ts:52-68` compared with `apps/core/src/api/routes/voice-messages.ts:71-139`
- Recommendation: wire a request-abort signal into the synchronous path and add a route test that proves disconnect stops the voice work.

### 4. Voice idempotency is still process-local

- Severity: Medium
- Category: Operational / Architecture
- Problem: production composition still injects `InMemoryUtteranceIdempotencyStore`.
- Why it matters: duplicate voice submissions are only protected inside one process; horizontal scaling or failover can re-open duplicate execution races.
- Evidence: `apps/core/src/index.ts:123-127`
- Recommendation: move the voice reservation store behind a shared Redis implementation before the EPIC is treated as horizontally safe, or explicitly scope the deployment to a single instance.

### 5. The streaming HTTP duplicate/conflict path is not covered at the route boundary

- Severity: Low
- Category: Test Coverage
- Problem: the duplicate-utterance route test covers only the synchronous endpoint; there is no equivalent HTTP-level conflict test for `/voice-messages/stream`.
- Why it matters: the streaming route is a separate public surface and can regress independently even if the synchronous route stays correct.
- Evidence: `apps/core/src/api/routes/voice-messages.test.ts:346-360`
- Recommendation: add a stream-route duplicate/replay test that asserts `409 CONFLICT` and verifies no second transcription or user-message persistence.

## Architecture Review

The architecture is mostly aligned with the target core design. The route layer owns HTTP parsing and auth, the application layer owns orchestration, the speech adapter is confined to infrastructure, and the domain/application contracts remain provider-neutral. There is no obvious SDK leakage into business logic.

The main architectural weakness is not layering drift; it is deployment completeness. The in-memory idempotency store is acceptable as a local bootstrap choice, but it is not a production-safe multi-instance primitive. The sync disconnect gap is also a real operational asymmetry between the two voice routes.

## Test Review

Strong tests:

- `apps/core/src/infrastructure/speech/deepgram-speech-to-text.adapter.test.ts` proves request shape, final-result parsing, provider failure translation, timeout/cancellation behavior, and observability redaction.
- `apps/core/src/application/use-cases/voice-turn/voice-turn.use-case.test.ts` proves reservation semantics, transcript normalization, cancellation phases, and delegation into the existing turn flow.
- `apps/core/src/api/routes/voice-messages.test.ts` covers auth, validation, not-found, provider failure mapping, duplicate utterance handling, and stream interruption cleanup.

Weak tests:

- The stack E2E file stops at auth/validation/not-found and leaves both happy paths as TODO.
- The synchronous route has no disconnect test, so the cancellation asymmetry is unproven at the API boundary.
- The streaming route duplicate/conflict path is not tested at the route boundary.

Missing tests:

- Live-stack synchronous success.
- Live-stack streaming success.
- Sync-route disconnect cancellation.
- Stream-route duplicate utterance conflict.

Implementation-coupled tests:

- None of the important voice tests look implementation-mirroring in a harmful way. The better ones assert consumer-visible behavior, not private internals.

## Documentation Gaps

- `docs/PROJECT_STATUS.md` should explicitly mention that the live-stack voice success cases are still TODO, or it should be updated after those tests land.
- The deployment/runtime docs should spell out the current single-instance limitation of the in-memory voice idempotency store if that remains the intended temporary state.
- `docs/API_CONTRACT.md` is mostly aligned, but it should only keep the disconnect/cancellation promise if the synchronous route actually enforces it.

## Path to A

1. Add live-stack success coverage for both voice routes.
2. Wire request-disconnect cancellation into the synchronous route.
3. Move utterance idempotency to a shared Redis-backed store, or make the single-instance limitation explicit in deployment docs.
4. Add the missing streaming duplicate/conflict route test.
5. Keep `docs/PROJECT_STATUS.md`, `docs/API_CONTRACT.md`, and the epic README synchronized with the final behavior.

## Final Recommendation

Rework before close

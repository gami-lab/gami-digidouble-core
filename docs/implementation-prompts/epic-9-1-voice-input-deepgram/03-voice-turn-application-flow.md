# Route Finalized Voice Transcripts Through The Existing Turn Flow

## Context

Voice input must preserve the Core's established behavior. Once transcription succeeds, the
result is just a validated user utterance: existing message persistence, context assembly, Avatar
generation, memory maintenance, streaming cleanup, and asynchronous Game Master scheduling remain
the owners of the turn.

## Scope

Implement the application service/use-case boundary that coordinates speech-to-text with the
existing synchronous and streaming conversation turn flows.

Include:

- an application-owned voice-turn use case or thin orchestration service that accepts conversation ID, bounded audio input, utterance ID, optional language, and cancellation;
- conversation/resource validation before or at the same safe point as transcription, without leaking whether an unauthorized caller guessed a resource through the route's existing auth behavior;
- finalized transcript normalization and handoff to `SendMessageUseCase` for JSON response behavior;
- finalized transcript handoff to `StreamingSendMessageUseCase` for SSE Avatar response behavior;
- duplicate/in-flight/completed submission handling with an explicit idempotency boundary and no duplicate user message, Avatar call, memory update, or GM scheduling;
- cancellation propagation to transcription and downstream LLM stream, with no partial Avatar persistence and no post-turn work on an incomplete turn;
- bounded voice observability that correlates transcription and conversation request IDs without recording raw audio or transcript content;
- unit/integration-style tests proving voice and text turns have equivalent downstream behavior after transcript handoff.

Out of scope:

- Deepgram provider implementation;
- Fastify raw-body parsing and public route registration;
- browser microphone capture or UI controls;
- changing the canonical `Message` shape solely to mark modality;
- changes to GM state, memory policy, or Avatar prompting.

## Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/PROJECT_STATUS.md`
- `apps/core/src/application/use-cases/send-message/send-message.use-case.ts`
- `apps/core/src/application/use-cases/send-message/streaming-send-message.use-case.ts`
- `apps/core/src/application/use-cases/send-message/streaming-send-message.types.ts`

## Implementation Guidance

- Keep the voice service a coordinator. It should transcribe, validate the finalized text, then invoke the existing turn use case rather than copy its prompt, persistence, memory, retrieval, or GM logic.
- Preserve the existing `SendMessageOutput`, `SendMessageResponse`, and `MessageStreamEvent` contracts. Voice-specific input metadata belongs in the application/observability boundary unless an additive public field is proven necessary.
- Use the existing `AbortSignal` conventions. A cancellation before final transcription must not enter the message path; cancellation during an existing stream must preserve its current interruption semantics.
- Define idempotency state at an application port or existing cache boundary. Do not add a database table unless the current deployment model proves a process-local or existing Redis-backed boundary insufficient; if persistence is required, update the data model and migration plan in the same slice.
- Ensure a failed or cancelled transcription does not create a partial user message. Once the transcript is handed to the existing send-message path, its established user-message-first semantics apply.
- Keep the text route unchanged and fully usable when the voice adapter is unavailable.

## Constraints

- Application coordinates; it does not call Deepgram SDKs, Fastify, SQL, or Redis clients directly.
- Existing Avatar/GM/memory ownership and async non-blocking semantics are mandatory.
- No transcript duplication into a new message type or alternate persistence repository.
- No raw transcript/audio in diagnostics; only bounded lengths, duration, outcome, and safe IDs.
- Maintain backward compatibility for existing text and message-stream clients.

## Deliverables

- Voice-turn application service/use case and composition wiring.
- Idempotency/cancellation integration at the correct port boundary.
- Unit tests for success, interim rejection, invalid transcript, duplicate, timeout/provider failure propagation, pre-transcription cancellation, and downstream stream interruption.
- Integration-style tests proving one voice turn produces one normal user message and the same Avatar/GM/memory path as a typed turn.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts, especially `Message`, `SendMessageInput`, `SendMessageOutput`, `SendMessageResponse`, and `MessageStreamEvent`.
2. Search for duplicated type definitions, repeated inline response shapes, local copies in console/client/evaluation code, inconsistent optionality/nullability, and field-name drift across layers.
3. Identify the canonical owner of each contract and trace the current synchronous and streaming turn paths before adding a coordinator.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one; do not add a second local copy.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/ARCHITECTURE.md` for the application voice-turn boundary
- `docs/API_CONTRACT.md` if the application exposes new public semantics
- `docs/DATA_MODEL.md` if idempotency state is persisted
- `docs/GAME_MASTER_CONTRACT.md` and `docs/MEMORY_SYSTEM_SPEC.md` if their unchanged ownership is clarified or behavior changed
- `docs/TEST_STRATEGY.md` and `docs/TEST_COVERAGE_PLAN.md` for voice-turn/cancellation/idempotency coverage
- `docs/EPICS.md` if Epic progress changed

If no additional documentation changes are needed, explicitly verify that the docs remain accurate.
Code, tests, and docs move together.

## Acceptance Criteria

- [ ] Finalized transcript handoff uses the existing synchronous and streaming send-message use cases.
- [ ] Voice-created turns receive normal persistence, context, Avatar, memory, and async GM behavior without duplicated orchestration.
- [ ] Interim, blank, invalid, failed, timed-out, and cancelled transcription never creates a user turn.
- [ ] Duplicate utterance IDs cannot cause duplicate messages, Avatar calls, or background work.
- [ ] Cancelled streams do not persist partial Avatar content or schedule post-turn work.
- [ ] Text routes and existing stream contracts remain backward compatible.
- [ ] Tests prove the stated behavior with deterministic fakes and no provider credentials.
- [ ] Documentation was reviewed and updated before declaring the slice complete.

# Define Provider-Neutral Voice Contracts And Limits

## Context

Epic 9.1 needs to accept audio without making Deepgram a domain dependency or creating a parallel
message model. The repository already separates `@gami/shared` HTTP DTOs, Core application ports,
domain conversation entities, and infrastructure adapters. This slice establishes the smallest
stable contract before provider or route work begins.

## Scope

Implement the provider-neutral speech-to-text boundary and the deterministic validation policy for
one finalized utterance.

Include:

- an application-owned `ISpeechToTextAdapter` (or the repository's equivalent naming) with bounded audio input metadata, cancellation, optional language, and a finalized transcript result;
- finite typed failures for invalid audio, unsupported media, size/duration limits, timeout, provider failure, malformed/non-final transcription, and cancellation;
- explicit input limits for bytes, duration, transcript length, accepted media types, language format, and idempotency/utterance ID;
- a provider-neutral idempotency key/utterance identity contract that can prevent two user messages from the same `(conversationId, utteranceId)`;
- a deterministic test fake and focused unit tests for normalization, limits, failure mapping, and final-versus-interim semantics;
- only additive public shared types if a caller must observe a stable request/result shape. Prefer headers/raw-body metadata for binary transport and do not mirror internal adapter objects into `@gami/shared` unnecessarily.

Out of scope:

- Deepgram SDK calls;
- HTTP route registration or browser recording;
- raw-audio persistence, audio playback, full-duplex sessions, or barge-in;
- changes to `Message` unless provenance is demonstrably required by an existing contract. Observability can identify the input modality without changing the persisted message shape.

## Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/PROJECT_STATUS.md`
- `docs/EPICS.md` (Epic 9.1)

## Implementation Guidance

- Keep the port in `apps/core/src/application/ports/`; keep audio value types and pure normalization rules in a small voice/domain or application-owned module that does not import Fastify or Deepgram.
- Model the adapter input as bounded bytes plus validated MIME type, optional client language, duration when known, and an opaque utterance ID. Do not accept an unbounded `Buffer` or arbitrary metadata record.
- Make the result distinguish a finalized transcript from any interim result. The application flow must accept only a finalized, non-blank normalized transcript.
- Decide and document idempotency behavior for in-flight, completed, expired, and conflicting duplicate submissions. The invariant is no duplicate persisted user turn and no duplicate Avatar/GM work; returning a safe conflict is acceptable when a replay result is not retained.
- Prefer existing error-envelope/error-mapping conventions. Do not add provider names or SDK error payloads to domain failures.
- If a new shared contract is needed, derive it from existing `Message`, `SendMessageRequest`, `SendMessageResponse`, and stream contracts rather than copying their shapes.

## Constraints

- Respect API → Application → Domain → Infrastructure boundaries.
- Keep Core headless and provider-neutral.
- Use KISS, YAGNI, DRY, strict TypeScript, and explicit finite unions.
- Do not persist raw audio or introduce a new conversation/message persistence path.
- Preserve existing text route contracts and message metadata optionality.
- Do not knowingly add contract duplication across Core, `@gami/shared`, console, web, admin, or evaluation tooling.

## Deliverables

- Provider-neutral speech-to-text port and result/failure types.
- Pure audio/transcript/idempotency validation helpers with unit tests.
- Deterministic fake adapter usable by later application and route tests.
- A short contract note or comments only where necessary to explain limits and duplicate semantics.
- Any required shared exports, with no unrelated DTO changes.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts, especially `Message`, `SendMessageRequest`, `SendMessageResponse`, and `MessageStreamEvent`.
2. Search for duplicated type definitions, repeated inline response shapes, local copies in console/client/evaluation code, inconsistent optionality/nullability, and field-name drift across layers.
3. Identify the canonical owner of each contract: `@gami/shared` for public HTTP shapes, Core domain for internal conversation entities, and Core application ports for provider-neutral capabilities.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one; do not add a second local copy.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/API_CONTRACT.md` if public/shared contract behavior changed
- `docs/ARCHITECTURE.md` if the voice port or layer map changed
- `docs/DATA_MODEL.md` if persistence or idempotency storage was introduced
- `docs/TEST_STRATEGY.md` and/or `docs/TEST_COVERAGE_PLAN.md` if new test obligations were established
- `docs/TECH_STACK.md`, `docs/EPICS.md`, or deployment docs if configuration or roadmap status changed

If no additional documentation changes are needed, explicitly verify that the docs remain accurate.
Code, tests, and docs move together.

## Acceptance Criteria

- [ ] The port contains no Deepgram import, provider SDK type, HTTP framework type, or raw provider payload.
- [ ] Audio, transcript, language, duration, byte-size, and utterance-ID validation is bounded and deterministic.
- [ ] Blank, interim, malformed, over-limit, and cancelled results cannot become user messages.
- [ ] Failure categories are finite, typed, and safe to expose to the application/API mapper.
- [ ] Duplicate semantics guarantee at-most-once conversation-turn execution for one utterance identity.
- [ ] Unit tests cover valid final input, all invalid/limit paths, cancellation, and duplicate behavior.
- [ ] Existing public message contracts remain unchanged unless an additive, justified field is required.
- [ ] Documentation was reviewed and updated before declaring the slice complete.

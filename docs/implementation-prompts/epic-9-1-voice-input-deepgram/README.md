# EPIC 9.1 - Voice Input Integration With Deepgram

## Objective

Add an utterance-based voice-input path to the headless Core. A client submits one bounded audio
utterance, Core validates it, transcribes it through a provider-neutral speech-to-text port and
Deepgram infrastructure adapter, and sends only the finalized transcript through the existing
conversation turn flow. The existing synchronous and streaming Avatar, memory, Game Master, and
text-message behavior remains the source of truth.

This pack assumes the Core owns the binary voice HTTP boundary in this repository. A deployment
may place recording or transport at an adjacent voice edge later, but it must reuse the same
provider-neutral application contract and must not introduce a second conversation-turn path.

Generated: 2026-09-11

## Execution Order

| Order | Prompt                                   | Outcome                                                                                                                             |
| ----- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `01-voice-contracts-and-limits.md`       | Establish provider-neutral audio, transcript, failure, language, idempotency, and bounded-limit contracts.                          |
| 2     | `02-deepgram-adapter-and-composition.md` | Implement and compose the Deepgram adapter without leaking SDK/provider details upward.                                             |
| 3     | `03-voice-turn-application-flow.md`      | Route finalized transcripts through the existing synchronous and streaming turn use cases with safe cancellation and deduplication. |
| 4     | `04-voice-http-routes-and-stack-e2e.md`  | Add the authenticated binary voice routes, wire raw-body parsing, and provide mandatory stack-E2E contract coverage.                |
| 5     | `05-hardening-tests-and-doc-sync.md`     | Close failure/security/observability gaps, run verification, and synchronize all source-of-truth documentation.                     |

## Dependencies

- Prompt 01 precedes every implementation prompt because it owns the contracts and limits used by the adapter, use case, and API.
- Prompt 02 depends on the port and failure model from Prompt 01 and must finish production composition before Prompt 03.
- Prompt 03 depends on a deterministic speech-to-text fake and defines the single transcript-to-turn boundary consumed by Prompt 04.
- Prompt 04 depends on the application flow and must add the route-level and stack-E2E tests in the same EPIC; endpoint test coverage is not deferred.
- Prompt 05 is last and may adjust earlier slices when verification exposes contract drift or unsafe diagnostics.

## Suggested Execution

Run the prompts in order. Keep the implementation additive: retain the existing JSON text routes,
reuse `SendMessageUseCase` and `StreamingSendMessageUseCase`, and do not persist raw audio. Use
deterministic injected fakes for all unit and in-process route tests; live Deepgram checks are
optional and environment-gated.

## Definition Of Done

- [ ] A client can submit one valid bounded audio utterance and receive the normal Avatar response.
- [ ] A finalized transcript becomes exactly one validated user message and follows the existing persistence, context, memory, and async GM behavior.
- [ ] Interim/non-final transcript data never creates a message or triggers Avatar/GM work.
- [ ] Invalid audio, unsupported media, over-limit input, timeout, provider failure, malformed transcription, duplicate submission, and cancellation have typed, safe outcomes.
- [ ] Synchronous and streaming voice paths reuse the existing conversation turn contracts; partial or cancelled turns do not persist an Avatar message or schedule post-turn work.
- [ ] Deepgram credentials, SDK types, raw audio, raw provider payloads, and transcript content are excluded from logs/events/traces except where an existing public response intentionally returns the finalized user message.
- [ ] Text interaction remains fully functional when voice configuration is absent or unavailable.
- [ ] Optional language selection is validated and does not leak provider-specific fields into domain contracts.
- [ ] New HTTP endpoints have route tests and `apps/core/src/api/routes/voice-messages.stack-e2e.test.ts` coverage for missing/wrong API keys (`401`), invalid input (`400`), and unknown conversations (`404` with `NOT_FOUND`).
- [ ] `docs/PROJECT_STATUS.md` and all impacted architecture, API, data-model, testing, deployment, and EPIC documentation are accurate.

# EPIC 9.2 — Voice Output Integration With Gradium

## Objective

Let supported clients hear a completed Avatar response in its configured voice while keeping
cleaned text as the source of truth. Audio synthesis must remain provider-neutral at the Core
boundary, must not block text turn completion or asynchronous Game Master/memory work, and must
degrade safely to text when unavailable.

## Generated

2026-09-11

## Baseline And Design Decision

The repository already ships synchronous and SSE text conversation flows, canonical shared
conversation contracts, and the cleaned Avatar response path. It has no voice-output port,
Gradium adapter, voice configuration, or audio delivery contract.

This pack uses a small first increment: after a text turn has completed and its Avatar message is
persisted, a client may call:

`POST /v1/conversations/{conversationId}/messages/{messageId}/audio`

The route returns bounded browser-playable audio as a binary response. It does not add audio to
message persistence, does not replace text streaming, and does not attempt token-level speech
synchronization. JSON error responses continue to use the standard `ApiResponse` envelope.

## Ordered Execution List

| #   | File                                            | Purpose                                                                                                      |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 0   | `00-contract-cleanup.md`                        | Audit touched Avatar/Scenario/Message/client contracts and establish canonical voice/audio ownership         |
| 1   | `01-voice-contracts-and-configuration.md`       | Add provider-neutral voice configuration, client audio options, persistence mapping, and validation          |
| 2   | `02-text-to-speech-port-and-gradium-adapter.md` | Add the TTS port, typed failures, Gradium infrastructure adapter, cancellation, and safe configuration       |
| 3   | `03-audio-synthesis-use-case-and-api.md`        | Synthesize persisted cleaned Avatar messages and expose the binary delivery endpoint with stack-e2e coverage |
| 4   | `04-web-audio-playback-and-text-fallback.md`    | Add browser playback, cancellation, cleanup, accessibility, and non-blocking text fallback                   |
| 5   | `05-hardening-tests-and-doc-sync.md`            | Close concurrency, observability, regression, provider-fake, and full documentation gaps                     |

## Dependencies And Suggested Order

Run prompts in order: `00 -> 01 -> 02 -> 03 -> 04 -> 05`.

- `01` depends on the ownership decisions from `00`.
- `02` depends on the provider-neutral contracts from `01`.
- `03` depends on `01` and `02`; it owns the new HTTP endpoint and its required stack-e2e file.
- `04` depends on the public binary delivery contract from `03`.
- `05` runs last and must not declare the EPIC complete until all prior slices and documentation
  are verified.

## Definition Of Done For The Full EPIC

- [x] Avatar and Scenario voice configuration has one canonical provider-neutral contract.
- [x] Client audio preferences are additive and do not force audio on existing text-only clients.
- [x] Gradium access is isolated behind `ITextToSpeechAdapter` and provider credentials never leak.
- [x] A completed persisted cleaned Avatar message can be delivered as bounded browser-playable audio.
- [x] Stage directions and presentation-only labels are never synthesized.
- [x] Text persistence, turn completion, GM scheduling, and memory maintenance are independent of audio.
- [x] Cancellation, client disconnect, timeout, quota, malformed-provider-output, and unavailable
      provider cases release resources and preserve text fallback.
- [x] Audio is not persisted with conversation messages by default.
- [x] Synthesis diagnostics record safe latency, duration when supplied, format, outcome, and failure category
      without raw provider payloads, credentials, or unnecessary response text.
- [x] Deterministic adapter fakes cover unit and integration behavior; live Gradium credentials are
      not required for the default suite.
- [x] The new audio route has route tests and `conversation-message-audio.stack-e2e.test.ts`
      covering auth, validation, not-found, and an available success path or a clearly documented TODO.
- [x] `docs/PROJECT_STATUS.md` and every impacted architecture, API, data-model, testing, stack,
      and EPIC document are synchronized; `9.2 Voice Output Integration with Gradium` is marked done
      only after the implementation is actually shipped.

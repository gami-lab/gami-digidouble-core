# EPIC 5.3 — Streaming UX Layer

## Objective

Ship progressive avatar-response streaming for the public player experience without breaking the
existing synchronous conversation API. The implementation should use the repository's existing SSE
patterns, keep shared contracts canonical, and let the public web app render avatar replies as
they form.

## Generated

2026-07-21

## Dependencies Between Prompts

- `00-contract-cleanup.md` is mandatory before feature work because this EPIC touches existing
  Session, Conversation, Message, and streaming client contracts.
- `01-streaming-contracts-and-llm-port.md` defines the canonical streaming contract and provider
  abstraction required by all later slices.
- `02-streaming-send-message-core.md` depends on `01` and should extract shared send-message logic
  before adding the streaming path.
- `03-streaming-api-route-and-stack-e2e.md` depends on `02`.
- `04-public-web-progressive-chat.md` depends on `03`.
- `05-hardening-and-doc-sync.md` must run last.

## Ordered Execution List

| #   | File                                      | Purpose                                                                                |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| 0   | `00-contract-cleanup.md`                  | Remove streaming-contract duplication and define canonical owners before behavior work |
| 1   | `01-streaming-contracts-and-llm-port.md`  | Add shared token-stream contracts and extend the internal LLM port for streaming       |
| 2   | `02-streaming-send-message-core.md`       | Build a streaming send-message execution path on top of shared conversation logic      |
| 3   | `03-streaming-api-route-and-stack-e2e.md` | Expose the public streaming endpoint and cover it with route plus stack-e2e tests      |
| 4   | `04-public-web-progressive-chat.md`       | Render streamed avatar replies progressively in `apps/web`                             |
| 5   | `05-hardening-and-doc-sync.md`            | Close the EPIC with interruption hardening, regression coverage, and full doc sync     |

## Suggested Execution Order

`00 -> 01 -> 02 -> 03 -> 04 -> 05`

## Definition Of Done For Full EPIC

- [ ] Canonical ownership exists for all message-stream request, event, and completion contracts.
- [ ] No new streaming DTO duplication exists across `apps/core`, `apps/web`, `apps/console`, and `packages/shared`.
- [ ] The internal LLM abstraction supports ordered token streaming without bypassing the provider wrapper.
- [ ] A new additive public endpoint streams avatar replies progressively without breaking `POST /v1/conversations/{conversationId}/messages`.
- [ ] Streamed chunks arrive in order and complete with one canonical final payload.
- [ ] Client interruption is handled cleanly with deterministic cleanup and no orphaned listeners.
- [ ] `apps/web` renders optimistic user messages plus progressive avatar output.
- [ ] Every new HTTP endpoint has a matching `*.stack-e2e.test.ts` file with auth, validation, and not-found coverage.
- [ ] `docs/PROJECT_STATUS.md` and every impacted contract/architecture/testing doc are updated.
- [ ] EPIC `5.3 Streaming UX Layer` is marked complete in `docs/EPICS.md` once the implementation is actually shipped.

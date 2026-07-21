# Title

Add Streaming Contracts And LLM Port Support

# Context

The current runtime can only call `ILlmAdapter.complete(...)`. EPIC 5.3 needs ordered token output
while preserving the existing provider abstraction and observability boundary.

This slice creates the minimal canonical streaming contract from provider adapter to API layer so
the later prompts can build the route and UI on top of a stable foundation.

# Scope

Implement now:

- add an additive streaming capability to the internal LLM port
- define the internal stream event contract emitted by provider adapters
- define the public/shared message-stream event contract used by the HTTP route and web client
- implement streaming support in the concrete provider adapters used by the repository
- keep the existing `complete(...)` path working for all current call sites

Out of scope:

- public route registration
- send-message persistence and orchestration flow
- web UI work

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Extend `apps/core/src/application/ports/ILlmAdapter.ts` additively. Do not remove `complete(...)`.
- Use a small internal event union for provider streaming, for example:
  - delta token/text chunk
  - terminal completion with final model and token metadata
- Keep the internal provider-stream contract separate from the public HTTP stream DTO. The API layer should map from internal provider events to shared/public message-stream events.
- Support cancellation by passing an abort signal through the streaming path. Keep it additive so existing completion code does not break.
- Update infrastructure adapters in `apps/core/src/infrastructure/llm/**`:
  - native streaming where the provider SDK supports it
  - deterministic single-chunk fallback in test/null adapters
  - observed adapter still owns tracing for the full request, not one trace per token
- Prefer one new shared public stream event union with explicit event names such as:
  - `conversation.message.started`
  - `conversation.message.delta`
  - `conversation.message.completed`
  - `conversation.message.interrupted`
  - `conversation.message.error`
- Reuse canonical `Message`, `AvatarMessageMetadata`, and `SendMessageResponse` shapes instead of cloning fields into new public events.
- Add targeted unit tests around adapter behavior, terminal event shape, and cancellation handling.

# Constraints

- Respect the current architecture and keep provider SDK usage inside infrastructure only.
- KISS, YAGNI, DRY.
- No direct provider SDK imports outside `infrastructure/llm`.
- Backward compatibility for existing non-streaming send-message flow is required.
- Do not introduce a second observability path for streams.

# Deliverables

- additive `ILlmAdapter` streaming capability
- canonical internal stream-event contract
- canonical shared/public message-stream event union
- provider adapter streaming implementations and tests

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
- `docs/TECH_STACK.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] `ILlmAdapter` supports ordered streaming additively without breaking `complete(...)`.
- [ ] Provider adapters emit one terminal completion event with final usage metadata.
- [ ] Public message-stream events reuse canonical shared DTOs where possible.
- [ ] Cancellation is part of the streaming contract.
- [ ] Unit tests cover stream ordering, terminal completion, and adapter fallback behavior.
- [ ] Documentation is reviewed and updated where needed.

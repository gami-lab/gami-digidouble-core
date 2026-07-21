# Title

Build The Streaming Send-Message Core Flow

# Context

The repository already has a complete synchronous `SendMessageUseCase` for
`POST /v1/conversations/{conversationId}/messages`. EPIC 5.3 must add progressive output without
creating a second divergent copy of the conversation runtime.

This slice exists to extract or reuse the shared send-message mechanics, then implement a
streaming execution path that persists canonical final messages and keeps Game Master work async.

# Scope

Implement now:

- identify and extract the reusable core steps from the current send-message flow where needed
- add a dedicated streaming send-message use case or service built on those shared steps
- persist the user message before streaming begins
- stream ordered avatar deltas as they are generated
- persist the final avatar message only when the stream completes successfully
- trigger post-turn async work only after final completion
- define interruption behavior clearly

Out of scope:

- the public route itself
- public web rendering
- Game Master feature changes unrelated to stream completion timing

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Start from `apps/core/src/application/use-cases/send-message/**`.
- Do not copy the existing use case wholesale. If the streaming path needs the same validation,
  model resolution, context assembly, or persistence builders, extract shared internal helpers
  first and have both synchronous and streaming flows reuse them.
- Keep the existing JSON route behavior stable. Streaming is additive.
- Recommended execution model:
  1. validate conversation/session/avatar state
  2. persist canonical user message
  3. emit a public `conversation.message.started` event containing the persisted user message
  4. iterate provider stream deltas in order
  5. accumulate final avatar content server-side
  6. on terminal completion, persist canonical avatar message with metadata
  7. emit `conversation.message.completed` with the final persisted payload
  8. launch async GM/memory work after completion
- Define interruption semantics explicitly and test them. Prefer a bounded Phase A rule:
  - on client abort or provider abort, stop streaming
  - do not persist a partial avatar message
  - leave the persisted user message intact
  - emit `conversation.message.interrupted` when the connection is still writable
- If the current code has no abstraction for “write event to response,” keep the use case transport-agnostic by yielding events or accepting a small event sink interface. Do not couple application code directly to Fastify reply objects.
- Add focused unit tests for:
  - ordered deltas
  - final persistence
  - interruption cleanup
  - post-turn async scheduling only after completion

# Constraints

- Respect API -> Application -> Domain -> Infrastructure boundaries.
- KISS, YAGNI, DRY.
- Keep Avatar first and GM async.
- No partial avatar-message persistence in Phase A unless the existing data model already supports draft state cleanly.
- Do not change conversation/message public DTOs unless the shared contract update is intentional and documented.

# Deliverables

- shared send-message execution helpers where duplication would otherwise grow
- streaming send-message use case or service
- deterministic interruption rules
- unit coverage for normal completion and interruption

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
- `docs/DATA_MODEL.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Streaming execution reuses shared send-message logic instead of cloning it.
- [ ] User messages persist before streaming begins.
- [ ] Avatar deltas stream in order and the final avatar message persists only on successful completion.
- [ ] GM/memory follow-up work remains async and starts only after final completion.
- [ ] Interruption behavior is deterministic and tested.
- [ ] Documentation is reviewed and updated where needed.

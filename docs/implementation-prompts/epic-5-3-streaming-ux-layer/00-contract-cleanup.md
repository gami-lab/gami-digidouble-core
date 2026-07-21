# Title

Contract Cleanup For Streaming Ownership

# Context

EPIC 5.3 touches existing Session, Conversation, Message, and streaming client flows. The current
repository already has duplicated SSE frame parsing and subscription logic in `apps/web` and
`apps/console`, while the message-send contract lives separately in `packages/shared` and
`apps/core`.

If streaming is added on top of that as a second ad hoc protocol, contract drift becomes
guaranteed. This slice exists to establish one canonical owner for streaming request/event shapes
before feature work begins.

# Scope

Implement now:

- inventory the contracts touched by streaming UX:
  - `SendMessageRequest`
  - `SendMessageResponse`
  - `Message`
  - any new message-stream event union
  - SSE frame parsing helpers used by web and console clients
- identify duplicated type definitions, inline response shapes, and copied frame parsing logic
- define canonical ownership for:
  - shared/public streaming DTOs in `packages/shared/src/**`
  - backend-only execution contracts in `apps/core/src/application/**`
  - client-side generic SSE parsing helpers in one reusable location
- refactor the obvious duplication before new streaming behavior lands

Out of scope:

- provider streaming behavior
- new HTTP routes
- UI rendering changes

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Start from `packages/shared/src/conversation-contract-types.ts` and `packages/shared/src/runtime-types.ts`.
- Inspect `apps/web/src/api/runtime-events-stream.ts` and `apps/console/src/api/runtime-events-stream.ts` for duplicated frame-processing logic. Extract only the generic reusable pieces needed for both surfaces.
- Keep API-facing types in `packages/shared`. Do not define public stream DTOs in `apps/core`.
- Keep internal execution contracts in `apps/core/src/application/use-cases/**` so streaming-specific orchestration details do not leak into public DTO packages.
- If the new stream request body is identical to `SendMessageRequest`, reuse that type instead of creating a parallel `StreamMessageRequest`.
- If one canonical shared export file becomes crowded, add a focused shared file such as `packages/shared/src/conversation-stream-contract-types.ts` and re-export it through `packages/shared/src/index.ts`.
- Add a small ownership note to the relevant docs or nearby exports so later prompts do not recreate drift.

# Constraints

- Respect API -> Application -> Domain -> Infrastructure boundaries.
- KISS, YAGNI, DRY.
- Preserve backward compatibility for the existing non-streaming send-message contract.
- Do not add a general-purpose event bus abstraction.
- TypeScript strict mode only; no `any`.

# Deliverables

- canonical owner for message-stream DTOs
- removal or consolidation of duplicated SSE parsing helpers
- imports updated to use shared owners
- a stable base for later streaming prompts

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
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Streaming request and event contracts have an explicit canonical owner.
- [ ] No duplicated public streaming DTO remains in touched modules.
- [ ] Shared SSE frame parsing logic is not copied separately in web and console after cleanup.
- [ ] Existing runtime-event behavior remains backward compatible.
- [ ] Documentation is reviewed and updated where needed.

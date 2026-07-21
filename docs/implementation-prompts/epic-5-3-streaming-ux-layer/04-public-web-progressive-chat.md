# Title

Render Progressive Chat In The Public Web App

# Context

EPIC 7.1 delivered a public web chat surface, but replies still appear only after the backend
finishes the entire turn. EPIC 5.3 closes that gap by letting `apps/web` render an avatar draft as
the streaming endpoint emits deltas.

This slice is the player-facing value of the EPIC. It must preserve the existing single-chat
experience, optimistic user send behavior, and live runtime updates.

# Scope

Implement now:

- add a web API client for the new streaming message endpoint
- consume shared/public message-stream events
- update active chat state to support one in-progress avatar draft
- render progressive avatar output in the chat UI
- handle completion, error, and interruption cleanly

Out of scope:

- console migration unless required by the earlier cleanup slice
- redesign of discovery or identity flows
- persistence of partial drafts across page reloads

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACT.md`
- `docs/TECH_STACK.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Start from:
  - `apps/web/src/api/conversations.ts`
  - `apps/web/src/chat/use-active-chat-runtime.ts`
  - `apps/web/src/chat/chat-thread-state.ts`
  - `apps/web/src/chat/ActiveChatSection.tsx`
- Keep the existing optimistic user-message insertion.
- Add one explicit local draft state for the avatar response instead of pretending partial output is already a persisted `Message`.
- Recommended UI flow:
  1. optimistic user message is inserted immediately
  2. send status switches to a streaming state
  3. first stream event creates an avatar draft bubble
  4. delta events append content in order
  5. completion event replaces the draft with the canonical persisted avatar message
  6. interruption or error leaves the thread in a clean, understandable state
- Do not create local copies of the public stream event types. Import them from `@gami/shared`.
- Keep stream consumption isolated from presentational components. The hook or API client should own frame parsing and state reconciliation.
- Continue to use the existing runtime SSE subscription for world-state updates; message streaming is a separate concern.
- Update tests around:
  - streaming send happy path
  - ordered delta accumulation
  - completion reconciliation
  - interruption/error cleanup
  - no duplicate avatar message after completion

# Constraints

- Respect the existing web-app architecture and keep presentation separate from API/state logic.
- KISS, YAGNI, DRY.
- Do not introduce a general chat history browser.
- Do not persist partial avatar drafts beyond in-memory UI state in Phase A.
- Reuse canonical shared contracts and helpers.

# Deliverables

- `apps/web` streaming message client
- active-chat runtime support for one in-progress avatar draft
- progressive chat rendering in the public UI
- web tests for completion and interruption behavior

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

- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] The public web app sends chat turns through the streaming route.
- [ ] Optimistic user messages still appear immediately.
- [ ] One avatar draft bubble updates progressively as deltas arrive.
- [ ] Completion replaces the draft with the canonical persisted avatar message.
- [ ] Error or interruption leaves the thread in a clean state with no ghost draft.
- [ ] No new contract duplication is introduced in `apps/web`.
- [ ] Documentation is reviewed and updated where needed.

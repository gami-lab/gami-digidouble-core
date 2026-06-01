# Single Chat Runtime and Live Updates

## Context

The public web app must present only the current chat thread. The user should not browse old chats. When the user sends a message, it must appear immediately, show a processing state, and update when the response arrives.

This slice is the actual conversational runtime surface of the public web app.

## Scope

Implement the active chat experience for the selected scenario/avatar pair.

In scope:

- create a single active chat view
- hide old chats from the public UI
- support sending a message in the active conversation
- render the message immediately when sent
- show a processing indicator while waiting for the answer
- render the response into the current thread when it arrives
- wire the view to the existing backend conversation/runtime flows
- support live updates for avatar availability if they arrive during the session

Out of scope:

- session creation rules beyond what is needed to enter chat
- admin tooling
- old conversation browsing
- memory or Game Master feature work
- new backend endpoints unless absolutely required by the public runtime

## Relevant Docs

- `docs/EPICS.md`
- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TECH_STACK.md`
- `docs/PRINCIPLES.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Use the canonical conversation and message contracts already defined by the backend.
- Keep the UI scoped to one current conversation at a time.
- Model sending state, processing state, and arrived response state explicitly so the user understands what is happening.
- If the public web app needs to subscribe to runtime events or refresh data, keep that logic isolated from presentation components.
- Treat the active chat as ephemeral UI state, not a chat archive.
- If any backend endpoint is missing for this flow, prefer to reuse existing endpoints and only add a new endpoint if the flow cannot be completed otherwise.

## Constraints

Respect the current architecture, KISS, YAGNI, DRY, and backward compatibility. Do not add a conversation history browser. Do not surface old chats in the public UI.

## Deliverables

- current-chat-only UX
- optimistic message insertion on send
- visible processing state
- response rendering in the active thread
- no public access to older chats

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

If the chat flow changed the public runtime assumptions, update the relevant architecture or API docs before closing the slice.

## Acceptance Criteria

- [ ] the public UI shows only the current chat
- [ ] old chats are not visible from the public web app
- [ ] a sent message appears immediately
- [ ] the UI indicates that a response is being processed
- [ ] the answer appears in the active chat when it arrives
- [ ] the implementation reuses canonical backend/shared contracts
- [ ] no new contract duplication is introduced

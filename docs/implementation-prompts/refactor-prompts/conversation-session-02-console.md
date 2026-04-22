You are an expert staff engineer + tech lead assistant working on the internal manual test console / back-office UI of a TypeScript modular monolith project.

Context:
The backend model has been refactored so that:

- Session = one experience run inside a scenario
- Conversation = one bounded dialogue with one avatar inside a session
- A session can contain multiple conversations over time
- Switching avatar creates a new conversation
- Returning later to the same avatar also creates a new conversation
- Messages belong to conversations
- The console must reflect this clearly for testers and non-technical users

Your mission:
Update the console so it matches the new backend/API model and removes the old session/conversation confusion.

## Product intent for the console

The console is a manual testing and inspection tool.

It should make the mental model obvious:

1. create/select a scenario
2. create/select avatars for that scenario
3. start a session
4. inside the session, start a conversation with an avatar
5. send messages in that conversation
6. start another conversation with another avatar
7. later start a fresh conversation again with a previous avatar
8. inspect conversation histories separately
9. inspect session-level state and conversation list

The console should help testers understand:

- session = global run
- conversation = local thread
- same avatar can appear in multiple conversations within the same session

## What to change

### 1. Information architecture / terminology

Update labels and flows so the UI consistently uses:

- Scenario
- Session
- Conversation
- Avatar
- Message

Do NOT keep ambiguous wording where a session view is labeled conversation or vice versa.

### 2. Main flow

Refactor the console flow so it supports:

- Scenario management
- Avatar management
- Session creation
- Session detail page/panel
  - session metadata
  - list of conversations in this session
  - current active avatar if applicable
- Start new conversation action inside a session
- Conversation detail/chat panel
  - selected avatar
  - message history for this conversation only
  - send message box
- Easy way to start another conversation in the same session
- Easy way to return to an earlier avatar by starting a NEW conversation

### 3. UX expectations

The UI should make this distinction obvious:

- opening a past conversation = inspect old thread
- starting a fresh conversation with the same avatar = new conversation

This should not be hidden.

Use explicit CTAs like:

- “Start conversation with avatar”
- “Start new conversation with this avatar”
- “Open previous conversation”
- “Session conversations”

### 4. API integration

Update all API calls to the new backend shape.

Expected shape:

- create session
- create conversation inside session
- send message to conversation
- fetch conversation history
- fetch session conversations
- any list/delete endpoints already added in previous work should still be used appropriately

Do not keep old route assumptions such as sending messages to a session endpoint with avatarId.

### 5. Debug / testing value

The console should surface enough state for manual QA:

- sessionId
- conversationId
- avatar name / avatarId
- timestamps if already available
- ability to see that two conversations with the same avatar are distinct

Do not overload the UI with irrelevant internals.

## Documentation updates required

Update any console/back-office related docs that exist, and update docs/PROJECT_STATUS.md to reflect the new console behavior if relevant.

If there is a UI-specific README or implementation prompt folder, update those too.

## Testing requirements

Add/update UI tests and/or integration tests for the main flows:

- create session
- start conversation with avatar A
- send message in that conversation
- start second conversation with avatar B
- return to avatar A with a NEW conversation
- verify the two avatar-A conversations are distinct in the UI
- verify message history shown is scoped to the selected conversation
- verify testers can navigate from session view to conversation view cleanly

If full browser tests are too heavy for the current state, add at least the most valuable integration/component tests around the state/model transitions.

## Constraints

- keep the console simple and obvious
- optimize for manual testing clarity, not polish
- do not introduce complex dashboard features in this prompt
- do not build speculative multi-panel power-user tooling beyond what is needed
- follow the project’s existing UI structure and conventions
- align with the backend reality after the refactor

## Final deliverables

When done, provide:

1. summary of UI/UX changes
2. list of files changed
3. tests added/updated
4. docs updated
5. any remaining console limitations

---

## Implementation sync note (April 22, 2026)

The manual test console has been updated to align with the refactored backend model:

- scenario create/select and avatar create/select flows are explicit
- session detail now shows session metadata + session conversation list
- conversation actions are explicit:
  - Start conversation with avatar
  - Start new conversation with this avatar
  - Open previous conversation
- message send/history is fully conversation-scoped (`conversationId`)
- conversation state transitions now have Vitest coverage in `apps/console/src/pages/session-state.test.ts`

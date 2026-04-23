# Prompt 2 — Update Console for Scenario Testing

You are an expert frontend/product engineer working on the internal Console UI for Gami DigiDouble Core.

Your task is to upgrade the Console so non-technical users can fully test the scenario:

**AI Guided Discovery**

Use existing console stack and patterns already present in the repo.

## Objective

Turn the Console into a true scenario test bench for multi-avatar guided experiences.

---

## Main UX Goal

A tester should be able to:

1. Start seeded scenario
2. Create session
3. Chat with Avatar A
4. See specialists become unlocked
5. Switch to B or C
6. Return to A
7. Inspect conversations/session state
8. Understand why transitions happened

No API knowledge required.

---

## Required UI Features

## 1. Scenario Launcher

Add a dedicated entry for:

**AI Guided Discovery**

Actions:

- load scenario
- create session
- open test workspace

---

## 2. Avatar Availability Panel

Display all 3 avatars:

- A visible and available
- B locked until unlocked
- C locked until unlocked

Use clear states:

- Available
- Locked
- Active

When unlocked dynamically, UI updates live.

---

## 3. Switch Avatar Actions

Provide one-click buttons:

- Talk to A
- Talk to Theo
- Talk to Eva

If locked:

- disabled with explanation

Switching creates proper new conversation through backend API.

---

## 4. Conversation Timeline

Show session episodes:

- A #1
- B #1
- A #2
- C #1

Include:

- avatar
- start time
- status
- selectable history

This is critical for validating session vs conversation model.

---

## 5. State Inspector

Readable debug panel:

- sessionId
- active avatar
- unlocked avatars
- GM notes
- transition history
- available avatars

No raw JSON dump unless expandable.

---

## 6. Guided Test Shortcuts

Buttons for common tests:

- Ask technical question
- Ask ethics question
- Return to Guide
- Test locked access
- Reset session

These accelerate QA.

---

## 7. Behavior Explanation

When switch/unlock occurs, show reason if available:

Examples:

- Theo unlocked after technical interest detected
- Eva unlocked after ethics topic detected

---

## Acceptance Criteria

### Functional

- tester can validate full A → B → A flow
- locked avatars cannot be opened
- unlocks reflected instantly
- multiple conversations visible

### UX

- understandable in under 2 minutes
- no developer jargon
- no manual API steps required

### Technical

- reuse existing API contracts
- typed frontend state
- no duplicated backend logic
- tests pass

---

## Suggested Nice-to-Have

- export session transcript
- replay scenario
- compare two sessions
- badge showing “Scenario test passed”

---

## Deliverables

1. Updated console screens/components
2. State wiring
3. Tests
4. Small UX notes
5. Summary of changes

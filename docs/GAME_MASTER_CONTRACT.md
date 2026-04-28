# Game Master Contract and State Model (MVP — Async Director / Actor Model)

## Purpose

This document defines the **minimal executable contract** of the Game Master for the MVP.

The goal is simple:

👉 Make the system buildable **without overengineering**

We deliberately apply:

- **KISS (Keep It Simple)**
- **YAGNI (You Aren’T Gonna Need It)**

---

# 1. Role of the Game Master (MVP)

The Game Master is a **light asynchronous orchestrator**.

It is **not in the critical response path** during normal conversation.

The Avatar speaks directly to the user for minimal latency.
The Game Master observes in the background and intervenes when useful.

This is a **Director / Actor model**:

- **Avatar = Actor**
  - has its own intelligence
  - has its own memory
  - has its own personality
  - answers directly to the user

- **Game Master = Director**
  - watches the conversation
  - detects moments where guidance helps
  - injects context or directives asynchronously
  - manages lightweight progression state

Terminology used in this contract:

- `session` = one experience run container
- `conversation` = one bounded avatar dialogue episode inside a session

Its job is only to:

- decide which avatar the user interacts with
- initialize context at session start
- observe ongoing conversations in background
- trigger guidance when needed
- update a very small state

👉 In early session startup, the GM may run synchronously.
👉 During live conversation, the Avatar should remain autonomous whenever possible.

---

# 2. Design Principles (MVP)

## 2.1 Minimal control

The Game Master should interfere as little as possible.

If the Avatar can handle something alone → let it.

## 2.2 No over-structuring

Avoid:

- complex strategies
- emotional modeling
- deep classification

## 2.3 Context, not behavior

The Game Master provides context.

The Avatar decides how to behave.

## 2.4 Minimal state

Only keep what is strictly needed to:

- maintain progression
- avoid repetition
- track interaction

## 2.5 Hybrid decision mode

The GM combines:

- **reasoning input** (LLM when useful)
- **policy input** (structured scenario config and deterministic rules)

Not all decisions should come from prompts.

---

---

# 3. Turn Pipeline (Async Model)

## Session Start (experience run)

1. User starts session
2. Game Master may suggest initial avatar/context
3. Client or policy starts the first conversation in the session
4. Avatar responds to user

## Ongoing Conversation (inside a session)

1. User message received
2. Avatar responds directly (no waiting for GM)
3. Avatar message persisted
4. GM fires asynchronously — non-blocking; errors are caught and logged, never propagate to the user response
5. GM evaluates deterministic triggers against current state
6. If a trigger fires: LLM called, state reduced, guidance notes stored into `sessions.gm_notes` for the next turn; when `conversationMode === 'new'` and `nextAvatarId` is valid, the current conversation is closed and a new conversation is opened for the next avatar; `session.activeAvatarId` updated if avatar changed; `gm_triggered` event emitted
7. If no trigger: interaction count incremented, state persisted; `gm_skipped` event emitted
8. An event is emitted in all cases (see Section 14)

This removes the double-latency problem of sequential two-LLM calls.

---

# 4. Game Master Input (Simplified)

```ts
export type GameMasterInput = {
  session: {
    sessionId: string
    turnIndex: number
  }

  userMessage: {
    text: string
  }

  state: GameMasterState

  context: {
    experience: {
      scenarioId: string
      description?: string
      goals?: string[]
    }

    availableAvatars: Array<{
      avatarId: string
      name: string
      description?: string
    }>

    policy?: {
      /** Override the default turn-count trigger interval (default: 5). */
      turnThreshold?: number
      /** Override how many times a topic must repeat before triggering (default: 3). */
      maxTopicRepeatCount?: number
      /** Override how many turns without progression before triggering (default: 8). */
      maxTurnsWithoutProgression?: number
    }
    eligibleTransitions?: Array<{
      toAvatarId: string
      reason: string
    }>
  }
}
```

---

# 5. Game Master Output (Minimal)

```ts
export type GameMasterOutput = {
  avatarId: string
  nextAvatarId?: string
  transitionReason?: string
  recommendedChoices?: Array<{
    id: string
    label: string
  }>
  contentTrigger?: string

  conversationMode: 'new' | 'continue'

  context?: {
    notes?: string
  }

  stateUpdate: {
    progression?: 'none' | 'increase'
    topicCovered?: string
    activeAvatarId?: string
    interactionIncrement: 1
  }
}
```

### Notes

- `avatarId` = avatar for the immediate turn
- `nextAvatarId` = suggested handoff target for a next step
- `stateUpdate.activeAvatarId` keeps session routing deterministic after a switch
- `conversationMode: 'new' | 'continue'` means start a new bounded conversation or continue the current conversation **inside the same session**
- `conversationMode: 'new'` is active in MVP runtime (not deferred): `RunGameMasterUseCase` performs the conversation handoff when `nextAvatarId` is valid
- `recommendedChoices` allows guided progression without forcing one path
- `contentTrigger` can signal non-text assets or events

---

# 6. State Model (Minimal)

Only keep what we actually need.

```ts
export type GameMasterState = {
  currentAvatarId?: string

  progression: string

  topicsCovered: string[]

  interactionCount: number

  transitionHistory?: Array<{
    fromAvatarId?: string
    toAvatarId: string
    reason?: string
    atTurn: number
  }>
}
```

---

# 7. State Meaning

## progression

A simple description

Used to:

- track progress in the experience
- know if we move forward

## topicsCovered

Used to:

- avoid repetition
- know what has already been discussed

## interactionCount

Used to:

- detect long sessions
- trigger future improvements later (compaction, etc.)

## currentAvatarId

Used to:

- know if we continue with the same avatar
- or switch to another one

---

# 8. Core Decisions (MVP)

The Game Master only makes 3 decisions:

## 8.1 Which avatar?

- choose initial avatar
- optionally switch later

## 8.2 Should I intervene?

- no → Avatar continues alone
- yes → inject guidance asynchronously

### Deterministic trigger policy (MVP)

The first intervention gate is deterministic and does not call an LLM.
It evaluates `GameMasterState` with fixed trigger priority.

Priority order:

1. `turn_threshold`
2. `topic_repeat`
3. `progression_stalled`

`session_start` and `manual` are reserved explicit triggers from calling code and are not evaluated by this policy function.

Default thresholds:

- `DEFAULT_TURN_THRESHOLD = 5`
- `DEFAULT_MAX_TOPIC_REPEATS = 3`
- `DEFAULT_MAX_TURNS_WITHOUT_PROGRESSION = 8`

Trigger conditions:

- `turn_threshold` → `interactionCount > 0 && interactionCount % turnThreshold === 0`
- `topic_repeat` → any topic appears at least `maxTopicRepeatCount` times in `topicsCovered`
- `progression_stalled` → `interactionCount >= maxTurnsWithoutProgression` and `progression` is still initial (`''` or `'none'`)

## 8.3 What context to provide?

Examples:

- "User is new to this topic"
- "Go deeper on uncertainty"
- "Move toward next objective"

👉 This is guidance, not control.

In addition, GM may propose:

- when to switch avatar
- why a transition is useful
- what user choices help progression

---

# 9. State Update Rules (Simple)

## Progression

Increase when:

- user explores the topic
- conversation moves forward

Otherwise:

- keep as is

## Topics

Add topic when:

- a meaningful concept is discussed

## Interaction count

Always:

```ts
interactionCount += 1
```

---

# 10. What the Game Master Does NOT Do (MVP)

The Game Master does NOT:

- answer every user message in sequence
- block the Avatar response path
- manage conversation memory → Avatar does
- control tone → Avatar does
- enforce strict dialogue flow
- classify emotions deeply
- run heavy retrieval pipelines on every turn
- orchestrate complex strategies

---

# 11. Example (MVP)

## Input

User: "Tell me more about plastic pollution"

State:

- currentAvatarId: "peter"
- progression: "introduction done"
- topicsCovered: ["plastic"]
- interactionCount: 3

---

## Output

```json
{
  "avatarId": "peter",
  "conversationMode": "continue",
  "context": {
    "notes": "User already started exploring plastic pollution, go deeper"
  },
  "stateUpdate": {
    "progression": "increase",
    "topicCovered": "plastic_pollution",
    "interactionIncrement": 1
  }
}
```

---

# 12. Implementation Guidance (MVP)

The current MVP implementation runs GM as an async observer after each avatar turn.

## 12.1 Runtime flow (`RunGameMasterUseCase`)

1. Load state from `IGmStateRepository.findBySessionId(sessionId)`; if missing, initialize:
   - `progression: ''`
   - `topicsCovered: []`
   - `interactionCount: 0`
2. Evaluate deterministic triggers with `evaluateTriggers(state, policy?)`.
3. If no trigger:
   - increment `interactionCount`
   - persist state
   - leave session GM notes unchanged
4. If a trigger fires:
   - build `GameMasterInput` (session, user message, state, scenario/avatar context)
   - call LLM via `ILlmAdapter.complete()`
   - parse JSON into `GameMasterOutput`
   - apply reducer (`reduceGmState`) and persist state
   - store `output.context.notes` into session-level GM notes when provided
   - when `conversationMode: 'new'` and `nextAvatarId` is valid for eligible transitions, close the active conversation, create a new GM-started conversation for `nextAvatarId`, and update `session.activeAvatarId`
   - otherwise update `session.activeAvatarId` when `stateUpdate.activeAvatarId` changes
5. GM errors must not break user response path; in message flow the GM call is fire-and-forget with error catch.

## 12.2 GM system prompt structure (MVP)

The GM system prompt is intentionally short and role-focused:

- define GM as a silent director (not a chat responder)
- require valid JSON-only output matching `GameMasterOutput`
- constrain `context.notes` to one concise sentence
- allow avatar selection only from provided `availableAvatars`

No scenario-specific content is hard-coded into the system prompt.

## 12.3 Session guidance notes storage decision

For MVP, guidance notes are stored on `sessions.gm_notes` (TEXT).
The Avatar prompt assembler appends these notes on the next turn as:

- `Director notes: <gm_notes>`

---

# 13. Evolution Path (Later)

Only add complexity when needed:

- richer state (engagement, emotion)
- retrieval (RAG)
- multi-step strategies
- system actions

Not before.

---

# Final Rule

If the Avatar can handle it →
👉 **The Game Master should not exist for that decision.**

The GM is here to **route and lightly guide**, not to control everything.

---

# 14. Diagnostic Trace (Admin Visibility)

Every GM decision must emit a structured event to the `EventLog` so operators can inspect why it triggered and what it decided.

This is implemented for admin inspection via `GET /v1/admin/sessions/{sessionId}/events`.

The EventLog repository exposes both append and session-scoped read operations:

```ts
interface IEventLogRepository {
  append(event: StoredEvent): Promise<void>
  findBySessionId(sessionId: string, opts?: { limit?: number }): Promise<StoredEvent[]>
}
```

## Required Fields

```ts
type GameMasterEvent = {
  // Standard EventLog fields
  type: 'gm_triggered' | 'gm_skipped'
  severity: 'info'
  correlationId: string // shared with the originating user turn
  requestId?: string

  payload: {
    // Why the GM ran
    triggerReason:
      | 'session_start'
      | 'turn_threshold'
      | 'topic_repeat'
      | 'progression_stalled'
      | 'manual'
    turnIndex: number
    interactionCount: number

    // State before the GM decision
    stateBefore: {
      currentAvatarId?: string
      progression: string
      topicsCovered: string[]
    }

    // Decision summary (only when type = 'gm_triggered')
    decision?: {
      avatarId: string
      conversationMode: 'new' | 'continue'
      notesInjected: boolean
      directiveCount: number
    }

    // State after (only when type = 'gm_triggered')
    stateAfter?: {
      currentAvatarId?: string
      progression: string
      topicsCovered: string[]
    }

    // Performance
    latencyMs: number
    inputTokens?: number
    outputTokens?: number
  }
}
```

## Rules

- Emit for every GM run, including skipped runs (`type: 'gm_skipped'`)
- Never include prompt content or raw user message in the diagnostic payload — these are sensitive
- The `correlationId` must match the one used by the parent `SendMessage` use case for this turn
- The admin events endpoint surfaces only safe `gm_triggered` and `gm_skipped` diagnostic fields, newest-first

---

# 15. Avatar Switch Flow

When rule-based transitions are configured, avatar switching follows this flow:

1. Trigger policy fires (`turn_threshold`, `topic_repeat`, or `progression_stalled`) and transition rules are evaluated from current avatar and state.
2. Eligible transitions are passed into `GameMasterInput.context.eligibleTransitions` as `{ toAvatarId, reason }[]` so the GM can only pick from valid handoff targets.
3. If rules exist, `nextAvatarId` is accepted only when it is in the eligible set; if valid and `conversationMode === 'new'`, current conversation is closed, new conversation is created, and session active avatar is updated.

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

Legacy compatibility rule:

- if a scenario has no explicit `modelSelection`, GM runtime falls back to the pre-existing global model-config path with no scenario-specific override required

👉 In early session startup, the GM may run synchronously.
👉 During live conversation, the Avatar should remain autonomous whenever possible.

---

# 2. Design Principles

- **Minimal control** — if the Avatar can handle it alone, let it
- **No over-structuring** — avoid complex strategies, emotional modeling, deep classification
- **Context, not behavior** — GM provides context; Avatar decides how to respond
- **Minimal state** — keep only what is needed for progression, repetition avoidance, and interaction tracking
- **Reasoning-owned routing** — semantic decisions (unlocks, suggestions, switches) belong to GM reasoning, not keyword thresholds

See `PRINCIPLES.md` for full engineering philosophy.

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
4. GM fires asynchronously after every completed avatar turn — non-blocking; errors are caught and logged, never propagate to the user response
5. GM LLM is called with recent messages, current state, scenario goals, active avatar, and avatar availability context
   - recent messages are bounded and provided as short-term context (not full replay)
   - working memory, long-term facts/events, typed RAG sections (`memory`, `world`, `media`), and optional user persona are included via context
   - GM runtime model is resolved deterministically as: `scenario.modelSelection.gameMasterOverride` -> `scenario.modelSelection.defaultProfile` -> global Game Master role override -> global default
6. GM output is parsed and validated
7. State is reduced, guidance notes are stored into `sessions.gm_notes` for the next turn, and valid avatar unlocks are persisted to `sessions.unlocked_avatar_ids`
8. Runtime events are emitted from GM decisions (unlocks, suggestions, world-processing state changes) through the system event publisher
9. `gm_triggered` is emitted for successful GM runs; `gm_error` is emitted for safe failures

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

  recentMessages?: Array<{
    role: 'user' | 'avatar' | 'system'
    content: string
  }>

  state: GameMasterState

  context: {
    userPersona?: {
      name?: string
      roleInWorld?: string
      avatarRelationships?: string[]
      dialogGuidance?: string
    }

    memory?: {
      workingMemory?: {
        summary: string
        unresolvedThreads: string[]
      }
      episodicMemories?: Array<{
        memoryId: string
        conversationId: string
        summary: string
        keyDiscoveries: string[]
        unresolvedTopics: string[]
        createdAt: string
        selectionReasons: Array<
          'recency' | 'relevance' | 'continuity' | 'unresolved_topic' | 'working_memory'
        >
        score: number
      }>
      longTermFacts?: Array<{
        category: string
        key: string
        value: string
      }>
    }

    rag?: {
      memory?: Array<{ sourceId: string; excerpt: string }>
      world?: Array<{ sourceId: string; excerpt: string }>
      media?: Array<{ sourceId: string; excerpt: string }>
    }

    experience: {
      scenarioId: string
      description?: string
      goals?: string[]
    }

    availableAvatars: Array<{
      avatarId: string
      name: string
      description?: string
      scope?: string
      availability?: 'available' | 'locked'
    }>
  }
}
```

`context.userPersona` is optional and carries lightweight information about who the user is
(for example, role) so GM routing and pacing can adapt without coupling the GM to persistence.

Contract ownership note:

- GM input/output domain types: `apps/core/src/domain/game-master/game-master.types.ts`
- Static GM system instructions: `apps/core/src/domain/game-master/gm-prompt.service.ts`
- Dynamic GM LLM input rendering: `apps/core/src/domain/game-master/gm-input-renderer.ts`
- GM output parse/normalize guards: `apps/core/src/domain/game-master/gm-output-parser.ts` and `apps/core/src/domain/game-master/gm-output-normalization.ts`
- GM memory sub-shape source (internal): `apps/core/src/domain/memory/memory.types.ts` (`GameMasterMemoryContext`)
- HTTP-facing DTO memory fragments remain owned by `@gami/shared`.

Compatibility boundary note:

- `GameMasterInput` remains the only runtime input contract for GM evaluation.
- `GameMasterInput.context.memory` owns only the structured GM-facing layers actually consumed at runtime: `workingMemory`, `episodicMemories`, and `longTermFacts`.
- Compatibility mirrors such as `workingSummary`, `shortTerm`, or legacy `knowledge/avatarMemory` belong only to internal context snapshots or recorded diagnostics where explicitly documented; they are not part of the runtime `GameMasterInput`.
- The LLM renderer is an internal serialization concern only; prompt wording/layout work must not add prompt-only fields or fork `GameMasterInput`.
- The static GM system prompt is organized into explicit `Role`, `Objectives`, `Decision Policies`, and `Output Contract` sections; wording may evolve, but JSON-only output, avatar availability, unlock gating, `nextAvatarId`, `interactionIncrement`, `context.notes`, and session-start guidance must remain explicit.
- The static GM decision-policy section must keep evidence-based priority questions explicit and bias toward stable orchestration: keep `conversationMode: "continue"` unless a switch is clearly warranted, avoid progression increases by default, avoid weak-association unlocks, and prefer suggestions over forced switches when a handoff is not necessary.
- The dynamic GM runtime input is rendered into explicit `Current Turn`, `Current Discussion Context`, `Experience Context`, and `Output Reminder` sections; wording may evolve, but it must continue to consume the same `GameMasterInput` fields, preserve bounded recent messages and memory layers, surface the latest exchange explicitly when available, and omit empty optional sections cleanly.
- Observability for the GM LLM completion path must carry safe prompt-shape identifiers so operators can correlate traces with a specific static prompt and input-renderer revision without logging raw prompt text in runtime events.

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
  unlockAvatarIds?: string[]
  unlockDecisions?: Array<{
    avatarId: string
    reason: string
  }>
  suggestedAvatarId?: string
  suggestedAvatarReason?: string

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
- `unlockAvatarIds` = active scenario avatars the GM decides should become available now; invalid IDs, inactive avatars, and already-unlocked avatars are ignored
- `suggestedAvatarId` / `suggestedAvatarReason` = a safe, non-forcing recommendation surfaced in GM diagnostics and future context; it does not switch conversations by itself
- `stateUpdate.activeAvatarId` is advisory context, not an instruction to auto-switch conversations
- `conversationMode: 'new' | 'continue'` is a director recommendation consumed by policy and UI orchestration
- In MVP runtime, GM does **not** close/open conversations asynchronously; conversation switches remain explicit user/API actions
- `recommendedChoices` allows guided progression without forcing one path
- `contentTrigger` can signal non-text assets or events

### Runtime event emission capability

GM output can trigger RuntimeEvents (emitted by the system, not by GM directly), for example:

- `unlockAvatarIds` → `runtime.avatar_unlocked`
- `suggestedAvatarId` / `suggestedAvatarReason` → `runtime.avatar_suggested`
- `recommendedChoices` present → `runtime.choice_required`
- GM run start/end lifecycle → `runtime.processing_started` / `runtime.processing_finished`

Compatibility boundary note:

- `GameMasterOutput` remains the canonical runtime output contract.
- Prompt refinement may change wording or formatting, but must continue to pass through the existing parse, normalization, unlock validation, state reduction, and event-payload guards.

---

# 6. State Model (Minimal)

Only keep what we actually need.

```ts
export type GameMasterState = {
  currentAvatarId?: string

  progression: string

  topicsCovered: string[]

  interactionCount: number
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

Used as context for pacing, compaction, and progression reasoning.

It does not gate whether the GM runs.

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

## 8.2 What should change after this turn?

The GM runs after every completed avatar turn and decides whether to:

- store a concise director note for the next turn
- unlock a now-relevant avatar
- suggest another avatar without forcing a switch
- emit runtime world-update signals that clients can consume via SSE

## 8.3 What context to provide?

Examples:

- "User is new to this topic"
- "Go deeper on uncertainty"
- "Move toward next objective"

👉 This is guidance, not control.

---

# 9. Client communication boundary

- GM does not talk directly to clients.
- GM produces structured decisions and state updates.
- API/Application layers translate those decisions into runtime events and runtime-state snapshots.

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
- manage heavy memory compaction pipelines in-line
- control tone → Avatar does
- enforce strict dialogue flow
- classify emotions deeply
- run heavy retrieval pipelines on every turn
- orchestrate complex strategies
- consume unbounded raw transcript history by default

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
2. Build `GameMasterInput` (session, recent messages, user message, state, scenario goals, avatar availability context, and `context.memory`).
   - `context.memory` is assembled by one shared deterministic selection service used by Avatar + GM.
   - `context.memory.shortTerm.recentExchanges` is derived from bounded recent user/avatar message pairs (exactly the last 2 exchanges).
   - `context.memory.workingMemory` carries the conversation-scoped working summary + unresolved threads.
   - `context.memory.episodicMemories` carries bounded selected prior episodes with deterministic scoring and selection reasons.
   - `context.memory.longTermFacts` is populated from bounded structured user facts.
   - `context.memory.workingSummary` remains as a compatibility mirror of `workingMemory.summary`.
3. Call LLM via `ILlmAdapter.complete()` every post-turn run.
4. Parse JSON into `GameMasterOutput`.
5. Validate unlock, suggestion, and switch targets against active scenario avatars and session unlock state.
6. Apply reducer (`reduceGmState`) and persist state.
7. Store `output.context.notes` into session-level GM notes when provided.
8. Persist valid unlocks into `sessions.unlocked_avatar_ids`.
9. When `conversationMode: 'new'` and `nextAvatarId` is valid and switchable, close the active conversation, create a new GM-started conversation for `nextAvatarId`, and update `session.activeAvatarId`.
10. Emit `gm_triggered` for successful runs or `gm_error` for safe failures.
11. GM errors must not break user response path; in message flow the GM call is fire-and-forget with error catch.

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

# Final Rule

If the Avatar can handle it →
**The Game Master should not exist for that decision.**

The GM is here to **route and lightly guide**, not to control everything.

---

# 13. Diagnostic Trace (Admin Visibility)

Every GM decision must emit a structured event to the `EventLog` so operators can inspect why it triggered and what it decided.

See `API_CONTRACT.md` for the full events endpoint contract (`GET /v1/admin/sessions/{sessionId}/events`).

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
  type: 'gm_triggered' | 'gm_error'
  severity: 'info' | 'error'
  correlationId: string // shared with the originating user turn
  requestId?: string

  payload: {
    // Why the GM ran
    triggerReason: 'session_start' | 'post_turn_observation' | 'manual' | null
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
      unlockedAvatarIds?: string[]
      suggestedAvatarId?: string
      suggestedAvatarReason?: string
      switchedAvatarId?: string
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
    errorCode?: string
  }
}
```

## Rules

- Emit `gm_triggered` for every successful GM run and `gm_error` for safe GM failures
- Avatar unlocks are reported inside the safe `gm_triggered.payload.decision.unlockedAvatarIds` field; reasons must be short and must not quote raw conversation text
- Never include prompt content or raw user message in the diagnostic payload — these are sensitive
- The `correlationId` must match the one used by the parent `SendMessage` use case for this turn
- The admin events endpoint surfaces only safe `gm_triggered` and `gm_error` diagnostic fields, newest-first

---

# 14. Avatar Switch Flow

Avatar switching is owned by the Game Master and validated by the runtime:

1. GM receives active scenario avatars in context, including whether each avatar is currently available or locked.
2. GM may return `suggestedAvatarId` for a non-forcing recommendation.
3. GM may return `nextAvatarId` only when `conversationMode === 'new'`.
4. Runtime accepts a switch only when `nextAvatarId` is an active avatar in the scenario and is already unlocked or unlocked by the same valid GM output.
5. If valid, the current conversation is closed, a new GM-started conversation is created, and session active avatar is updated.

# 15. Avatar Unlock Flow

Avatar unlocking is owned by the Game Master.

1. Scenario config may define `avatarAvailability.initialAvatarIds` and `avatarAvailability.unlockableAvatarIds`.
2. Session start maps `avatarAvailability.initialAvatarIds` to `session.unlockedAvatarIds`.
3. During async GM evaluation, locked active avatars are passed in `availableAvatars` with `availability: 'locked'`.
4. The GM may return `unlockAvatarIds` when the recent discussion makes a specialist relevant.
5. Runtime validation ignores inactive avatars, non-scenario IDs, already-unlocked IDs, duplicates, and locked avatars that were not explicitly mentioned in `recentMessages`.
6. `GET /v1/sessions/{sessionId}/available-avatars` remains the source of truth for what the client can switch to.

# 16. Assembled Context Inspection

To support EPIC 2.7 operator workflows, Core exposes:

- `GET /v1/admin/sessions/{sessionId}/context`

This endpoint provides a bounded, structured snapshot of the same inputs used by Avatar and GM context assembly.

Avatar-facing context:

- short-term recent exchanges (bounded)
- working memory (session + active avatar summaries when available)
- long-term structured facts
- user persona
- GM notes
- scenario metadata (description/goals)
- typed retrieval visibility is asymmetric: avatar-facing retrieval may be filtered by active avatar visibility, while GM retrieval remains unrestricted (omniscient) for orchestration decisions

GM-facing context:

- recent messages (bounded)
- memory context (`shortTerm`, `workingMemory`, `episodicMemories`, `longTermFacts`)
- current GM state
- available avatars with availability flags
- user persona
- scenario metadata (description/goals)

Safety rules:

- No raw provider request/response payloads
- No credentials or environment secrets
- No raw full prompt template dumping
- No unbounded transcript replay

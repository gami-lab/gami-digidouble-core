# Game Master Contract

## Purpose

Define the stable runtime contract for the MVP Game Master.

The Game Master is an async director, not a chat responder. It observes the runtime, updates lightweight orchestration state, and supplies guidance without blocking the normal avatar reply path.

## Core Role

- Avatar speaks directly to the user.
- Game Master runs in the background during normal conversation.
- GM can choose, unlock, suggest, or switch avatars; inject guidance notes; and update progression state.
- GM owns orchestration decisions, not tone or final wording.

Terms:

- `session`: one experience run
- `conversation`: one bounded avatar dialogue episode inside a session

## Non-Negotiable Rules

- GM must not block the normal avatar response path.
- GM produces structured decisions; API/application layers translate them into persistence and runtime events.
- If the avatar can handle a decision alone, GM should not own it.
- GM input and output contracts stay stable even if prompt wording changes.
- Runtime diagnostics must be safe: no raw prompts, secrets, or unbounded transcript replay.

## Turn Pipeline

### Session Start

1. Session is created.
2. GM may run synchronously to choose opening guidance or the initial avatar.
3. First conversation is started by policy or client action.

### Normal Turn

1. User message is received.
2. Avatar responds immediately.
3. Messages are persisted.
4. GM runs asynchronously after a successfully completed avatar turn, whether the avatar reply
   was delivered as JSON or as a completed message stream.
5. GM input is built from bounded recent messages, GM state, scenario context, user persona, memory, retrieval, and avatar availability.
6. GM output is parsed, normalized, validated, reduced into state, and persisted.
7. Safe runtime events are emitted.
8. GM failures are caught and logged without affecting the user reply.

An interrupted message stream is not a completed avatar turn: it keeps the persisted user message,
does not persist partial avatar content, and does not trigger post-turn GM work.

## Runtime Input Contract

```ts
type GameMasterInput = {
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
        coveredTopics: string[]
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

Input invariants:

- `GameMasterInput` is the only runtime input contract for GM evaluation.
- `recentMessages` is bounded short-term context, not transcript replay.
- `context.memory.workingMemory` is canonical; `workingSummary` is only a compatibility mirror in diagnostics.
- Avatar retrieval may be visibility-filtered, but GM retrieval remains unrestricted.

## Runtime Output Contract

```ts
type GameMasterOutput = {
  dialogueControl: {
    mode: 'user_led' | 'avatar_guided' | 'avatar_led' | 'repair' | 'transition'
    askFollowUp: boolean
  }
  retrievalPlan?: {
    required: boolean
    priority?: 'mandatory' | 'optional'
    queries?: string[]
    requiredFacts?: string[]
    scopes?: Array<'avatar_memory' | 'world_context' | 'scenario_knowledge'>
  }
  directorNotes?: string
  routing?: {
    action: 'stay' | 'suggest' | 'switch' | 'unlock' | 'unlock_and_switch'
    avatarId?: string
    reason?: string
    unlockDecisions?: Array<{
      avatarId: string
      reason: string
    }>
  }
  progressionUpdate?: {
    progression: 'none' | 'increase'
    objectiveId?: string
    reason?: string
  }
}
```

Output invariants:

- `GameMasterOutput` is the canonical runtime output contract.
- `dialogueControl.askFollowUp` must always be stated explicitly by the GM; it is never inferred from `mode` alone.
- `dialogueControl` is required. `retrievalPlan`, `directorNotes`, `routing`, and
  `progressionUpdate` are optional; omitted retrieval/progression fields normalize to safe
  no-op defaults before persistence.
- The GM does not perform retrieval — `retrievalPlan` only prepares queries/required facts for the next Avatar turn.
- `directorNotes` is optional and must only carry guidance not already represented by another structured field.
- `routing` is omitted entirely when routing is not applicable (single-Avatar scenarios). When present:
  - `stay` does not require `avatarId`.
  - `suggest` and `switch` require an active, unlocked `avatarId`.
  - `unlock` requires a locked `avatarId`, or `unlockDecisions` for multiple targets.
  - `unlock_and_switch` requires a locked `avatarId` that may immediately become active.
- The GM does not repeat the current Avatar ID as a routing target when no change occurs.
- `interactionIncrement` and `topicCovered` are not part of the output — interaction counting is app-owned, and covered-topic tracking belongs solely to memory compaction (`ConversationWorkingMemory.coveredTopics`).
- Prompt refinement may change wording but must preserve this contract and its validation path.

## State Model

```ts
type GameMasterState = {
  progression: string
  interactionCount: number
  nextTurnOrchestration?: {
    activeAvatarId: string
    generatedAfterTurn: number
    generatedAt: string
    dialogueControl: DialogueControl
    retrievalPlan: RetrievalPlan
    directorNotes?: string
    routing?: RoutingDecision
    progressionUpdate: ProgressionUpdate
    consumedAfterTurn?: number
    consumedAt?: string
  }
}
```

State meaning:

- `progression`: lightweight progress marker
- `interactionCount`: pacing context; it does not gate whether GM runs
- `nextTurnOrchestration`: the latest result retained for the immediately following matching Avatar turn; it is replaced by newer GM output and marked consumed after use.

Reducer rules:

- `interactionCount` is incremented exactly once by application code after each completed user/Avatar exchange. GM success, failure, and memory compaction do not change it.
- `progression` changes only when `progressionUpdate.progression` is `"increase"`.
- Active-Avatar ownership remains in the session/conversation records; legacy GM current-avatar state is not used for routing decisions.

## Validation Boundaries

### Avatar Switch

1. GM may return `routing.action: 'suggest'` for a non-forcing recommendation.
2. GM may return `routing.action: 'switch'` or `'unlock_and_switch'` to request a new active Avatar.
3. Runtime accepts a switch only when the target avatar belongs to the active scenario and is already unlocked or unlocked by the same valid GM output.
4. If accepted, the active conversation is closed, a new GM-started conversation is created, and the session active avatar is updated.

### Avatar Unlock

1. Session start seeds `session.unlockedAvatarIds` from `scenario.avatarAvailability.initialAvatarIds`.
2. GM may return `routing.action: 'unlock'` or `'unlock_and_switch'`, targeting a locked avatar via `avatarId`/`reason` or multiple via `unlockDecisions`.
3. Runtime ignores inactive IDs, duplicate IDs, already-unlocked IDs, and invalid targets.
4. `GET /v1/sessions/{sessionId}/available-avatars` remains the player-facing source of truth.

## Model Resolution

GM runtime model precedence is:

1. `scenario.modelSelection.gameMasterOverride`
2. `scenario.modelSelection.defaultProfile`
3. global Game Master role override
4. global default

If a scenario has no explicit `modelSelection`, GM falls back to the global config path.

## Prompt Structure Rules

The static GM prompt is intentionally short and organized into:

- `Role`
- `Responsibilities`
- `Fact Discipline`
- `Decision Policies` (dialogue control, retrieval planning, director notes, avatar routing, progression)
- `Output Contract`

The dynamic GM input renderer is organized into:

- `Current Turn`
- `Current Discussion Context`
- `Experience Context`
- `Output Reminder`

The static prompt is also built dynamically from the current avatar roster:

- A single active Avatar omits routing entirely — from the prose, the field, and the JSON schema.
- No locked Avatars omits unlock instructions, unlock actions, and locked-Avatar metadata.
- Locked Avatars present includes only the valid locked targets.
- Multiple active Avatars includes `stay`, `suggest`, `switch`, plus unlock actions when applicable.

Prompt wording may evolve, but these rules must hold:

- JSON-only output matching `GameMasterOutput`
- evidence-based bias toward `dialogueControl.mode: 'user_led'`/`'avatar_guided'` over forcing routing or progression changes
- no default progression increase without evidence
- prefer `routing.action: 'suggest'` over a forced `'switch'` when possible
- no prompt-only fields that fork `GameMasterInput`
- no generic Director Notes that merely restate permanent Avatar rules

## Diagnostics

Successful runs emit `gm_triggered`; safe failures emit `gm_error`.

Required diagnostic properties:

- correlation with the originating turn
- trigger reason
- turn index
- interaction count
- state before/after
- safe decision summary
- latency and token metadata when available

Diagnostics must never include:

- raw prompts
- raw provider payloads
- raw user-message content
- secrets or credentials

## Admin Inspection Boundary

`GET /v1/admin/sessions/{sessionId}/context` exposes a bounded current snapshot of the same inputs used by Avatar and GM assembly.

- Avatar context is sectioned for avatar runtime consumption.
- GM context exposes bounded recent messages, GM state, user persona, memory, retrieval, scenario context, and avatar availability.
- `workingSummary` may appear as a compatibility mirror, but canonical working memory remains owned by the memory-compaction pipeline.

## Ownership

- GM runtime types: `apps/core/src/domain/game-master/game-master.types.ts`
- Static GM instructions: `apps/core/src/domain/game-master/gm-prompt.service.ts`
- Dynamic GM renderer: `apps/core/src/domain/game-master/gm-input-renderer.ts`
- Output parsing and normalization: `apps/core/src/domain/game-master/gm-output-parser.ts`, `gm-output-normalization.ts`
- GM-facing memory contracts: `apps/core/src/domain/memory/memory.types.ts`

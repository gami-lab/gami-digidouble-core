# Game Master contract

The Game Master (GM) is the asynchronous director of an experience. It observes completed Avatar
turns, updates lightweight orchestration state, and prepares safe guidance for future turns. The
Avatar speaks directly to the user; the GM never blocks or delays the normal Avatar response path,
and it owns orchestration decisions, not tone or final wording.

Terms: a `session` is one experience run; a `conversation` is one bounded Avatar dialogue episode
inside a session.

## Non-negotiables

- Run after a completed Avatar turn, on session start when configured, or by explicit admin replay.
- An interrupted message stream is not a completed turn: the user message is kept, no partial
  Avatar content is persisted, and no post-turn GM work runs.
- If the Avatar can handle a decision alone, GM should not own it.
- GM input/output contracts stay stable even as prompt wording changes.
- Keep routing/lifecycle ownership in the session/conversation application use cases, not in GM.
- Treat model output as untrusted. Parse a strict current shape, validate all references, and
  ignore invalid actions safely rather than failing the turn.
- Persist bounded current orchestration state and safe diagnostics; never persist raw prompts, raw
  model output, or user text in events.
- Keep static retrieved context strictly separate from conversational memory (same separation
  contract enforced for the Avatar projection: memory only under conversation state, static
  knowledge only under retrieved context — see EPIC 4.2d).
- GM failures are caught and logged without affecting the user-visible reply.

## Runtime inputs

GM input is a bounded projection of:

- scenario language, goals, rules, and the active Avatar roster (available/locked)
- session active Avatar id (authoritative; not duplicated into `GameMasterState`) and transition
  state
- the completed turn plus bounded recent conversation state — recent messages/exchanges, the
  current working-memory summary projection, episodic memory entries (with their selection
  reasons and score), and promoted long-term facts. This is the _only_ home for conversational
  memory in the GM projection.
- static scenario knowledge retrieval (avatar knowledge, world, media), each item carrying
  source/chunk/type provenance — never treated as memory or as a fact-extraction input
- explicit `gm_unrestricted` retrieval visibility for GM: Avatar retrieval may be
  visibility-filtered, but GM sees an unrestricted corpus only through this explicit mode. A
  missing active avatar is not itself an authorization bypass.
- pending guidance from the previous GM turn, consumed at most once

The exact input DTO lives in `apps/core/src/domain/game-master/game-master.types.ts`; treat this
section as the ownership/safety boundary, not a field-by-field template.

## Runtime output

The current output contains only structured, validated decisions:

- `dialogueControl`: mode (`user_led`/`avatar_guided`/`avatar_led`/`repair`/`transition`) plus an
  explicit `askFollowUp` boolean — never inferred from mode alone.
- `directorNotes`: required, non-empty, one concise sentence of guidance for the next Avatar turn.
  It must complement the structured fields, not restate permanent Avatar rules or the other
  fields.
- `progressionUpdate`: `none` unless there is real evidence of progress; no default increase.
- `retrievalPlan`: optional next-turn retrieval queries and required facts. GM does not execute
  retrieval itself — it only plans; the Avatar pipeline runs the actual RAG lookup for the next
  turn using these queries. `required` should be false only for greetings, purely emotional
  reflection, or pure stylistic guidance; factual who/what/where/when/how-many questions or
  questions about named people/events/places/relationships require a plan even if the latest
  reply already sounds coherent. Queries and facts must be phrased in the scenario description's
  language, since RAG documents are stored in that language. If retrieval later fails or returns
  nothing, the Avatar gets explicit insufficient-evidence guidance rather than fabricated
  certainty.
- `routing`: omitted entirely for single-Avatar scenarios (from prose, field, and schema). When
  present: `stay` needs no `avatarId`; `suggest`/`switch` require an active, unlocked `avatarId`;
  `unlock`/`unlock_and_switch` require a locked `avatarId` (or `unlockDecisions` for several
  targets). GM never repeats the current Avatar as a routing target.

The parser rejects missing required current fields and obsolete/legacy shapes. Empty or invalid
proposals are ignored or reduced to a safe `stay` outcome; they cannot mutate lifecycle state.
`interactionIncrement` and topic-covered tracking are intentionally not part of the output —
interaction counting is app-owned and covered-topic tracking belongs solely to memory compaction
(`ConversationWorkingMemory.coveredTopics`).

## State model

`GameMasterState` holds `progression` (lightweight marker), `interactionCount` (pacing context —
does not gate whether GM runs), and `nextTurnOrchestration` (the latest GM result, retained only
for the immediately following matching Avatar turn, replaced by newer output and marked consumed
after use).

Reducer rules:

- `interactionCount` increments exactly once, by application code, after each completed
  user/Avatar exchange — GM success, failure, or memory compaction never change it.
- `progression` changes only when `progressionUpdate.progression` is `increase`.
- Active-Avatar ownership stays in the session/conversation records; there is no legacy GM
  current-avatar state used for routing.

## Routing and progression

- A GM routing proposal may update the session's _next_ active Avatar after validation, but does
  not itself create, close, or switch a conversation.
- The runtime accepts a switch only when the target belongs to the active scenario and is already
  unlocked, or is unlocked by the same valid GM output.
- If accepted, the explicit session-switch use case closes the active conversation, opens a new
  one, and updates the session's active avatar — the async GM only records the target and does
  not perform or duplicate this lifecycle transition.
- Avatar unlock: session start seeds `session.unlockedAvatarIds` from
  `scenario.avatarAvailability.initialAvatarIds`; the runtime ignores inactive, duplicate,
  already-unlocked, or invalid unlock targets. `GET /v1/sessions/{sessionId}/available-avatars`
  remains the player-facing source of truth for what's actually unlocked.

## Model resolution

GM model precedence: `scenario.modelSelection.gameMasterOverride` →
`scenario.modelSelection.defaultProfile` → global Game Master role override → global default. A
scenario with no explicit `modelSelection` falls back to the global config path.

## Prompt structure rules

The static GM prompt stays short: `Role`, `Responsibilities`, `Fact Discipline`,
`Decision Policies` (dialogue control, retrieval planning, director notes, avatar routing,
progression), `Output Contract`. The dynamic input renderer covers `Current Turn`,
`Conversation State`, `Experience Context`, `Retrieved Context`, `Output Reminder`.

The static prompt is built dynamically from the current avatar roster: a single active Avatar
omits routing entirely (prose, field, and JSON schema) and omits the current Avatar id from the
dynamic input since identity is unambiguous; no locked Avatars omits unlock instructions/actions;
locked Avatars present includes only valid locked targets; multiple active Avatars includes
`stay`/`suggest`/`switch` plus unlock actions when applicable.

Prompt wording may evolve, but these rules must hold: JSON-only output matching
`GameMasterOutput`; evidence-based bias toward `user_led`/`avatar_guided` over forcing routing or
progression changes; no default progression increase without evidence; prefer `suggest` over a
forced `switch` when possible; no prompt-only fields that fork the input contract; no generic
director notes that merely restate permanent Avatar rules.

## Retrieval guidance

GM retrieval is forward-looking: it may prepare evidence for the likely next subject, exact
questions, contradictions, or knowledge-boundary issues, assuming the current subject continues
unless the exchange clearly closes or changes it. Planned retrieval is consumed only when relevant
to the next Avatar turn; stale or unrelated plans are suppressed. Knowledge embedding, vector
retrieval, and reindex work stay outside the GM timing contract — they run through the shared
knowledge application boundary, never block Avatar responses, and never change GM chat model
selection. GM RAG queries contain only the working-memory summary and the latest complete user/Avatar
exchange; they do not include the static scenario description or multiple historical exchanges. A
provider/search failure yields bounded empty RAG context; the async GM turn stays observable and
non-blocking.

## Diagnostics

Successful runs emit `gm_triggered`; safe failures emit `gm_error`. Record: correlation with the
originating turn, trigger reason, turn index, interaction count, state before/after, a safe
decision summary, and latency/token metadata when available. Never emit raw prompts, raw provider
payloads, raw user-message content, vectors, unbounded document content, or secrets/credentials.

`GET /v1/admin/sessions/{sessionId}/context` exposes a bounded current snapshot of the same inputs
used by Avatar and GM assembly — Avatar context sectioned for avatar runtime consumption, GM
context exposing bounded recent messages/exchanges, working memory, episodic memories, long-term
facts, static retrieval, scenario context, and avatar availability under separate projections.
Canonical working memory stays owned by the memory-compaction pipeline; GM diagnostics reuse the
same current layered projection.

## Ownership

The GM owns planning and structured guidance. Conversation owns lifecycle. Memory owns compaction
and fact promotion. Knowledge owns static retrieval. Operations owns replay and inspection.
API/shared types own public projections.

- GM runtime types: `apps/core/src/domain/game-master/game-master.types.ts`
- Static GM instructions: `apps/core/src/domain/game-master/gm-prompt.service.ts`
- Dynamic GM renderer: `apps/core/src/domain/game-master/gm-input-renderer.ts`
- Output parsing/normalization: `gm-output-parser.ts`, `gm-output-normalization.ts`
- GM-facing memory contracts: `apps/core/src/domain/memory/memory.types.ts`
- Public/admin GM and event projections: `packages/shared/src/runtime-inspector-types.ts` and
  `packages/shared/src/runtime-types.ts`, mapped at the Core application/API boundary — full
  cross-layer map in [CONTEXT_CONTRACT_OWNERSHIP_MAP.md](CONTEXT_CONTRACT_OWNERSHIP_MAP.md).

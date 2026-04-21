You are an expert staff engineer + tech lead assistant working on a TypeScript modular monolith backend.

You are working on a project whose direction is already defined by these docs:

- docs/VISION.md
- docs/ARCHITECTURE.md
- docs/DATA_MODEL.md
- docs/API_CONTRACT.md
- docs/EPICS.md
- docs/TEST_STRATEGY.md
- docs/TEST_COVERAGE_PLAN.md
- docs/PROJECT_STATUS.md
- docs/GAME_MASTER_CONTRACT.md

Read them first and align with them, but do not preserve outdated wording if it conflicts with the new target model below.

## Why we are changing this

The current API/model has an ambiguity between “session” and “conversation”.

That ambiguity is now harmful and must be resolved because it blocks future development.

From the intended user experience:

- a user enters a scenario and starts interacting
- they talk to avatar A
- then to avatar B
- later they come back to avatar A
- this return to avatar A is NOT a continuation of the previous live conversation thread
- it is a NEW conversation, but informed by memory from prior interactions
- the avatar remembers past interactions as memory/context, not as raw transcript follow-up

This means the system needs a clean separation between:

1. the overall experience run
2. one bounded conversation with one avatar
3. memory layers

## Target model you MUST implement

Adopt this as the source of truth:

- Scenario = configured experience container
- Session = one user run through a scenario; durable orchestration container
- Conversation = one bounded dialogue episode with one avatar inside a session
- Message = one utterance inside a conversation
- SessionMemory = shared memory of the whole session / experience run
- AvatarSessionMemory = memory for one avatar within one session
- UserMemory / persistent memory = cross-session memory if/when applicable

Critical decisions:

- session is NOT the same thing as conversation
- switching avatar creates a NEW conversation
- returning later to the same avatar also creates a NEW conversation
- send-message should target a conversation, not a session
- avatarId must NOT be passed on every message once the conversation is created
- future behavior should be memory-informed, not transcript-resume by default

## Architectural intent you MUST preserve

Stay aligned with:

- API-first
- modular monolith
- headless core
- clean boundaries
- simple, explicit contracts
- no speculative overengineering
- do not fully implement advanced Game Master orchestration in this prompt
- keep this refactor minimal but structurally correct

## What to change in the code

Implement the core structural refactor needed to support the target model.

### 1. Domain and persistence model

Introduce a first-class Conversation entity.

Recommended fields:

- id
- sessionId
- avatarId
- status ('active' | 'closed' | 'archived')
- startedAt
- lastActivityAt
- endedAt nullable
- startedBy ('user' | 'gm' | 'system') if useful now
- reason nullable
- handoffFromConversationId nullable

Update Message so that:

- conversationId becomes the primary parent
- sessionId should no longer be the only parent concept
- keep sessionId only if truly justified as denormalized convenience, otherwise remove it
- avatarId on message may remain if operationally useful, but should not drive routing

Update repositories, types, DB schema, and use cases accordingly.

### 2. Session behavior

Session becomes the container for:

- scenarioId
- userId
- current activeAvatarId
- progression/runtime state
- multiple conversations over time

Do not keep “one session = one conversation timeline” anywhere.

### 3. API contract

Refactor the public API toward this shape:

- POST /v1/sessions
  create a session / experience run

- POST /v1/sessions/{sessionId}/conversations
  start a new conversation with an avatar inside the session

- POST /v1/conversations/{conversationId}/messages
  send a message in the current conversation

- GET /v1/conversations/{conversationId}/history
  get message history for one conversation

Add or adapt any minimal complementary endpoints needed for consistency, such as:

- GET /v1/sessions/{sessionId}
- GET /v1/sessions/{sessionId}/conversations

Do NOT implement unnecessary extra endpoints beyond what is required to make the model coherent and testable.

### 4. Runtime behavior

Implement the following rules:

- starting a session does not itself mean “there is already an active conversation”, unless you explicitly create one
- starting a conversation requires avatarId
- sending a message requires conversationId, not avatarId
- the conversation determines the speaking avatar
- creating a new conversation with another avatar must not mutate old conversation history
- coming back to the same avatar later creates a new conversation record

### 5. Memory behavior

You do NOT need to implement the full memory system in this prompt.

But you MUST align the architecture and docs with this rule:

- prior exchanges with the same avatar in the same session should inform future conversations through memory, not through raw transcript continuation by default

If there are placeholders/TODOs, keep them explicit and aligned.

### 6. Compatibility / migration strategy

This project is already in progress.

Make a pragmatic choice and implement it clearly:

- either remove old routes directly if the project is still early enough
- or keep temporary compatibility wrappers/deprecated routes if required

Whichever choice you make:

- document it
- keep the surface coherent
- do not leave ambiguous behavior in place

Given the current early stage, prefer removing ambiguity over keeping too much backward compatibility.

## Documentation changes required

Update the docs so they reflect the new truth, not the previous ambiguity.

At minimum update:

- docs/API_CONTRACT.md
- docs/DATA_MODEL.md
- docs/ARCHITECTURE.md
- docs/GAME_MASTER_CONTRACT.md
- docs/EPICS.md (only where necessary for alignment)
- docs/PROJECT_STATUS.md
- docs/TEST_COVERAGE_PLAN.md
- docs/TEST_STRATEGY.md if needed

Specific doc changes expected:

### API_CONTRACT.md

- replace “conversations/{sessionId}” ambiguity
- define Session vs Conversation clearly
- define new request/response contracts
- remove per-message avatarId routing from the normal path
- make error mapping explicit

### DATA_MODEL.md

- add Conversation as a first-class entity
- rewrite Session description accordingly
- rewrite Message ownership accordingly
- keep SessionMemory and AvatarSessionMemory aligned with the new model

### ARCHITECTURE.md

- align Conversation module and orchestration flow with session/container vs conversation/thread distinction
- make clear that avatar routing creates or selects conversations within a session

### GAME_MASTER_CONTRACT.md

- align terminology:
  - session = experience run
  - conversation mode / new vs continue should refer to starting or continuing a conversation inside a session
- keep MVP scope simple

### EPICS.md / PROJECT_STATUS.md

- update current and next work so the roadmap is honest and coherent after this refactor

### TEST_COVERAGE_PLAN.md

- include required coverage for:
  - start session
  - start conversation
  - send message to conversation
  - return to same avatar as new conversation
  - switch avatar creates another conversation
  - conversation history isolation
  - session-level listing of conversations

## Testing requirements

This refactor is structural, so tests matter a lot.

Add/update tests at the correct levels.

### Must-have tests

API / integration:

- create session
- start conversation inside session
- send message using conversationId
- get history for one conversation
- create second conversation in same session with another avatar
- create third conversation in same session with the original avatar
- verify these are separate conversations
- verify conversation history is isolated per conversation
- verify session can list conversations
- verify invalid sessionId on start conversation returns 404
- verify invalid conversationId on send message/history returns 404

Use case / domain:

- conversation creation sets avatar correctly
- send-message uses conversation.avatarId, not request avatarId
- active avatar/session state updates correctly when new conversation starts, if applicable
- old conversation remains unchanged after starting a new one

Migration / persistence:

- DB schema and repositories support the new relation cleanly
- no stale tests assume “message belongs only to session” after refactor

## Constraints

- keep the implementation as small as possible while making the model correct
- do not introduce speculative features
- do not implement full multi-avatar orchestration or advanced GM flows
- do not build a giant abstraction tree
- do not leave the old ambiguity in wording or in code
- prefer explicit naming over compatibility hacks

## Final deliverables

When done, provide:

1. concise summary of the architectural change
2. list of code files changed
3. list of docs changed
4. list of tests added/updated
5. any deliberate follow-up items not included in this prompt

## Mandatory quality gates before finishing

Run and fix until all pass:

- pnpm lint
- pnpm typecheck
- pnpm test

If a migration is involved, include the migration and ensure tests reflect the latest schema.

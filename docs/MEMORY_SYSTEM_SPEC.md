# MEMORY_SYSTEM_SPEC.md

## Purpose

Define the expected behavior of the Avatar and Game Master memory system.

The goal is not only to store memory, but to make conversations feel:

- continuous
- coherent
- bounded
- inspectable
- reusable across conversations

This document defines the target memory behavior for:

- Avatar continuity
- Game Master orchestration
- Context assembly
- Long-running conversations
- Cross-conversation recall

This specification complements:

- `ARCHITECTURE.md`
- `DATA_MODEL.md`
- `GAME_MASTER_CONTRACT.md`
- `PRINCIPLES.md`

## Contract Ownership Map

- Domain/internal memory contracts owner:
  - `apps/core/src/domain/memory/memory.types.ts`
- Shared HTTP/admin DTO contracts owner:
  - `packages/shared/src/memory-contract-types.ts`
  - composed by `packages/shared/src/lifecycle-types.ts` and `packages/shared/src/runtime-inspector-types.ts`
- Nullability rule:
  - internal/domain optional fields use `undefined`
  - explicit `null` is reserved for API contracts that intentionally require `null`

---

# 1. Core Mental Model

The memory system is based on three memory layers:

1. Short-Term Memory
2. Conversation Working Memory
3. Long-Term Episodic Memory

The system does NOT replay full transcript history by default.

The memory system exists to:

- preserve continuity
- bound context size
- improve orchestration quality
- allow avatars to remember previous interactions
- allow the Game Master to reason over previous interactions

The memory system is inspired more by human memory behavior than by transcript archival.

---

# 2. Design Principles

## 2.1 Bounded Context Always

The system must never depend on replaying full conversation history.

Context must remain bounded regardless of discussion duration.

---

## 2.2 Memory Is Reconstructed

Memory is not a perfect archive.

Memory is a compact reconstruction of important information.

Minor inaccuracies are acceptable and natural.

---

## 2.3 Context Over Storage

The value of memory is not persistence itself.

The value comes from:

- selecting useful information
- preserving continuity
- removing noise
- helping reasoning

---

## 2.4 Async By Default

Memory maintenance should happen asynchronously whenever possible.

Avatar response latency is more important than immediate memory refresh.

---

## 2.5 Observability Is Mandatory

Memory systems silently degrading while appearing functional is a major risk.

All important memory decisions must therefore be inspectable and observable.

---

# 3. Memory Layers

---

## 3.1 Short-Term Memory

Short-term memory contains the most recent verbatim exchanges.

Purpose:

- immediate conversational continuity
- references to recent messages
- preserve conversational flow

This memory is assembled directly from messages.

It is NOT stored as a dedicated memory entity.

Default policy:

- keep last 2 complete exchanges
- optionally allow 3 exchanges for experimentation/debugging
- never inject full transcript history

Example:

```text
User: ...
Avatar: ...
User: ...
Avatar: ...
```

Success condition:

- the Avatar correctly understands “what was just said”
- immediate references work naturally
- context remains bounded

---

## 3.2 Conversation Working Memory

Conversation working memory is the evolving summary of the CURRENT active conversation.

It answers:

- what has happened so far?
- what important information was exchanged?
- what is the current direction of the discussion?
- what unresolved threads still exist?
- what should not be repeated?

This memory belongs to one conversation.

Since a conversation is attached to one avatar, this memory is naturally avatar-scoped.

There is no separate “avatar working memory” layer.

The conversation working memory is updated asynchronously during the discussion.

Default refresh policy:

- refresh every 3 exchanges
- refresh on conversation close
- refresh on avatar switch
- refresh on explicit admin trigger

Refresh input:

- previous working memory
- recent verbatim exchanges
- conversation metadata
- avatar identity
- scenario information

Refresh output:

- rewritten bounded summary
- extracted candidate user facts
- optional candidate long-term episodic memory

The memory must be rewritten, not blindly appended.

The goal is bounded continuity regardless of conversation duration.

Success condition:

- after 30+ turns, the Avatar still understands the discussion
- the system does not require full transcript replay
- repeated information is compacted naturally

---

## 3.3 Long-Term Episodic Memory

Long-term memory represents completed previous interactions between:

- one user
- one avatar
- one scenario

This is episodic memory.

It is NOT a generic fact database.

Each completed conversation generates one long-term memory.

This memory contains:

- discussion summary
- important discoveries
- important explanations
- unresolved topics
- emotional or relational continuity when relevant
- extracted user facts

Long-term memory is immutable during normal operation.

It represents:

> what the avatar remembers from previous encounters

Minor inconsistencies are acceptable and natural.

Long-term memory scope is:

- user + avatar + scenario

Success condition:

- the Avatar naturally remembers previous discussions
- continuity exists across separate conversations
- conversations feel persistent over time

---

# 4. Conversation Lifecycle

---

## 4.1 During Conversation

As the discussion progresses:

1. short-term memory evolves naturally from recent exchanges
2. conversation working memory is periodically refreshed
3. extracted user facts may be proposed
4. Game Master can observe the evolving memory state

The full transcript should never become required context.

---

## 4.2 Conversation Close

When a conversation ends:

1. final working memory refresh runs
2. a long-term episodic memory is generated
3. extracted user facts are persisted
4. temporary working state may be discarded

Each closed conversation produces exactly one episodic memory.

---

## 4.3 Starting a New Conversation

When a new conversation starts:

1. previous long-term memories are fetched
2. relevant memories are selected
3. selected memories are synthesized
4. an initial conversation working memory is created
5. the Avatar starts already remembering previous interactions

The Avatar does NOT receive raw previous transcripts.

The Avatar receives a compact reconstructed memory.

Success condition:

- the first answer can naturally reference previous interactions when relevant

---

# 5. Long-Term Memory Retrieval

There is no strict hard limit on memory retrieval.

Typical expected usage:

- fewer than 10 interactions per avatar

Implementation may still apply bounded retrieval windows for performance reasons.

The system should prioritize:

- relevance
- recency
- continuity
- unresolved topics

The system should avoid:

- duplicate memories
- repetitive retrieval
- irrelevant old discussions

---

# 6. User Facts

User facts are extracted from long-term episodic memories.

Facts are NOT extracted directly from raw transcripts.

This ensures:

- better signal quality
- reduced noise
- more stable memory evolution

Examples:

Good user facts:

- preferred learning style
- known expertise
- long-term goals
- stable preferences
- recurring interests

Bad user facts:

- greetings
- temporary conversational details
- irrelevant small talk
- unstable emotional reactions

---

# 7. Game Master Access

The Game Master can access all long-term memories.

The GM uses memory to:

- avoid repetition
- unlock avatars
- suggest avatar switches
- understand progression
- understand previous interactions
- adapt pacing
- adapt orchestration

The GM receives memory as structured context.

The GM does NOT replay full transcripts.

---

## 7.1 Memory Selection Observability

Memory selection decisions must be observable.

The system should record:

- what memories were selected
- why they were selected
- how they influenced GM reasoning
- how they influenced avatar context assembly

This becomes part of GM observability.

---

# 8. Hydration Behavior

Hydration starts immediately when a conversation is created.

The ideal behavior is:

1. create conversation
2. hydrate memory
3. assemble context
4. Avatar answers

If the user sends a message before hydration completes:

- the additional delay is considered acceptable startup latency

Correct memory continuity is more important than ultra-low startup latency.

---

# 9. Memory Refresh Contract

Memory refresh must be explicit and structured.

---

## 9.1 Refresh Trigger Types

Possible triggers:

- `post_turn`
- `conversation_closed`
- `avatar_switch`
- `manual_admin`

---

## 9.2 Refresh Input

```ts
type MemoryRefreshInput = {
  trigger: 'post_turn' | 'conversation_closed' | 'avatar_switch' | 'manual_admin'

  sessionId: string
  conversationId: string
  avatarId: string

  previousWorkingMemory?: string

  recentExchanges: Array<{
    user: string
    avatar: string
  }>

  longTermMemories?: Array<{
    memoryId: string
    summary: string
  }>
}
```

---

## 9.3 Refresh Output

```ts
type MemoryRefreshOutput = {
  workingMemory: string

  candidateLongTermMemory?: {
    summary: string
  }

  extractedFacts?: Array<{
    category: string
    key: string
    value: string
  }>

  changedSincePrevious?: string[]

  droppedInformation?: string[]

  warnings?: string[]
}
```

All outputs must be schema validated.

No raw free-form LLM output enters persistence directly.

---

# 10. Long-Term Memory Data Model

A dedicated long-term memory entity is required.

Suggested entity:

```ts
type ConversationMemory = {
  id: string

  userId: string
  scenarioId: string
  avatarId: string

  sessionId: string
  conversationId: string

  summary: string

  facts: Array<{
    category: string
    key: string
    value: string
  }>

  unresolvedThreads?: string[]

  relevanceTags?: string[]

  createdAt: string
  updatedAt: string
}
```

This complements:

- `user_memory_facts`

The distinction is:

| Entity                  | Purpose                                  |
| ----------------------- | ---------------------------------------- |
| `user_memory_facts`     | stable extracted user facts              |
| `conversation_memories` | episodic memory of previous interactions |

---

# 11. Debugging Requirements

The console memory inspector must display:

- current short-term exchanges
- current conversation working memory
- selected long-term memories
- hydration sources
- memory refresh events
- memory evolution diffs
- stale memory warnings
- extracted facts
- dropped information
- GM memory selection reasoning

The operator must understand:

- what the system remembers
- why it remembers it
- how memory influenced orchestration

---

# 12. Acceptance Tests

---

## 12.1 Short-Term Memory

Given a long conversation
When the Avatar answers
Then only the last 2–3 exchanges are injected verbatim.

---

## 12.2 Working Memory

Given a 30+ turn conversation
When periodic refresh occurs
Then the conversation working memory remains bounded and coherent.

---

## 12.3 Conversation Closure

Given a conversation is closed
When memory compaction completes
Then one episodic memory exists for that conversation.

---

## 12.4 New Conversation Continuity

Given previous conversations exist with the same avatar
When a new conversation starts
Then the Avatar remembers previous interactions naturally.

---

## 12.5 GM Memory Access

Given previous discussions already covered a topic
When the GM runs
Then GM context includes relevant episodic memory.

---

## 12.6 Memory Failure Isolation

Given memory refresh fails
When the Avatar answers
Then the Avatar response still succeeds and the failure is logged.

---

# 13. Non-Goals

This version of the system does NOT attempt to implement:

- perfect memory fidelity
- emotional simulation
- human-level autobiographical memory
- infinite recall
- vector-only memory architecture
- memory quality scoring inside runtime orchestration

These may evolve later if justified by real usage.

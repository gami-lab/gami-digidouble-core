# Memory System Spec

## Purpose

Compact behavioral spec for memory in the Avatar and Game Master runtime.

This spec defines:

- memory layers
- refresh and compaction boundaries
- retrieval rules
- ownership rules

Persistence details live in `DATA_MODEL.md`.
GM-specific usage rules live in `GAME_MASTER_CONTRACT.md`.

## Ownership Rules

- Domain/internal memory contracts: `apps/core/src/domain/memory/memory.types.ts`
- Shared HTTP/admin DTOs: `packages/shared/src/memory-contract-types.ts`
- Compatibility mirrors such as `workingSummary` are summary-only mirrors of canonical working memory.
- New working-memory fields must be added to the canonical owner first, then projected outward deliberately.

## Core Model

The runtime uses three memory layers:

1. short-term memory
2. conversation working memory
3. long-term episodic memory

The system does not rely on replaying full transcript history by default.

## Memory Layers

### Short-Term Memory

Purpose:

- immediate conversational continuity
- “what was just said” context

Rules:

- assembled directly from recent messages
- not persisted as a dedicated memory entity
- default window is the last 2 complete exchanges
- must remain bounded

### Conversation Working Memory

Purpose:

- compact understanding of the active conversation
- current direction, unresolved threads, covered topics, candidate facts

Rules:

- scoped to one conversation
- refreshed asynchronously during the discussion
- rewritten, not blindly appended
- persisted in `conversation_working_memories`

Canonical working-memory content:

- `summary`
- `unresolvedThreads`
- `coveredTopics`
- `candidateFacts`

Default refresh triggers:

- periodic post-turn refresh
- conversation close
- avatar switch
- explicit admin trigger

Quality rules:

- summary merges prior memory with newly integrated exchanges
- `coveredTopics` stores discussed subjects, not inferred orchestration state
- `unresolvedThreads` keeps only active loose ends
- candidate facts remain factual and persistent
- inferred mood, trust, pacing, or progression do not become memory facts

### Long-Term Episodic Memory

Purpose:

- cross-conversation continuity for one `user + avatar + scenario`

Rules:

- created from closed conversations
- stored in `conversation_memories`
- retrieved as compact prior episodes, not transcript replay
- minor summarization imprecision is acceptable

Typical content:

- summary
- key discoveries
- unresolved topics
- fact candidates

## Conversation Lifecycle

### During Conversation

- short-term memory evolves from recent exchanges
- working memory is refreshed periodically
- user fact candidates may be proposed
- GM can observe current memory state

### Conversation Close

- final working-memory refresh runs
- episodic memory is produced
- structured user facts may be persisted
- active conversation working state can be discarded

### Starting A New Conversation

- prior episodic memories are selected
- relevant memories are synthesized into bounded context
- a new conversation working-memory record is established
- Avatar starts with compact recall, not old transcript replay

## Retrieval Rules

Selection should favor:

- relevance
- recency
- continuity
- unresolved topics

Selection should avoid:

- duplicate memories
- repetitive retrieval
- irrelevant old episodes

Hard requirement:

- memory retrieval remains bounded even if the total number of prior conversations grows

## User Facts

Purpose:

- stable structured cross-session memory

Rules:

- facts are extracted from compacted memory outputs, not directly from raw transcripts
- facts should represent stable preferences, expertise, goals, or recurring interests
- greetings, fleeting conversational details, and unstable reactions are poor fact candidates

## Game Master Access

- GM can consume structured memory across layers.
- GM does not replay full transcripts.
- GM uses memory to avoid repetition, pace progression, unlock avatars, and improve routing decisions.

## Observability

Memory decisions must be inspectable.

Important observable outputs:

- selected memory layers
- memory selection reasons
- refresh trigger type
- kept vs trimmed behavior where exposed
- safe admin/runtime snapshots of working memory

Observability must stay safe:

- no secrets
- no raw prompt dumps
- no unbounded transcript payloads

## Refresh Contract

Trigger types used by the runtime:

- `post_turn`
- `conversation_closed`
- `avatar_switch`
- `admin_trigger`

Refresh inputs conceptually include:

- session and conversation identity
- active avatar
- previous working memory
- recent exchanges
- selected episodic memories when relevant

Refresh outputs conceptually include:

- updated working memory
- candidate episodic memory
- extracted facts
- optional diagnostic change metadata

All persisted outputs must be normalized and validated before storage.

## Non-Goals

- perfect transcript fidelity
- infinite recall
- emotional simulation as memory state
- vector-only memory architecture
- letting memory replace Game Master orchestration logic

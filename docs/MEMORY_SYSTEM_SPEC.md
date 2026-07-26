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

### Vocabulary And Boundedness

An **exchange** is one complete pair of messages: one `user` message followed by one
`avatar` message. `system` messages are not exchanges. An incomplete pair is never exposed as a
recent exchange.

The short-term window retains at most the **three most recent complete exchanges**, in
chronological order. It is a runtime projection built from `messages`; it is not a second
transcript store. Message retrieval may read a larger bounded slice in order to pair messages and
to determine which exchanges were already integrated into working memory, but only three complete
exchanges may reach the Avatar or GM context.

This limit is separate from the compaction batch. Compaction may read more than three recent
messages so that it can rewrite working memory without losing continuity.

## Memory Layers

### Short-Term Memory

Purpose:

- immediate conversational continuity
- “what was just said” context

Rules:

- assembled directly from recent messages
- not persisted as a dedicated memory entity
- default window is the last 3 complete exchanges
- only complete `user` + `avatar` pairs are retained
- ordering is oldest-to-newest inside the selected window
- must remain bounded

Selection behavior:

1. Load a bounded message slice for the active conversation.
2. Order messages by creation time and form complete exchanges.
3. If working memory has a refresh timestamp, prefer complete exchanges created after that
   timestamp; cap the result at three.
4. If there are no exchanges after the refresh, use the last three complete exchanges as a
   continuity fallback.
5. If no working memory exists yet, use the last three complete exchanges.

The fallback prevents a recently refreshed summary from leaving the Avatar without immediate
dialogue context. It does not mean that the full transcript is replayed.

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

The compactor treats Avatar statements as conversational claims, not automatically canonical
facts. A challenged or contradicted Avatar claim is not a candidate fact unless it is supported by
an explicit user statement, labeled verified context, an application-confirmed fact, or a safe
unchallenged stable fact. If a contradiction has no verified resolution, it remains an
`unresolvedThread`; uncertainty is preserved rather than resolved by recency. Model-generated
error explanations such as “my memories are confused” are not character facts unless the scenario
explicitly establishes them.

When canonical or retrieved material is supplied, the compactor input labels it under
`## VERIFIED CONTEXT` with its provenance. The compactor is not expected to infer authority from
raw conversation alone.

Working-memory refresh is a rewrite, not an append. The refresh input contains the previous
working-memory snapshot and a bounded recent message batch. The output is normalized before the
single conversation-scoped row is upserted:

| Field               | Meaning                                                 | Lifecycle rule                                                                                |
| ------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `summary`           | Current compact understanding of the conversation       | Merge prior memory with newly integrated exchanges; remove repetition and superseded wording. |
| `coveredTopics`     | Subjects already discussed                              | Keep factual, deduplicated topic labels; do not use it as orchestration state.                |
| `unresolvedThreads` | Active questions, promises, or loose ends               | Remove an item when the recent exchanges clearly resolve it; retain only active items.        |
| `candidateFacts`    | Explicit, factual signals that may become durable facts | Keep grounded and bounded; reject inferred mood, trust, pacing, progression, or sentiment.    |

`candidateFacts` are not the same as validated user facts. They are the compacted source material
for episodic memory and fact extraction. A durable `user_memory_facts` row is scoped to the user,
deduplicated by `(user_id, category, key)`, and must remain a stable fact rather than a transient
conversational observation.

There is no separate `open`/`closed` status column for a topic. A topic is considered covered when
it appears in `coveredTopics`; a thread is open when it appears in `unresolvedThreads`. Resolution
is represented by removing the thread during the next rewrite. This avoids retaining stale
“closed” entries in the prompt.

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
- working memory is refreshed after every third complete exchange (`post_turn`), and also on
  conversation close, avatar switch, or an explicit admin trigger
- user fact candidates may be proposed
- GM can observe current memory state

The refresh is asynchronous and serialized per conversation. A refresh failure must not block the
Avatar response or destroy the previous working-memory row. Every trigger has observable
started/succeeded/failed outcomes with bounded diagnostic metadata.

### Conversation Close

- final working-memory refresh runs
- episodic memory is produced
- structured user facts may be persisted
- active conversation working state can be discarded

Closing a conversation is the episodic boundary: exactly one episodic memory is created for the
closed conversation, using the latest working memory when available rather than replaying the full
transcript. Avatar switching and reset use the same boundary semantics for the conversation being
left.

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
- “Factual” means explicitly stated or directly supported by the discussion; an LLM inference is
  not a fact merely because it sounds plausible
- facts are injected in bounded number and may be updated when a later explicit statement
  supersedes the previous value

## Game Master Access

- GM can consume structured memory across layers.
- GM receives the same bounded short-term selection as the Avatar, plus the selected working,
  episodic, and long-term memory fields through its dedicated input contract.
- GM does not replay full transcripts.
- GM uses memory to avoid repetition, pace progression, unlock avatars, and improve routing decisions.

## Prompt Re-injection

Memory is re-injected at the context-assembly boundary, never by route handlers and never by
concatenating an unbounded transcript into a prompt.

### Avatar

The Avatar prompt receives memory under `## Conversation State`, in this order:

1. up to three recent complete exchanges;
2. the current session/working summary and active-avatar memory, when present;
3. bounded long-term user facts;
4. avatar awareness and the other context sections remain separate from memory.

Retrieved knowledge is added under `## Retrieved Context`; it is not silently merged into facts or
working memory. Context Engine precedence and token trimming still apply to the final assembled
prompt.

### Game Master

The GM prompt receives a separate projection of the same selected memory:

1. `Recent Exchanges` for the current discussion;
2. `Working Memory` with summary, unresolved threads, and covered topics;
3. selected `Episodic Memories` with bounded selection reasons;
4. bounded `Long-Term Facts`.

Chronological messages remain messages. Working memory is not injected as a synthetic message and
must not be duplicated in the recent-message list.

### Current Alignment Note

The target contract in this document is three exchanges. As of 2026-07-25, the repository still
contains a legacy two-exchange constant/test in the Avatar memory assembler, while the admin
inspection contract already asserts a maximum of three. The runtime constant, fallback behavior,
and tests must be aligned before this rule can be considered fully implemented.

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

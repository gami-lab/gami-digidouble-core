# Memory system

Memory is bounded conversational state, not a transcript archive. Its job is to preserve information
that improves continuity while keeping ownership, privacy, and prompt size explicit. Persistence
details live in `DATA_MODEL.md`; GM-specific usage rules live in `GAME_MASTER_CONTRACT.md`.

## Vocabulary

- **Exchange:** one complete `user` message followed by one `avatar` message, in that order.
  `system` messages are not exchanges, and an incomplete pair is never exposed as a recent exchange.
- **Conversation working memory:** compact, rewritten (not appended) state for one conversation episode.
- **Episodic memory:** durable summaries of completed conversation episodes, for one user + avatar + scenario.
- **User fact:** long-lived user-specific information, separate from scenario knowledge.
- **Static knowledge:** scenario-owned Avatar/world/media content, always carrying source/chunk/type
  provenance; it is not memory. Static source/chunk metadata cannot carry `userId`, `sessionId`, or
  `conversationId`, and is never converted into a conversational-memory record — even though static
  retrieval may use conversational text (e.g. a working-memory summary) as its query.

## Layers and owners

| Layer            | Scope                            | Owner                              | Rule                                                                                                                                                                     |
| ---------------- | -------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Recent exchanges | conversation                     | context assembly                   | At most the three most recent complete exchanges, oldest-to-newest; never incomplete pairs. This is a runtime projection over `messages`, not a second transcript store. |
| Working memory   | conversation                     | memory compaction                  | `summary`, `unresolvedThreads`, `coveredTopics`, `candidateFacts`. Rewritten each refresh, not blindly appended; persisted in `conversation_working_memories`.           |
| Episodic memory  | conversation/user-facing history | memory maintenance                 | Compact completed episodes, stored in `conversation_memories`; hydrate only bounded relevant records, never transcript replay.                                           |
| User facts       | user                             | fact extraction/deletion use cases | Stable preferences/expertise/goals only; deduplicated by `(user_id, category, key)`; allow explicit deletion.                                                            |

There is no separate open/closed status column for a working-memory topic: a topic is "covered"
once it appears in `coveredTopics`, and a thread is "open" while it appears in `unresolvedThreads`.
Resolution is simply removing the thread on the next rewrite — this avoids stale "closed" entries
leaking into prompts. `candidateFacts` are the compacted source material for episodic/fact
extraction, not yet validated `user_memory_facts`.

## Short-term selection

Short-term memory is assembled, not persisted as its own entity: load a bounded recent-message
slice, form complete exchanges, and prefer exchanges created after the working-memory's last
refresh timestamp (capped at three). If there are none after the refresh, or no working memory
exists yet, fall back to the last three complete exchanges — this stops a just-refreshed summary
from leaving the Avatar without any immediate dialogue context; it is a continuity fallback, not a
transcript replay. Compaction itself may read a larger recent batch than three, purely to rewrite
working memory without losing continuity — that batch size is independent of the 3-exchange cap
exposed to the Avatar/GM. The 3-exchange limit is a single shared policy constant — admin/runtime
snapshots and the shared summary projection all read it from the same place, so `exchangeCount` in
an assembled snapshot always matches what that snapshot actually contains.

## Lifecycle

- Normal turns use recent exchanges plus the current working-memory projection. Working memory
  refreshes on a periodic post-turn trigger (every third complete exchange), and also on
  conversation close, Avatar switch, or an explicit admin trigger (`post_turn`,
  `conversation_closed`, `avatar_switch`, `admin_trigger`). Refresh is async and serialized per
  conversation; a failure must not block the Avatar reply or destroy the previous working-memory
  row, and every trigger has an observable started/succeeded/failed outcome.
- Conversation close is the episodic boundary: a final working-memory refresh runs, exactly one
  episodic memory is produced from the latest working memory (not full transcript replay),
  structured user facts may be persisted, and the active working state can then be discarded.
  Avatar switch and reset use the same close semantics for the conversation being left.
- Starting a new conversation selects prior episodic memories, synthesizes relevant ones into
  bounded context, and establishes a fresh working-memory record — the Avatar starts with compact
  recall, not old transcript replay.
- A failed or interrupted Avatar turn does not create an episode or run post-turn memory work.

## Trust and extraction

- Avatar statements are conversational claims, not automatically canonical facts. A challenged or
  contradicted Avatar claim only becomes a candidate fact if backed by an explicit user statement,
  labeled verified context, an application-confirmed fact, or a safe unchallenged stable fact —
  otherwise it stays an `unresolvedThread` (uncertainty is preserved, not resolved by recency).
  Model-generated error explanations (e.g. "my memories are confused") are never treated as
  character facts unless the scenario explicitly establishes them.
- When canonical or retrieved material is supplied to the compactor, it is labeled
  `## VERIFIED CONTEXT` with provenance — the compactor is not expected to infer authority from raw
  conversation alone.
- "Factual" means explicitly stated or directly supported by the discussion; a plausible-sounding
  LLM inference is not a fact. Greetings, fleeting details, and unstable reactions are poor fact
  candidates. Facts may be updated when a later explicit statement supersedes the previous value.
- Static retrieved documents are prompt context only — they are never fed into fact extraction as
  user evidence, and are not treated as memory merely because they were rendered into a prompt.
  Fact extraction receives messages, canonical compacted memory, and only explicitly verified
  application context.

## Prompt projections

Memory is re-injected at the context-assembly boundary only — never by route handlers, never by
concatenating an unbounded transcript into a prompt.

- **Avatar** receives memory under `## Conversation State`, in order: up to three recent complete
  exchanges; current working summary and active-avatar memory when present; selected episodic
  memories; bounded long-term user facts. Retrieved knowledge is a separate `## Retrieved Context`
  section, subject to Context Engine precedence/token trimming, and is never silently merged into
  facts or working memory.
- **GM** receives a separate projection of the same selected memory: `Recent Exchanges`,
  `Working Memory` (summary, unresolved threads, covered topics), selected `Episodic Memories`
  (with bounded selection reasons), and bounded `Long-Term Facts`. GM static knowledge is its own
  `Retrieved Context` projection using the explicit unrestricted retrieval result, while Avatar
  uses its visibility-filtered result — neither is a conversational-memory input.
- Operator/admin inspection preserves the same boundary: memory-layer views label Conversation
  Working Memory, Episodic Memory, and Long-Term User Facts separately with their user/session/
  conversation scope; static views use Shared Avatar/World/Media Knowledge labels instead. A
  static source is never shown in a generic memory category, and chronological messages are never
  duplicated into a synthetic working-memory message.

## Invariants

- Working memory is the sole writer of its own summary, covered topics, unresolved threads, and
  candidate facts.
- Memory does not own active Avatar routing, exchange counts, static source lifecycle, or model
  selection.
- Memory retrieval stays bounded even as the number of prior conversations grows.
- Clear/reset actions are explicit and observable; all memory selection is deterministic and
  traceable within the configured bounds.
- The embedding lifecycle applies to shared knowledge only — session memory, episodic memory, and
  user facts are non-vectorized conversation state and are never touched by a knowledge reindex.

## Refresh contract

A refresh conceptually takes session/conversation identity, the active avatar, the previous
working memory, recent exchanges, and (when relevant) selected episodic memories, and produces an
updated working memory, a candidate episodic memory, extracted facts, and optional diagnostic
change metadata. All persisted outputs are normalized and validated before storage — the exact
input/output DTOs are code-owned (see Ownership below).

## Observability

Expose selected memory layers, memory selection reasons, refresh trigger type, kept-vs-trimmed
behavior where applicable, and safe admin/runtime snapshots of working memory. Never expose
secrets, raw prompt dumps, or unbounded transcript payloads.

## Ownership

- Domain/internal memory contracts: `apps/core/src/domain/memory/memory.types.ts`
- Shared HTTP/admin DTOs: `packages/shared/src/memory-contract-types.ts`
- Entity/lifecycle response projections: `packages/shared/src/lifecycle-types.ts` and
  `packages/shared/src/runtime-inspector-types.ts`
- Derived projections such as a `workingSummary` are summary-only views of canonical working
  memory — session state keeps no separate summary mirror. New working-memory fields are added to
  the canonical owner first, then projected outward deliberately.

## Non-goals

Perfect transcript fidelity, infinite recall, emotional simulation as memory state, a vector-only
memory architecture, and letting memory replace Game Master orchestration logic are all explicitly
out of scope. The cross-user isolation and lifecycle proof lives in
[EPIC_4_2D_REQUIREMENTS_MATRIX.md](EPIC_4_2D_REQUIREMENTS_MATRIX.md).

# Memory system

Memory is bounded conversational state, not a transcript archive. Its job is to preserve information
that improves continuity while keeping ownership, privacy, and prompt size explicit.

## Vocabulary

- **Exchange:** one complete user message followed by one Avatar message.
- **Conversation working memory:** compact state for one conversation episode.
- **Episodic memory:** durable summaries of completed conversation episodes.
- **User fact:** long-lived user-specific information, separate from scenario knowledge.
- **Static knowledge:** scenario-owned Avatar/world/media content; it is not memory.

## Layers and owners

| Layer            | Scope                            | Owner                              | Rule                                                                                 |
| ---------------- | -------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------ |
| Recent exchanges | conversation                     | context assembly                   | At most the three most recent complete exchanges; never incomplete pairs.            |
| Working memory   | conversation                     | memory compaction                  | Summary, current direction, unresolved threads, covered topics, and candidate facts. |
| Episodic memory  | conversation/user-facing history | memory maintenance                 | Compact completed episodes; hydrate only bounded relevant records.                   |
| User facts       | user                             | fact extraction/deletion use cases | Keep supported, useful facts; allow explicit deletion.                               |

## Lifecycle

- Normal turns use recent exchanges plus the current working-memory projection.
- Conversation close, explicit end, Avatar switch, and reset are lifecycle boundaries for compaction/hydration as applicable.
- Maintenance is asynchronous and never delays the Avatar response.
- A failed or interrupted Avatar turn does not create an episode or run post-turn memory work.
- A new conversation hydrates bounded relevant memory; it does not replay the full transcript.

## Trust and extraction

- User-authored facts and verified scenario context may become candidates.
- Avatar claims are untrusted unless supported by the user or labeled verified context.
- Contradicted claims are filtered before persistence.
- Static retrieved documents are prompt context only and must not be fed into fact extraction as user evidence.

## Prompt projections

Avatar receives bounded recent exchanges, working memory, relevant episodic memory, user facts, and
scenario/retrieval context in a stable section order. GM receives the bounded memory projection needed
for progression. Admin/debug views expose the same layers with scope labels but never raw provider data.

## Invariants

- Working memory is the sole writer of its summary, covered topics, unresolved threads, and candidate facts.
- Memory does not own active Avatar routing, exchange counts, static source lifecycle, or model selection.
- Clear/reset actions are explicit and observable.
- All memory selection is deterministic and traceable within the configured bounds.

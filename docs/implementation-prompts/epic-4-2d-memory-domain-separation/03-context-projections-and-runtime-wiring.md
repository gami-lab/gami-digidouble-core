# Separate Conversation State From Retrieved Context

## Context

The Context Engine already models conversation state and retrieved context as different sections,
but typed static `memory` keys and compatibility projections keep their provenance ambiguous. This
slice makes the distinction explicit in internal snapshots, shared DTOs, Avatar prompt assembly, and
GM input while preserving bounded selection and GM's explicit unrestricted visibility policy.

## Scope

Implement now:

- define canonical Avatar and GM projections with separate `conversationState` and
  `retrievedContext` fields;
- expose recent exchanges/messages, working memory, episodic memories, and long-term user facts only
  under Conversation State;
- expose `avatar_knowledge`, `world`, and `media` results only under Retrieved Context;
- wire Avatar retrieval through Avatar visibility and GM retrieval through explicit bypass, retaining
  separate provenance and trace counts;
- ensure prompt renderers use explicit section headings and never flatten one subsystem into the other;
- prevent retrieved documents from entering working-memory/fact extraction inputs solely due to injection.

Out of scope:

- changing token budget sizes or memory-selection algorithms;
- changing retrieval ranking/embedding behavior;
- redesigning GM decisions or blocking the Avatar on GM work;
- adding a new context endpoint.

## Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/RAG_SYSTEM_IMPLEMENTATION.md`
- `docs/CONTEXT_CONTRACT_OWNERSHIP_MAP.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/PROJECT_STATUS.md`
- `apps/core/src/domain/context/context-engine.types.ts`
- `apps/core/src/domain/context/context-engine.service.ts`
- `apps/core/src/domain/context/context-engine.policy.ts`
- `apps/core/src/domain/context/session-context.types.ts`
- `apps/core/src/domain/avatar/persona-prompt.service.ts`
- `apps/core/src/domain/game-master/gm-input-renderer.ts`
- `apps/core/src/application/use-cases/send-message/`
- `apps/core/src/application/use-cases/run-game-master/`
- `packages/shared/src/knowledge-contract-types.ts`
- `packages/shared/src/runtime-inspector-types.ts`

## Implementation Guidance

- Use these conceptual shapes without inventing a parallel aggregate:
  - Conversation State: bounded recent exchanges/messages, conversation working memory, selected
    episodic memories, and long-term user facts;
  - Retrieved Context: static shared `avatar_knowledge`, `world`, and `media` items.
- Verify the existing `LayeredMemorySnapshot` carries episodic memory into both projections. If a
  current context snapshot drops it, extend the canonical internal/shared contracts and explicit API
  mapper rather than hiding it in `workingSummary`.
- Rename policy segment IDs, trace counters, typed section keys, and compatibility readers that still
  say retrieved memory. Keep memory-selection traces separate from retrieval traces.
- Avatar candidates must use the Avatar-filtered retrieval result. GM candidates must use the
  separately retrieved/bypassed result; do not fall back silently to filtered Avatar results when GM
  unrestricted retrieval is expected.
- Preserve provenance (`sourceId`, `chunkId`, canonical type, score/reason/query as allowed) for
  static results. Memory projections should use their own IDs/scope/reason fields and never fake
  knowledge provenance.
- Render stable headings such as `## Conversation State` and `## Retrieved Context`. Test structure,
  ordering, bounds, and absence of cross-contamination—not prose quality.
- Ensure the post-turn maintenance input is assembled from messages and canonical memory state, not
  from the final rendered prompt or retrieved sections.

## Constraints

- Respect canonical internal/shared ownership and explicit API mapping.
- KISS, YAGNI, DRY.
- Keep Context Engine selection deterministic and bounded.
- Keep GM asynchronous and non-blocking.
- Do not preserve ambiguous `retrievedContext.memory` compatibility outputs.

## Deliverables

- canonical separated Avatar/GM context contracts;
- updated Context Engine candidates, policy identifiers, traces, and mappers;
- Avatar and GM prompt renderers with distinct bounded sections;
- explicit Avatar visibility and GM bypass wiring;
- deterministic tests for projection, trimming, provenance, and non-contamination.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched contracts: Context Engine input/output/trace, Avatar/GM snapshots, layered memory,
   typed retrieval, recorded context, shared DTOs, prompt options, and event projections.
2. Search for duplicated section shapes, inline response records, local client mirrors, inconsistent
   optionality/nullability, compatibility summaries, and old `memory` retrieval keys.
3. Identify canonical owners in Domain and `packages/shared`.
4. Reuse existing section and memory types through composition where possible.
5. If episodic projection lacks an owner, create one before adding it to multiple contexts.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required;
- `docs/CONTEXT_CONTRACT_OWNERSHIP_MAP.md` with final section ownership and keys;
- `docs/ARCHITECTURE.md` with separate assembly flows;
- `docs/API_CONTRACT.md` if admin context DTOs change;
- `docs/GAME_MASTER_CONTRACT.md` with GM memory/retrieval provenance and bypass;
- `docs/MEMORY_SYSTEM_SPEC.md` and `docs/RAG_SYSTEM_IMPLEMENTATION.md` with prompt section boundaries.

If a listed document needs no text change, record that it remains accurate. Code, tests, and docs
move together.

## Acceptance Criteria

- [ ] Avatar and GM contexts expose distinct Conversation State and Retrieved Context structures.
- [ ] All four conversational-memory layers appear only in Conversation State and remain bounded.
- [ ] All three static types appear only in Retrieved Context with static provenance.
- [ ] Avatar visibility and GM bypass use separate retrieval results and are observable.
- [ ] Prompt tests prove headings, ordering, limits, and absence of synthetic memory/chunks.
- [ ] Retrieved items cannot become candidate facts merely because they were injected.
- [ ] Existing async runtime behavior remains intact.
- [ ] Documentation is updated before the slice is complete.

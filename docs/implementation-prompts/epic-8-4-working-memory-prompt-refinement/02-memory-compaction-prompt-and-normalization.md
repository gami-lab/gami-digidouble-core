# Refine Working Memory Compaction Prompt And Output Normalization

## Context

Once `coveredTopics` exists canonically, the compaction path must actually produce better working memory. This EPIC is primarily about improving the prompt instructions and normalization behavior, not about changing the memory lifecycle.

## Scope

Implement now:

- refine the working-memory compaction system prompt so it explicitly targets better summaries, normalized covered topics, factual candidate facts, and accurate unresolved-thread carry-forward;
- update compaction input rendering if needed so prior memory and recent exchanges are presented clearly and deterministically;
- extend compaction output parsing/normalization to accept and bound `coveredTopics`;
- harden parsing so empty, duplicated, or malformed items are dropped safely without widening the contract.

Out of scope:

- changing when refresh runs;
- changing long-term or episodic-memory logic beyond whatever types now require;
- redesigning the GM prompt;
- adding a new provider, model, or separate memory-maintenance workflow.

## Relevant Docs

- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`
- `apps/core/src/application/services/memory-maintenance.service.ts`
- `apps/core/src/application/services/conversation-exchange-window.ts`
- `apps/core/src/application/services/episodic-memory.service.ts`

## Implementation Guidance

- Keep the prompt lightweight and explicit. It should instruct the model to return JSON only and to produce:
  - `summary`
  - `coveredTopics`
  - `unresolvedThreads`
  - `candidateFacts`
- Summary guidance should make these rules unambiguous:
  - merge prior memory with newly integrated exchanges
  - remove repetition
  - keep the most current version when details are superseded
  - remain concise and bounded
- `coveredTopics` guidance should make these rules explicit:
  - list explored discussion subjects, not unresolved next steps
  - keep items short, normalized, and non-duplicative
  - prefer factual topic labels over interpretation
  - keep the list bounded
- `candidateFacts` guidance should tighten rather than widen behavior:
  - allow only objective persistent facts grounded in the discussion
  - explicitly reject inferred trust, mood, pacing, or progression state
  - continue deduping and superseding old values when warranted
- `unresolvedThreads` guidance should explicitly remove resolved items and keep only active loose ends.
- In normalization:
  - trim whitespace
  - dedupe exact duplicates
  - clamp list sizes
  - reject malformed fact objects and blank topic/thread strings
- Do not move business interpretation into the memory system. The output should stay descriptive, not directive.

## Constraints

Respect:

- bounded memory;
- no transcript replay dependency;
- no provider-specific prompt branching;
- no emotional or progression inference in memory output;
- keep the implementation smaller than a full prompt-framework abstraction.

## Deliverables

- refined working-memory compaction prompt text;
- updated compaction input rendering only if it materially improves determinism or clarity;
- parser/normalizer support for `coveredTopics` and stricter item hygiene;
- deterministic tests for accepted, truncated, deduped, and rejected output cases.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

## Acceptance Criteria

- [ ] The compaction prompt explicitly describes higher-quality summary behavior.
- [ ] The compaction output contract now includes bounded `coveredTopics`.
- [ ] `candidateFacts` remains objective and excludes inferred conversational state.
- [ ] Resolved threads can disappear across refresh cycles while unresolved ones carry forward cleanly.
- [ ] Normalization rejects malformed/blank data and keeps output bounded.

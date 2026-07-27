# EPIC 8.5 — Game Master Post-Analysis Refinement

## Objective

Refine the asynchronous Game Master so its post-analysis output provides useful preparation for the next Avatar turn without adding latency or introducing a second GM call. The EPIC adds first-class RAG planning, explicit dialogue-control modes, dynamic Avatar routing, and clearer ownership boundaries between GM orchestration and conversation working memory.

## Generated

2026-07-25

## Execution Order

| Step | File                                               | Description                                                                                          |
| ---- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1    | `00-gm-contract-and-prompt-refactor.md`            | Replace the GM output contract, add dialogue control and RAG planning, and simplify dynamic routing. |
| 2    | `01-runtime-retrieval-and-dialogue-integration.md` | Store and consume GM guidance during the next Avatar turn without blocking the current response.     |
| 3    | `02-memory-ownership-cleanup.md`                   | Make memory compaction the sole owner of summaries, covered topics, unresolved threads, and facts.   |
| 4    | `03-regression-tests-and-prompt-hardening.md`      | Add contract, routing, retrieval, memory-boundary, failure, and prompt-size regression coverage.     |

Each prompt depends on the previous one being complete.

## Dependencies

- The existing asynchronous GM post-analysis lifecycle must remain operational.
- The Avatar runtime must already support stored GM guidance and RAG context injection.
- The conversation working-memory lifecycle and asynchronous compaction path must remain intact.
- Existing Avatar switching, suggestion, unlocking, and progression mechanisms must be preserved.
- EPIC 8.4 working-memory refinements should remain the source of truth for persistent conversation memory.

## Suggested Execution Order

Run the prompts in numeric order.

Prompt `00` defines the canonical GM output before any runtime consumer is changed.

Prompt `01` integrates the new retrieval plan and dialogue-control fields into the next-turn Avatar pipeline.

Prompt `02` removes overlapping GM memory responsibilities only after the new orchestration contract is stable.

Prompt `03` is last because it validates the final contract, runtime behaviour, dynamic routing capabilities, failure handling, and compatibility with existing multi-Avatar scenarios.

## Definition of Done

- [ ] The GM remains a single asynchronous post-analysis call.
- [ ] The current Avatar response is never delayed by GM execution.
- [ ] GM output includes explicit dialogue-control guidance.
- [ ] RAG planning is a first-class GM output and is consumed during the next relevant Avatar turn.
- [ ] Stored retrieval intent is combined with the latest user message rather than executed blindly.
- [ ] Mandatory retrieval failures result in explicit uncertainty instead of fabricated facts.
- [ ] Avatar switching, suggestion, unlocking, and progression remain supported.
- [ ] Routing and unlocking instructions are omitted when unavailable or irrelevant.
- [ ] Application-owned fields such as interaction increments are removed from the GM output.
- [ ] Memory compaction is the sole owner of `summary`, `coveredTopics`, `unresolvedThreads`, and `candidateFacts`.
- [ ] Contradicted Avatar claims are not automatically persisted as facts.
- [ ] Director Notes are required, non-empty, and contain only useful next-turn narrative guidance.
- [ ] Focused deterministic tests cover contracts, retrieval planning, dialogue modes, routing, memory ownership, failures, and prompt-size reduction.
- [ ] Existing asynchronous behaviour and multi-Avatar regression scenarios continue to pass.
- [ ] `docs/PROJECT_STATUS.md` and all impacted source-of-truth documentation are updated before the EPIC is considered complete.

# EPIC 8.4 — Working Memory Prompt Refinement

## Objective

Refine conversation working memory so it stays lightweight and bounded while becoming more useful for downstream orchestration. The EPIC should improve summary quality, add canonical `coveredTopics`, keep `candidateFacts` strictly objective, and preserve accurate unresolved-thread carry-forward without changing the broader memory architecture.

## Generated

2026-07-19

## Execution Order

| Step | File                                               | Description                                                                                          |
| ---- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1    | `00-contract-cleanup.md`                           | Audit working-memory contract ownership and remove duplication risks before adding `coveredTopics`.  |
| 2    | `01-covered-topics-contract-and-persistence.md`    | Extend canonical working-memory contracts, persistence, and shared DTOs for `coveredTopics`.         |
| 3    | `02-memory-compaction-prompt-and-normalization.md` | Refine compaction instructions, prompt input rendering, and parser/normalization rules.              |
| 4    | `03-gm-context-and-debug-surface-alignment.md`     | Propagate refined working memory into GM input, runtime inspection, event payloads, and debug views. |
| 5    | `04-tests-hardening-and-doc-sync.md`               | Close regression gaps, run quality gates, and synchronize source-of-truth documentation.             |

Each prompt depends on the previous one being complete.

## Dependencies

- EPIC 4.2b / 4.2c must already provide the conversation working-memory lifecycle, repository, and async refresh path.
- EPIC 5.2 context-engine work should remain intact; EPIC 8.4 refines memory payload quality, not overall context-assembly ownership.
- EPIC 8.3 GM prompt refinement may already have improved GM prompt structure; EPIC 8.4 should reuse that structure and inject richer memory data without redesigning GM state.

## Suggested Execution Order

Run the prompts in numeric order.

Prompt `00` is mandatory because working memory crosses domain contracts, repository rows, shared DTOs, GM input assembly, admin inspectors, console diagnostics, and local test fixtures. Adding `coveredTopics` without first confirming canonical ownership would create exactly the contract drift this repo is trying to avoid.

Prompt `01` lands before prompt `02` so the new field exists canonically across types and persistence before LLM output starts producing it.

Prompt `02` should land before prompt `03` because downstream consumers should only be updated after the compaction output contract and normalization rules are final.

Prompt `04` is last because it assumes the final runtime shape exists and documentation can be updated honestly.

## Definition of Done

- [ ] Working memory remains bounded and conversation-scoped.
- [ ] `summary` instructions explicitly favor concise merged continuity, de-duplication, and superseding outdated details.
- [ ] `coveredTopics` is generated as a compact normalized list of explored discussion subjects.
- [ ] `unresolvedThreads` carries forward unresolved items, drops resolved items, and avoids duplicates.
- [ ] `candidateFacts` remains limited to objective, persistent information and excludes inferred emotional or orchestration state.
- [ ] Canonical ownership for working-memory contracts remains explicit across domain types, shared DTOs, and test fixtures.
- [ ] GM input can consume `coveredTopics` without requiring GM to reinterpret the whole summary for topic coverage.
- [ ] Existing memory architecture, async refresh lifecycle, and non-blocking turn behavior remain unchanged.
- [ ] Focused deterministic tests cover prompt structure, parsing/normalization, GM memory input, and inspector/debug visibility.
- [ ] No new HTTP endpoint is introduced; therefore no new `*.stack-e2e.test.ts` file is required unless scope changes.
- [ ] `docs/PROJECT_STATUS.md` and all impacted source-of-truth docs are accurate before the EPIC is considered complete.

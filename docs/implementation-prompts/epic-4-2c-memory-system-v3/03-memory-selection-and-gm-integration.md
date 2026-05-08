# 03 — Memory Selection Policy And GM Integration

## Context

Memory v3 is incomplete unless Avatar and Game Master consume the same bounded memory selection outputs. This slice introduces deterministic selection policy and injects selected memory into both runtime paths.

## Scope

Implement now:

- memory selection policy (relevance, recency, continuity, unresolved topics)
- shared assembly service that returns selected memory payload for Avatar and GM
- GM input contract update to include episodic/working memory selections
- integration into send-message and run-game-master use cases

Out of scope:

- scenario/world/media RAG merging (EPIC 5.x)
- new orchestration strategy beyond memory-aware context consumption

## Relevant Docs

- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Build one canonical selection service in application/domain layer; avoid separate Avatar-vs-GM memory fetch logic.
- Selection output should be bounded and explainable (include selection reasons/metadata for observability layer).
- Ensure GM receives memory context without blocking Avatar response flow.
- Maintain compatibility with existing `RuntimeContext` and GM event pipeline; adjust contracts intentionally and update docs.

## Constraints

- Deterministic policy first; no hidden prompt magic as sole logic.
- Keep GM async and non-blocking.
- Avoid adding duplicate context assembly logic in use cases.

## Deliverables

- shared memory selection module
- Avatar + GM integration changes
- tests proving memory-aware continuity and GM usage behavior
- contract/documentation sync for any shape updates

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/API_CONTRACT.md` (if exposed contracts changed)
- `docs/ARCHITECTURE.md` (if assembly responsibilities shift)

If no doc changes are needed, explicitly verify docs are still accurate.

## Acceptance Criteria

- [ ] Avatar and GM consume one shared selected-memory output.
- [ ] GM memory input contract is explicit and tested.
- [ ] Selection policy is deterministic and bounded.
- [ ] No duplicated memory assembly logic remains in use cases.
- [ ] Build gates pass and docs are synced.

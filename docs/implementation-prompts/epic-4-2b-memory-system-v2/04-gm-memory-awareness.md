# Game Master Memory Awareness Upgrade

## Context

`docs/GAME_MASTER_CONTRACT.md` already describes `context.memory`, but the actual core
`GameMasterInput` type and `RunGameMasterUseCase` still do not provide it.

EPIC 4.2b must close that gap and make the Game Master consume the same pyramidal memory model as
the Avatar, while staying lightweight and non-blocking.

## Scope

**In scope:**

- update `GameMasterInput` to include bounded memory layers
- build GM memory input from the canonical memory assembler / types introduced earlier
- thread working and long-term memory into GM calls without full transcript replay
- add deterministic tests proving the GM sees the right memory shape

**Out of scope:**

- context-aware RAG injection (EPIC 4.1b / 5.1 / 5.2)
- GM strategy redesign
- new player-facing endpoints

## Relevant Docs

- `docs/GAME_MASTER_CONTRACT.md` §3–5
- `docs/PRINCIPLES.md` §2, §7, §8
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md` — GM and Context module expectations
- current references:
  - `apps/core/src/domain/game-master/game-master.types.ts`
  - `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts`

## Mandatory Pre-Implementation Check

1. Identify touched entities/contracts:
   - `GameMasterInput`
   - memory-layer domain types
   - any GM event payloads or tests that encode the old shape
2. Search for duplicated GM input memory shapes in tests/helpers/docs.
3. Confirm the canonical owner for GM memory input types.
4. Reuse the same layered-memory assembly logic used by Avatar turns where practical.
5. If `GameMasterInput` field additions would force 4+ manual shape edits, refactor first.

## Implementation Guidance

1. Upgrade the GM input contract so the code matches the documented direction. Include:
   - short-term recent exchanges
   - working-memory summary
   - long-term facts

   Keep the structure bounded. Do not inject full history, raw transcripts, or unrelated scenario
   data into the memory block.

2. Reuse canonical memory types from Prompt 00. Do not define another local `memory` object shape
   inside `run-game-master.use-case.ts` or tests.

3. Add a dedicated builder/helper if needed, but avoid duplicating Avatar-memory assembly logic.
   A small shared memory loader for both Avatar and GM is preferred over two independent read paths.

4. Keep GM memory lightweight:
   - short-term should remain only the last 2 exchanges, not the full recent message list
   - working memory should be a compact summary
   - long-term facts should be bounded and structured

5. Preserve the async GM architecture. Memory loading may happen before the background GM call, but
   it must not turn the user-facing Avatar reply path into a blocking GM path.

6. Add tests that assert from the consumer inward:
   - `GameMasterInput.context.memory` exists when memory exists
   - short-term contains exactly the bounded recent exchanges
   - long-term facts are structured and bounded
   - empty / missing layers are omitted or empty in a consistent, documented way
   - GM input no longer depends on full raw recent message replay alone

## Constraints

- keep GM lightweight; memory is context, not a new orchestration engine
- no full transcript replay in GM memory input
- no RAG or knowledge injection in this prompt
- no route or API changes here
- do not regress existing GM diagnostics or async behavior

## Deliverables

- updated `GameMasterInput` memory contract in code
- `RunGameMasterUseCase` upgraded to pass bounded memory layers
- shared / reused memory loading logic where practical
- unit tests proving bounded GM memory input behavior

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/API_CONTRACT.md` only if any exposed contract changed

If no doc changes are needed, explicitly verify that docs already match the implemented GM memory
input.

## Acceptance Criteria

- [ ] code-level `GameMasterInput` includes memory layers consistent with docs
- [ ] GM receives bounded short-term, working, and long-term memory
- [ ] GM memory input reuses canonical memory contracts instead of duplicating them
- [ ] tests prove the GM sees the right memory shape and bounded window
- [ ] existing async GM behavior remains unchanged for the user-facing response path

# Turn-Time Memory Context Assembly For Avatar

## Context

Today the Avatar turn path injects only:

- `session.gmNotes`
- optional user persona
- a flat `Record<string, string>` of long-term user facts

EPIC 4.2b requires the Avatar to consume explicit memory layers without replaying the entire
transcript.

This should be implemented as a deterministic assembly step, not as more ad hoc logic inside
`SendMessageUseCase`.

## Scope

**In scope:**

- deterministic assembly of short-term, working, and long-term memory for Avatar turns
- exact short-term window policy (`last 2 exchanges only`)
- use-case integration for Avatar prompt assembly
- prompt rendering updates needed to surface layered memory clearly but compactly

**Out of scope:**

- GM memory consumption
- new admin routes
- Context Engine v2 / token-budget orchestration beyond this memory slice

## Relevant Docs

- `docs/PRINCIPLES.md` §3 — context is the product
- `docs/API_CONTRACT.md` — runtime context semantics
- `docs/DATA_MODEL.md` §4, §8, §9, §10
- `docs/TEST_COVERAGE_PLAN.md` — memory and context module expectations
- current references:
  - `apps/core/src/application/use-cases/send-message/send-message.use-case.ts`
  - `apps/core/src/domain/context/context.types.ts`
  - `apps/core/src/domain/avatar/persona-prompt.service.ts`

## Mandatory Pre-Implementation Check

1. Identify touched entities/contracts:
   - `RuntimeContext`
   - Avatar prompt assembly inputs
   - working-memory repositories
   - long-term fact repository
2. Search for duplicated context-shape definitions.
3. Confirm the canonical owner for the layered memory snapshot used by Avatar turns.
4. Reuse shared assembly logic rather than reading memory ad hoc in `SendMessageUseCase`.
5. If no canonical assembler exists, create one in the context domain/application slice.

## Implementation Guidance

1. Introduce a dedicated memory-context assembler for Avatar turns. Keep it narrow in scope:
   memory only, not the whole future Context Engine.

   Example direction:
   - `buildAvatarMemoryContext(...)`
   - `MemoryContextAssembler`

2. Assemble three layers deterministically:
   - **short-term:** exactly the last 2 exchanges (user + avatar pairs) from message history
   - **working memory:** session working memory summary plus current-avatar working memory when present
   - **long-term:** bounded user facts from `IUserMemoryFactRepository`

3. Replace the flat `memorySummary` + `userFacts` usage with a layered internal model. Keep the
   prompt output compact and inspectable. The Avatar prompt should clearly separate layers, for
   example:
   - recent exchanges
   - session working memory
   - current avatar memory
   - remembered user facts

4. Do not dump raw JSON into prompts if a compact textual rendering is clearer. The important
   property is deterministic structure, not JSON formatting.

5. Keep fact injection bounded. Reuse the existing long-term fact store; do not create a second
   fact cache. If ordering matters, prefer `updatedAt DESC` and cap to a small number.

6. Ensure `SendMessageUseCase` delegates memory assembly to the new abstraction instead of directly
   loading facts and shaping prompt memory itself.

7. Add focused tests:
   - exact 2-exchange short-term window
   - working memory omitted cleanly when absent
   - avatar working memory scoped to the active avatar only
   - long-term facts included in bounded deterministic order
   - memory-read failure is non-blocking for the turn
   - prompt rendering includes the correct sections and omits empty ones

## Constraints

- no full transcript replay for memory
- no premature full Context Engine v2 build-out
- keep prompt sections compact and stable
- memory-read failures must degrade gracefully, not fail the turn
- avoid duplicating the same memory assembly logic in tests and production code

## Deliverables

- dedicated Avatar memory-context assembly abstraction
- updated `SendMessageUseCase` integration
- updated prompt assembly for layered memory sections
- unit tests for short-term windowing, working-memory injection, and graceful degradation

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/API_CONTRACT.md` if any exposed context-facing contract changed
- `docs/DATA_MODEL.md`
- `docs/TEST_COVERAGE_PLAN.md`

If no doc changes are needed, explicitly verify that docs still describe the implemented turn-time
memory behavior accurately.

## Acceptance Criteria

- [ ] Avatar turn context uses explicit short-term, working, and long-term memory layers
- [ ] short-term window is exactly the last 2 exchanges
- [ ] avatar-scoped working memory is separated from session working memory
- [ ] memory assembly is no longer ad hoc inside `SendMessageUseCase`
- [ ] memory read failures do not fail the turn
- [ ] focused tests prove windowing, scoping, and omission behavior

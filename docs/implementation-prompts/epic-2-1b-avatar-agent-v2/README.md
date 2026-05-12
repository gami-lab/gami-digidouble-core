# EPIC 2.1b - Avatar Agent v2 (Memory + Persona + RAG Awareness)

## Objective

Upgrade avatar behavior from stateless turn-by-turn replies to context-aware conversation by integrating user persona, bounded short-term memory, long-term memory hooks, and typed RAG context into one deterministic prompt assembly path.

## Generated

2026-05-12

## Dependencies Between Prompts

- `00-contract-cleanup.md` is mandatory before feature work.
- `01-avatar-context-contracts.md` defines canonical contract ownership used by all later slices.
- `02-avatar-prompt-assembly-v2.md` depends on `01`.
- `03-memory-and-rag-integration.md` depends on `02`.
- `04-runtime-inspector-and-console-alignment.md` depends on `03`.
- `05-tests-hardening-doc-sync.md` runs last.

## Ordered Execution List

| #   | File                                            | Purpose                                                                   |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| 0   | `00-contract-cleanup.md`                        | Remove duplicated avatar/session/context contracts before adding behavior |
| 1   | `01-avatar-context-contracts.md`                | Define canonical Avatar v2 context contracts and ownership boundaries     |
| 2   | `02-avatar-prompt-assembly-v2.md`               | Implement persona + memory + retrieval aware prompt assembly for Avatar   |
| 3   | `03-memory-and-rag-integration.md`              | Wire bounded memory and typed retrieval into SendMessage Avatar flow      |
| 4   | `04-runtime-inspector-and-console-alignment.md` | Align admin/console inspection surfaces with new Avatar v2 context trace  |
| 5   | `05-tests-hardening-doc-sync.md`                | Close with coverage, regression protection, and full documentation sync   |

## Suggested Execution Order

`00 -> 01 -> 02 -> 03 -> 04 -> 05`

## Definition of Done (Full EPIC)

- [ ] Avatar response generation consumes one canonical context assembly path with persona + memory + typed retrieval.
- [ ] Contract ownership is explicit and duplication across core/shared/console is reduced, not increased.
- [ ] Bounded short-term memory and long-term memory hooks influence responses in deterministic and testable ways.
- [ ] Typed retrieval (`memory`, `world`, `media`) is available to Avatar prompt assembly with explainable selection metadata.
- [ ] Runtime inspector and console views reflect the new context composition without leaking sensitive prompt/provider data.
- [ ] If new endpoints are introduced, matching `*.stack-e2e.test.ts` files exist with auth/validation/not-found coverage.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:coverage` pass.
- [ ] `docs/PROJECT_STATUS.md` and impacted docs are synchronized with implemented behavior.

# EPIC 10.1 — Clean-Slate Contract And Legacy Compatibility Removal

## Objective

Remove every backward-compatibility path identified by the legacy audit and leave the product with
one strict current contract for runtime code, shared DTOs, persistence, content, operator tooling,
tests, and deployment. The implementation assumes a fresh database volume and fresh content; old
volumes, old API inputs, old persisted payloads, and old content shapes are not supported.

## Generated

2026-09-13

## Ordered Execution List

| #   | File                                         | Purpose                                                                                                           |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 0   | `00-contract-cleanup.md`                     | Inventory high-fanout contracts, remove duplication, and establish canonical current owners before deletion work. |
| 1   | `01-fresh-database-schema.md`                | Replace runtime schema alignment and legacy database preservation with a canonical fresh-database bootstrap.      |
| 2   | `02-knowledge-and-session-memory-removal.md` | Remove the legacy knowledge alias/migration surface and the `sessions.memory_summary` mirror.                     |
| 3   | `03-gm-and-event-compatibility-removal.md`   | Remove pre-current GM state/output compatibility and legacy event-payload readers.                                |
| 4   | `04-content-config-and-provider-cleanup.md`  | Make Avatar, Scenario, visibility, routing, model, embedding, and provider contracts current-only.                |
| 5   | `05-hardening-and-doc-sync.md`               | Run the full clean-slate audit, verification suite, fresh deployment checks, and final documentation sync.        |

## Dependencies

- The audit baseline is [`docs/LEGACY_COMPATIBILITY_AUDIT.md`](../../LEGACY_COMPATIBILITY_AUDIT.md).
- The current product contract is defined jointly by the source-of-truth documents listed in every prompt.
- Prompt `00` is mandatory first because the EPIC touches Avatar, Scenario, Session, Conversation,
  Message, GM state/events, shared DTOs, and admin/console projections.
- Prompt `01` establishes the fresh schema and deployment assumption before persistence-only
  compatibility columns and alignment code are deleted.
- Prompt `02` depends on the canonical contract map from `00` and the schema direction from `01`.
- Prompt `03` depends on the current shared/runtime contracts and the final schema shape.
- Prompt `04` depends on the current runtime contracts and must update fresh seed/admin content rather
  than adding compatibility branches.
- Prompt `05` runs last and is the release gate for the entire EPIC.

## Suggested Execution Order

Run prompts serially: `00 -> 01 -> 02 -> 03 -> 04 -> 05`.

Do not parallelize prompts `00` through `04`: they intentionally narrow high-fanout contracts and
remove code that later prompts must not reintroduce. Prompt `05` is not a place to defer tests or
documentation that belong in an earlier slice.

This EPIC is not expected to add an HTTP endpoint. If implementation introduces one anyway, the
same slice must add its colocated `*.stack-e2e.test.ts` covering missing/wrong API keys (`401`),
invalid or missing required fields (`400`), resource-not-found (`404`) where applicable, and the
success path or an explicit environment-gated TODO.

## Definition Of Done For Full EPIC

- [ ] Runtime schema alignment and legacy database-volume preservation are removed.
- [ ] Fresh database bootstrap contains only canonical current tables, columns, constraints, indexes, and seed data.
- [ ] The `memory` knowledge input alias, migration/audit/quarantine support, and legacy fixtures are removed.
- [ ] `sessions.memory_summary` and all fallback reads, writes, and admin reporting are removed.
- [ ] Pre-current GM state normalization and obsolete GM state fields are removed.
- [ ] Current GM output parsing is strict and requires every field required by `GAME_MASTER_CONTRACT.md`.
- [ ] Legacy flattened event payload readers and compatibility-only retrieval/scope projections are removed.
- [ ] Active Avatars require prepared `computedTraits` and structured prompt inputs.
- [ ] Active Scenarios require canonical language; `routeKey` and legacy voice-language fallbacks are gone.
- [ ] Static knowledge requires explicit visibility policy; ID inference and `__GM_ONLY__` are gone.
- [ ] The runtime `'legacy'` model adapter path and unused direct-query embedding wrapper are gone.
- [ ] The supported production model matrix has no pre-current provider request parameter branch.
- [ ] Compatibility-only tests, scripts, fixtures, UI labels, and documentation are deleted or rewritten.
- [ ] Fresh-volume deployment and fresh-content seeding are documented and verified.
- [ ] Typecheck, lint, unit, integration, E2E, and applicable stack-E2E checks pass.
- [ ] `docs/PROJECT_STATUS.md` and every impacted source-of-truth document accurately describe the new strict contract.

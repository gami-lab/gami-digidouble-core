# EPIC 11.1 — Code Hygiene & Duplication Reduction

## EPIC

**Name:** Code Hygiene & Duplication Reduction  
**Objective:** Remove high-confidence dead code and reduce confirmed duplication without changing
runtime behavior, public API shapes, persistence ownership, or architectural boundaries.  
**Generated:** 2026-09-14  
**Source audit:** [`docs/CODE_AUDIT.md`](../../CODE_AUDIT.md)  
**Roadmap entry:** [`docs/EPICS.md`](../../EPICS.md)

## Ordered execution list

1. [`00-contract-cleanup.md`](00-contract-cleanup.md) — establish canonical ownership and a
   deletion/consolidation decision record before touching duplicated contracts.
2. [`01-remove-orphaned-code.md`](01-remove-orphaned-code.md) — remove confirmed orphaned modules,
   retired ingestion code, and legacy memory/context clusters.
3. [`02-prune-redundant-core-composition.md`](02-prune-redundant-core-composition.md) — simplify
   Core composition, knowledge normalization, and unused symbols.
4. [`03-consolidate-client-and-operator-duplication.md`](03-consolidate-client-and-operator-duplication.md)
   — reduce browser API protocol, error, and operator-form mapping duplication.
5. [`04-consolidate-memory-provider-and-stream-helpers.md`](04-consolidate-memory-provider-and-stream-helpers.md)
   — consolidate safe memory-window and provider/stream helper repetition.
6. [`05-hardening-tests-and-doc-sync.md`](05-hardening-tests-and-doc-sync.md) — run the final
   hardening pass, verify the complete gate, and close the documentation loop.

## Dependencies and suggested order

Prompt `00` is a prerequisite for all other prompts. Prompt `01` can then run independently of
prompts `02`–`04`, although it is best completed first so later searches do not include known dead
clusters. Prompt `02` should precede `03` and `04` if shared contract ownership or Core helper
ownership changes. Prompt `05` is the final integration and verification step.

Suggested order: `00 → 01 → 02 → 03 → 04 → 05`.

## Global constraints

- This EPIC is audit and cleanup work; do not add product features, endpoints, datastores,
  compatibility layers, migrations, or speculative abstractions.
- Preserve the architecture `API → Application → Domain → Infrastructure`.
- Keep public/shared DTO ownership in `packages/shared`; do not move domain or persistence shapes
  there just to make files look similar.
- Treat the audit as evidence, not automatic deletion authority: confirm package scripts, dynamic
  entrypoints, deployment usage, and external consumers before deleting a symbol.
- Do not rewrite unrelated code or fix unrelated findings discovered during implementation.
- Every prompt requires updating `docs/PROJECT_STATUS.md` and any impacted source-of-truth docs,
  even when the correct update is to record that no contract document changed.

## Definition of done for the full EPIC

- D1–D4 are removed or retained with an explicit reason and verified ownership.
- R1–R7 are consolidated where semantics are identical, or explicitly documented as intentionally
  separate where boundaries require it.
- No duplicate public contract, inline response shape, local type copy, optionality/nullability
  drift, or field-name drift is introduced or left unexplained in touched areas.
- No endpoint or public contract changes are made as part of cleanup.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test` pass.
- The final diff is focused, `git diff --check` is clean, and all relevant documentation is current.
- The implementation agent commits the completed changes using a Conventional Commit.

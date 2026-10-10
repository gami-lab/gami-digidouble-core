# EPIC 11.2 — Comment Audit & Hack Removal

## EPIC

**Name:** Comment Audit & Hack Removal  
**Objective:** Review every comment in the codebase, keep only comments that explain non-obvious
"why", and remove every hack those comments expose (legacy fallbacks, stale TODOs, workarounds,
lint/type suppressions). Then add a lint guardrail so this does not come back. Nothing has shipped
to production, so the target is clean code now, not compatibility.  
**Generated:** 2026-10-10  
**Roadmap entry:** [`docs/EPICS.md`](../../EPICS.md)

## Baseline (2026-10-10, rough grep counts)

- Comment lines: `apps/core` ~1,050 (application 312, domain 219, infrastructure 205, api 149,
  tests ~230), `packages/shared` ~170, `apps/web` ~75, `apps/console` ~65, `apps/admin` ~45,
  `tools/conversation-evaluation` ~40.
- `eslint-disable`: 157 (73 outside tests), mostly `complexity` (64) and
  `max-lines-per-function` (62), plus `max-lines` (21), `no-non-null-assertion` (5),
  `require-await` (3), `no-unnecessary-condition` (1), `no-explicit-any` (1).
- `as unknown as`: 59 (6 outside tests). `@ts-ignore` / `@ts-expect-error`: 0.
- Hack markers: `TODO(EPIC-4.2)` in `start-session` and `get-history` use cases,
  `TODO(epic-4-5)` in `stream-runtime-events.stack-e2e.test.ts`, "legacy" fallbacks for sessions
  without unlock state, working-memory rows without covered topics, a legacy session-memory mirror,
  legacy evaluation report fields, and a `'legacy'` provider branch in the evaluation tool.

Re-measure in prompt `01`; these numbers only size the work.

## Ordered execution list

1. [`01-comment-inventory-and-policy.md`](01-comment-inventory-and-policy.md) — write the comment
   policy and build the full inventory of comments, hack markers, and suppressions with a decision
   for each.
2. [`02-remove-legacy-and-todo-hacks.md`](02-remove-legacy-and-todo-hacks.md) — remove legacy and
   compatibility fallbacks, stale TODOs, and workarounds, including their tests.
3. [`03-remove-lint-and-type-suppressions.md`](03-remove-lint-and-type-suppressions.md) — refactor
   away `eslint-disable` directives, non-null assertions, and production type escapes.
4. [`04-core-comment-sweep.md`](04-core-comment-sweep.md) — apply the policy to every remaining
   comment in `apps/core`.
5. [`05-clients-shared-tools-comment-sweep.md`](05-clients-shared-tools-comment-sweep.md) — apply
   the policy to `apps/admin`, `apps/console`, `apps/web`, `packages/shared`, `tools/`, root
   config, and scripts.
6. [`06-guardrail-hardening-and-doc-sync.md`](06-guardrail-hardening-and-doc-sync.md) — add the
   lint guardrail, run the full gate, and close the EPIC in the docs.

## Dependencies and suggested order

`01` is required by everything else: it fixes the policy and the decision for each item. `02` comes
before `03` because removing hacks deletes code that would otherwise need refactoring. `03` comes
before the sweeps so the sweeps don't edit code that is about to be restructured. `04` and `05` are
independent of each other. `06` comes last because the guardrail must pass on the cleaned codebase.

Suggested order: `01 → 02 → 03 → 04 → 05 → 06`.

## Global constraints

- The goal is hardening: when a comment exposes a hack, fix the code. Deleting the comment and
  keeping the hack does not count.
- No backward compatibility: every deploy recreates the database, so legacy-row, legacy-session,
  and legacy-report fallbacks are removed, not preserved.
- Removing a hack may change behavior only where the hack itself was the behavior. Public API
  changes still require `docs/API_CONTRACT.md` updates in the same change.
- Keep the architecture `API → Application → Domain → Infrastructure` and the existing ownership of
  shared DTOs in `packages/shared`.
- Do not add product features, datastores, or new third-party dependencies unless a prompt says
  so explicitly.
- Commit after each prompt with a Conventional Commit referencing `epic 11.2`.

## Comment policy (applied by every prompt)

Keep a comment only if it explains something the code cannot: why a non-obvious choice was made, an
external constraint (provider quirk, protocol rule, security reason), or a public contract (JSDoc on
exported APIs where the name and types are not enough). Delete comments that:

- restate what the next line does
- narrate a change or its history (`// Updated to handle null`, `// Added by AI`, `// now uses X`)
- point to epics, tickets, or prompts instead of explaining the code
- are commented-out code
- are section banners that add nothing the structure doesn't already show

Fix comments that are true but stale. A `TODO` either becomes work done now or is removed; tracked
follow-ups belong in `docs/EPICS.md`, not in code.

## Definition of done for the full EPIC

- Every comment, `TODO`, `eslint-disable`, and production type escape in `apps/`, `packages/`, and
  `tools/` is fixed, removed, or kept with a reason recorded in the inventory.
- No legacy/compatibility fallback, stale `TODO(EPIC-x)` marker, or workaround remains.
- Lint fails on change-narrating/AI-attribution comments and on unused or unexplained
  `eslint-disable` directives.
- `AGENTS.md` states the comment policy.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm test` pass.
- `docs/PROJECT_STATUS.md` and `docs/EPICS.md` mark EPIC 11.2 done.

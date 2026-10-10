# EPIC 11.2 — Comment Audit & Hack Removal

## EPIC

**Name:** Comment Audit & Hack Removal  
**Objective:** Review every comment in the codebase, keep only comments that explain non-obvious
"why", and remove every hack those comments expose (legacy fallbacks, stale TODOs, workarounds,
lint/type suppressions). Then add a lint guardrail so this does not come back. Nothing has shipped
to production, so the target is clean code now, not compatibility.  
**Generated:** 2026-10-10  
**Roadmap entry:** [`docs/EPICS.md`](../../EPICS.md)

## Baseline (2026-10-10, measured for prompt `01`)

The scan counts comment-bearing source lines, including TSX, CSS, HTML, SQL, Dockerfiles, YAML, and
root config files. It covers every file under `apps/`, `packages/`, `tools/`, and `scripts/`, plus
matching root config files; generated and dependency directories are excluded.

| Area                             | Comment-bearing lines |
| -------------------------------- | --------------------: |
| `apps/core` API                  |                    50 |
| `apps/core` application          |                   250 |
| `apps/core` domain               |                   215 |
| `apps/core` infrastructure       |                   142 |
| `apps/core` tests and test setup |                   326 |
| `apps/core` config/other         |                    38 |
| `apps/web`                       |                    76 |
| `apps/console`                   |                    72 |
| `apps/admin`                     |                    44 |
| `packages/shared`                |                   171 |
| `tools/conversation-evaluation`  |                    41 |
| `scripts`                        |                     0 |
| root config                      |                   128 |
| **Total**                        |             **1,553** |

- `eslint-disable`: 172 directives (83 outside tests), mostly `complexity` (74 rule uses) and
  `max-lines-per-function` (82 rule uses), plus `max-lines` (14),
  `@typescript-eslint/no-non-null-assertion` (5), `@typescript-eslint/require-await` (3),
  `@typescript-eslint/no-explicit-any` (1), `@typescript-eslint/no-unsafe-call` (1),
  `@typescript-eslint/no-unnecessary-condition` (1), and `require-yield` (1). Combined directives
  are counted once as directives and once per listed rule in the rule-use totals.
- `as unknown as`: 59 (6 outside tests); `as any`: 1 (test-only); non-null assertions: 5
  (test-only); `@ts-ignore` / `@ts-expect-error`: 0.
- Confirmed hack markers include the three stale TODOs, undefined unlock-state and missing
  working-memory-field fallbacks, session/avatar memory mirrors, legacy evaluation provider/report
  handling, the fixture-only direct chunk-write path, and commented swallowed-error paths. The full
  disposition is in [COMMENT_INVENTORY.md](COMMENT_INVENTORY.md).

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

# Remove Lint Suppressions and Type Escapes

# Context

`eslint-disable` directives and type escapes are comments that say "the rules are right, but not
here". About 157 `eslint-disable` lines exist (73 outside tests), mostly `complexity` and
`max-lines-per-function`, plus non-null assertions, `require-await`, one `no-explicit-any`, and a
few `as unknown as` casts in production code. Most of them hide functions that are too large or
types that don't model the data. This prompt fixes the code so the suppression isn't needed.

# Scope

In scope:

- Every S item marked "split" or "refactor" in `COMMENT_INVENTORY.md`.
- Production code first, then tests. In tests, large `describe` callbacks that need
  `max-lines-per-function` should be split into smaller `describe` blocks or files.
- Non-null assertions: replace with a narrowing check, a typed failure, or a type that guarantees
  the value.
- `as unknown as` / `as any` in production: replace with a proper type, a schema parse at the
  boundary, or a type guard.
- `require-await` / `no-unnecessary-condition` disables: fix the signature or the condition.

Out of scope: changing the lint thresholds in `eslint.config.mjs`. The rules stay; the code
changes. Test doubles may keep `as unknown as` when they intentionally build a partial fake; record
those in the inventory.

# Relevant Docs

- `COMMENT_INVENTORY.md` (this EPIC)
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Split large functions along existing responsibilities (parse → decide → build result), not into
  arbitrary helpers. Keep new helpers private to the module unless another module already needs
  them.
- Don't move logic across layers to satisfy a metric: an API route's mapping helper stays in API,
  a domain policy stays in Domain.
- A disable may stay only if the inventory records why splitting makes the code worse. Every kept
  disable gets an inline reason using ESLint's `-- reason` syntax, e.g.
  `// eslint-disable-next-line complexity -- exhaustive switch over ProviderErrorKind`.
- Remove file-level `/* eslint-disable max-lines */` by splitting the file by responsibility.
- Check for existing helpers before writing new ones (`packages/shared`, `application/*/` helpers
  consolidated in EPIC 11.1).
- Run the narrowest tests after each file; behavior must not change.

# Constraints

- No behavior changes. This is a structural refactor.
- No new abstractions used by only one caller unless they replace a suppressed block.
- Keep `strictTypeChecked` and current thresholds.
- Preserve public exports and API shapes.

# Deliverables

- All "split"/"refactor" S items done; each remaining disable has a `-- reason` and an inventory
  entry.
- Production code has no `as unknown as`, `as any`, or non-null assertion without a recorded reason.
- Tests still pass without changes to the asserted behavior.

# Mandatory Pre-Implementation Check

1. Identify touched entities/contracts in each refactored function.
2. Search for duplicated type definitions that a cast was working around.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types and guards where possible.
5. If a cast exists because two copies of a type drifted, consolidate to one owner first.

# Mandatory Final Step — Documentation Update

Review and update `docs/PROJECT_STATUS.md` and the inventory. Update `docs/ARCHITECTURE.md` only if
a module split changes a documented module boundary. If no doc changes are needed, verify and state
that they are accurate. Run `pnpm lint`, `pnpm typecheck`, and `pnpm test`. Commit as
`refactor: remove lint suppressions and type escapes (epic 11.2)`.

# Acceptance Criteria

- [ ] `eslint-disable` count is reduced to recorded keeps only, each with `-- reason`.
- [ ] No file-level `eslint-disable` remains unless recorded.
- [ ] No unexplained `as unknown as`, `as any`, or `!` in production code.
- [ ] Lint thresholds are unchanged.
- [ ] Lint, typecheck, and tests pass.

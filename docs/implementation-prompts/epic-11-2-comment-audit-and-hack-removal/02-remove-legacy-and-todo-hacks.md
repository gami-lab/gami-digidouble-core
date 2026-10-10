# Remove Legacy Fallbacks, Stale TODOs, and Workarounds

# Context

The H section of `COMMENT_INVENTORY.md` lists hacks the comments expose. Every deploy recreates the
database and nothing has shipped, so code that handles "legacy rows", "legacy sessions", or "legacy
reports" protects data that cannot exist. TODOs pointing at long-finished epics are either missing
work or dead notes. This prompt removes the hacks themselves.

# Scope

In scope:

- Every H item in the inventory: delete the legacy/compatibility path, implement the missing piece,
  or delete the TODO and move a real follow-up to `docs/EPICS.md`.
- Delete or rewrite the tests that exist only to protect a removed fallback (e.g. "returns avatars
  for legacy sessions without unlock state", "defaults covered topics for legacy rows").
- Tighten types once fallbacks are gone: fields that were optional only for legacy data become
  required, and defaulting code goes away.
- Schema: if a column default or nullable column existed only for legacy rows, change the schema
  directly (no migration; the database is recreated).

Out of scope: lint suppressions (prompt `03`) and plain noise comments (prompts `04`/`05`), except
comments on the lines you are already changing.

# Relevant Docs

- `COMMENT_INVENTORY.md` (this EPIC)
- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Work one H item at a time; each one should be a small, reviewable diff with its tests.
- `TODO(EPIC-4.2)` in `start-session.use-case.ts` and `get-history.use-case.ts`: check what the
  current API contract actually promises. If the shape in `docs/API_CONTRACT.md` is already
  complete, delete the TODO. If it promises more than the code delivers, align code and contract
  (smaller is fine) in the same change.
- `TODO(epic-4-5)` in `stream-runtime-events.stack-e2e.test.ts`: add the live event frame assertion
  if it is feasible with current stack-e2e seeding; otherwise remove the TODO and add the gap to
  `docs/TEST_COVERAGE_PLAN.md`.
- Unlock-state, working-memory covered-topics, and session-memory mirror fallbacks: make the
  persisted shape always complete at write time, then remove read-time defaults, the "legacy" tests,
  and the optionality in domain types.
- Evaluation tool (`tools/conversation-evaluation`): remove `'legacy'` provider handling and the
  legacy report fields; old reports are not supported.
- If a fallback turns out to cover a real current case, it is not legacy: rename it so the name and
  tests describe the real case, and record that in the inventory.
- Before changing a contract, follow the contract-drift check below. Removing optionality from a
  field duplicated in several places means consolidating those definitions first.

# Constraints

- No compatibility shims, deprecated aliases, or migrations.
- Keep each change minimal: remove the hack, don't redesign the surrounding module.
- Every endpoint shape change updates `docs/API_CONTRACT.md` in the same commit.
- Do not weaken tests to make removal pass; replace legacy tests with tests of the current
  invariant (e.g. "a new session always stores unlock state").

# Deliverables

- All H items closed in code, each marked done in `COMMENT_INVENTORY.md` with a short note.
- Tests updated: legacy tests removed, invariant tests added where a guarantee moved to write time.
- Real follow-ups, if any, added to `docs/EPICS.md` instead of code TODOs.

# Mandatory Pre-Implementation Check

1. Identify touched entities/contracts (Session unlock state, conversation working memory, history
   and start-session DTOs, evaluation report contracts).
2. Search for duplicated type definitions, repeated inline response shapes, local copies in
   console/web/admin, optionality/nullability drift, and field-name drift.
3. Identify the canonical owner of each contract (`packages/shared` for public DTOs, Domain for
   entities).
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one before removing the hack.

# Mandatory Final Step — Documentation Update

Review and update `docs/PROJECT_STATUS.md`, plus `docs/DATA_MODEL.md`, `docs/API_CONTRACT.md`,
`docs/MEMORY_SYSTEM_SPEC.md`, and `docs/TEST_COVERAGE_PLAN.md` wherever a removed fallback or
tightened field appears. If no doc changes are needed, verify and state that they are accurate. Run
focused tests, then `pnpm lint`, `pnpm typecheck`, and `pnpm test`. Commit as
`refactor: remove legacy fallbacks and stale TODOs (epic 11.2)`.

# Acceptance Criteria

- [ ] `grep -rniE 'TODO|FIXME|legacy|backward.?compat|workaround'` over `apps/ packages/ tools/`
      returns only hits with a recorded, valid reason in the inventory.
- [ ] No read-time defaulting for data shapes the code itself always writes.
- [ ] Types no longer carry optionality that existed only for legacy data.
- [ ] Docs and contracts match the code.
- [ ] Lint, typecheck, and tests pass.

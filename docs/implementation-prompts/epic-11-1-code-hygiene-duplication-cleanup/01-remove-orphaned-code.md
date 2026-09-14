# Remove Confirmed Orphaned and Retired Code

# Context

The audit found four high-confidence dead-code clusters. D1 contains orphaned private-app modules.
D2 contains ingestion use cases and types retained only by their unit tests. D3 contains legacy
cache, compaction, flat-context, and working-memory policy abstractions. D4 contains an Avatar memory
assembler used only by its dedicated test. The active runtime uses newer route, ingestion, memory,
and Context Engine paths.

# Scope

- Remove D1–D4 source files and tests that exist solely for those retired designs, after confirming
  that no package script, dynamic entrypoint, bundler path, deployment path, or external consumer uses
  them.
- Preserve current knowledge ingestion, structured context, memory selection, working-memory, and
  idempotency implementations.
- Remove exports, registrations, test fixtures, and imports that become unused as a direct result.
- Do not expand this prompt into general cleanup of unrelated low-confidence code.

# Relevant Docs

- `docs/CODE_AUDIT.md`
- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/DATA_MODEL.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`
- `docs/EPICS.md`

# Implementation Guidance

- Re-run repository-wide searches before deletion. Pay special attention to package scripts, test
  configs, seed/retrieval-quality tooling, barrel exports, and deep imports.
- Treat the private `@gami/core` and app packages as lower-risk for external consumers, but still
  verify the package exports and documented operator workflows.
- Delete a retired source cluster with its tests when the tests only validate the retired design;
  do not leave tests that make dead code look supported.
- If a supposedly dead symbol is used by an intentional script or integration boundary, retain it,
  make that entrypoint explicit, and record the reason rather than deleting it.
- For any retained or touched entity/contract, check duplicate type definitions, inline response
  shapes, local copies, optionality/nullability drift, and field-name drift. Refactor ownership
  first if a field change would otherwise require multiple identical shape edits.

# Constraints

- Do not change the active runtime flow, endpoint contracts, database schema, or provider behavior.
- Do not remove current memory repositories, working-memory contracts, Context Engine types, or
  knowledge ingestion paths identified as active in the audit.
- Do not add compatibility aliases for deleted code.
- No new HTTP endpoint is expected; if an unexpected endpoint change appears, stop and reassess.

# Deliverables

- D1–D4 deleted or retained with evidence-backed rationale.
- Clean imports/exports and tests after deletion.
- Focused verification showing the active replacement paths remain covered.
- A concise deletion inventory in the implementation summary.

# Mandatory Pre-Implementation Check

Inspect `docs/CODE_AUDIT.md`, `git status`, all D1–D4 references, package exports/scripts, and the
source-of-truth docs. Confirm no uncommitted user work overlaps the target files. Before editing any
touched contract, search for duplicate definitions, inline shapes, local copies,
optionality/nullability drift, and field-name drift.

# Mandatory Final Step — Documentation Update

Update `docs/PROJECT_STATUS.md` and `docs/EPICS.md` to reflect progress on EPIC 11.1 when this
workstream materially changes the cleanup status. Update `docs/ARCHITECTURE.md`,
`docs/DATA_MODEL.md`, `docs/MEMORY_SYSTEM_SPEC.md`, or `docs/TEST_STRATEGY.md` if ownership or
supported test boundaries changed. Do not mark the EPIC complete before all prompts finish.

# Acceptance Criteria

- No deleted D1–D4 file is reachable from a runtime, package-script, test, or documented external
  entrypoint.
- Active ingestion and memory/context paths compile and retain their existing tests.
- No compatibility alias or duplicate replacement is introduced.
- Lint, typecheck, and focused tests pass.

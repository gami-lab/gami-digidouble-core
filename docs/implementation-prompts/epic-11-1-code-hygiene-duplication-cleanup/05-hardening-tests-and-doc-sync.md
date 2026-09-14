# Harden Verification and Synchronize Documentation

# Context

The preceding prompts remove high-confidence dead code and consolidate only behaviorally equivalent
duplication. The final step must prove the cleanup did not alter runtime contracts or leave behind
unverified dead symbols. The audit baseline was green for lint, typecheck, build, and the full test
suite; strict unused checks exposed additional redundancy not covered by the normal lint gate.

# Scope

- Review the complete EPIC diff and the final audit findings D1–D4 and R1–R7.
- Add or adjust focused regression/architecture tests only where the cleanup needs durable protection.
- Run the strict unused-symbol checks used by the audit, then the repository’s normal lint, typecheck,
  build, and full deterministic test gate.
- Re-run repository-wide searches for deleted symbols, duplicate contract shapes, and stale imports.
- Synchronize the EPIC, project status, and impacted source-of-truth docs.
- Commit the completed EPIC changes using a Conventional Commit.

# Relevant Docs

- `docs/CODE_AUDIT.md`
- `docs/README.md`
- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TECH_STACK.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/PROJECT_STATUS.md`
- `docs/EPICS.md`

# Implementation Guidance

- Inspect the full diff and preserve unrelated user changes. Use `git diff`, `git diff --check`, and
  `git status` before committing.
- For every touched entity or contract, verify duplicate type definitions, inline response shapes,
  local copies, optionality/nullability drift, and field-name drift. Do not accept a green test suite
  if contract ownership is still ambiguous.
- Use the narrowest relevant checks first, then run the full gate. Do not weaken or skip tests to make
  cleanup pass.
- Confirm no new endpoint, schema, migration, dependency, or compatibility path was introduced.
- Update documentation with durable current-state information only; keep command output and detailed
  implementation history in the commit/CI evidence.
- Mark EPIC 11.1 complete in `docs/EPICS.md` only if every acceptance criterion in the EPIC is met.

# Constraints

- Do not fix unrelated findings discovered during verification.
- Do not rewrite tests solely for style or change production behavior to satisfy a check.
- Do not commit secrets, environment files, generated artifacts, or unrelated user work.
- Any endpoint change discovered during review requires the owning API contract and stack E2E work;
  this cleanup EPIC should normally have none.

# Deliverables

- Focused regression or architecture checks for the final cleanup where needed.
- Successful strict unused-symbol check and normal repository gate, or a precise documented blocker.
- Final stale-reference and contract-duplication search results.
- Synchronized `PROJECT_STATUS.md`, `EPICS.md`, and impacted source-of-truth docs.
- A Conventional Commit containing only the EPIC changes.

# Mandatory Pre-Implementation Check

Read the complete audit and all prior prompt outputs, inspect the full diff and current status, and
review all relevant source-of-truth docs. Verify no user changes are included in the commit. Before
editing any remaining contract, search for duplicate definitions, inline response shapes, local
copies, optionality/nullability drift, and field-name drift.

# Mandatory Final Step — Documentation Update

Update `docs/PROJECT_STATUS.md` and `docs/EPICS.md` to record the final EPIC state. Update every
impacted source-of-truth document among `ARCHITECTURE.md`, `API_CONTRACT.md`, `DATA_MODEL.md`,
`GAME_MASTER_CONTRACT.md`, `MEMORY_SYSTEM_SPEC.md`, `TECH_STACK.md`, `TEST_STRATEGY.md`, and
`TEST_COVERAGE_PLAN.md`; if no durable contract changed, explicitly keep those docs unchanged.
Run formatting and `git diff --check`, then commit the completed EPIC changes with a Conventional
Commit.

# Acceptance Criteria

- D1–D4 and R1–R7 are all closed or have explicit, evidence-backed rationale.
- No stale imports, deleted-symbol references, unexplained duplicate public contracts, or newly
  unused symbols remain in the touched scope.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, and the strict unused check pass.
- Documentation accurately states the cleanup status and preserves the current API/runtime contract.
- The final commit is focused and clean.

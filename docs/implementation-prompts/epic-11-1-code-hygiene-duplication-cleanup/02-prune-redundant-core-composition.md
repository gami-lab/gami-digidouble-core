# Prune Redundant Core Composition and Unused Symbols

# Context

The audit identified redundant Core route-composition helpers, repeated knowledge profile/metadata/
visibility validation, and unused constructor properties, parameters, and locals exposed by strict
TypeScript checks. These are maintenance risks because equivalent defaults and validation rules can
drift while appearing to be separate behavior.

# Scope

- Address R3, R4, and R7 in `apps/core`.
- Consolidate equivalent working-memory and LLM configuration composition helpers behind the correct
  Application/API ownership boundary.
- Consolidate knowledge normalization/validation only where the inputs, failure semantics, and
  ownership are equivalent; retain database-specific decoding and boundary mapping where they differ.
- Remove the audited unused `KnowledgeIngestionService.chunkRepository`, memory repository
  constructor properties, `RunGameMasterUseCase.callLlm` unused argument, and
  `formatSuggestedAvatar` unused parameter/local only after confirming their call signatures.
- Update direct tests and composition wiring affected by the minimal cleanup.

# Relevant Docs

- `docs/CODE_AUDIT.md`
- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`
- `docs/EPICS.md`

# Implementation Guidance

- Start with the ownership matrix from prompt `00`; do not create a Core-wide utility merely to
  remove two short functions.
- Preserve API boundary validation and application orchestration. A helper used by a route and a
  helper used by persistence may look similar but must not share a type that leaks the wrong layer.
- Confirm all callers before changing function signatures. Prefer removing an unused parameter over
  preserving it for hypothetical compatibility.
- Compare error codes/messages, default values, trimming/omission behavior, null handling, and
  ordering before consolidating knowledge or configuration helpers.
- For every touched entity or contract, check duplicate type definitions, inline response shapes,
  local copies, optionality/nullability drift, and field-name drift. If a new field would require
  editing multiple identical shapes, refactor ownership before adding it.
- Add deterministic regression coverage for any behavior-sensitive consolidation; do not add
  provider calls or new integration dependencies.

# Constraints

- No endpoint, schema, migration, datastore, provider, or runtime-order changes.
- Do not broaden the cleanup to active domain abstractions that are not in R3/R4/R7.
- Do not suppress TypeScript unused checks or retain dead parameters with dummy reads.
- No new endpoint is expected, so no stack E2E addition should be necessary.

# Deliverables

- One clear owner for each consolidated Core composition/normalization behavior.
- Unused symbols removed with signatures and tests updated coherently.
- Focused unit/integration tests covering defaults, validation failures, nullability, and mapping
  behavior where relevant.
- No unreviewed behavior changes in active routes or use cases.

# Mandatory Pre-Implementation Check

Read the audit findings and prompt `00` output, inspect all callers and package entrypoints, and
review current docs before editing. Check touched contracts for duplicate definitions, inline
response shapes, local copies, optionality/nullability drift, and field-name drift.

# Mandatory Final Step — Documentation Update

Update `docs/PROJECT_STATUS.md` and `docs/EPICS.md` with the current EPIC progress. Update
`docs/ARCHITECTURE.md`, `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md`, `docs/GAME_MASTER_CONTRACT.md`,
`docs/MEMORY_SYSTEM_SPEC.md`, and/or `docs/TEST_STRATEGY.md` if the cleanup changes documented
ownership or test boundaries; otherwise record that the public contracts remain unchanged. Do not
mark EPIC 11.1 complete before prompt `05`.

# Acceptance Criteria

- R3, R4, and R7 are resolved or have explicit keep-separate rationale.
- Strict unused-symbol checks no longer report the audited unused members in touched code.
- Core defaults, validation, errors, and route behavior remain unchanged.
- Focused Core tests plus lint and typecheck pass.

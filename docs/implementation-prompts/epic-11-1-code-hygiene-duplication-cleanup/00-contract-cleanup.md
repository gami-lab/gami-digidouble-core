# Establish Contract Ownership Before Cleanup

# Context

`docs/CODE_AUDIT.md` identified duplication across public/shared DTOs, app-local API clients and
mappers, Core route composition, knowledge normalization, memory selection, and provider helpers.
The repository already has explicit ownership rules: `packages/shared` owns public/shared DTOs and
cross-cutting contract types; API owns boundary validation/mapping; Application owns orchestration;
Domain owns policies and typed failures; Infrastructure owns provider and persistence adapters.

This prompt is the prerequisite for EPIC 11.1. It prevents a cleanup from replacing several copies
with a new ambiguous copy or from deduplicating code whose differences are intentional boundary
semantics.

# Scope

- Inspect the R1–R7 findings in `docs/CODE_AUDIT.md` and the current source-of-truth docs.
- Build a concise ownership matrix for each affected contract, mapper, validator, composition helper,
  and provider/stream helper.
- Identify the canonical implementation or designate a new minimal owner only when the current
  ownership is genuinely absent.
- Mark each candidate as one of: remove, consolidate, keep intentionally separate, or needs
  follow-up investigation.
- Make only the minimum structural changes needed to establish ownership; do not implement the
  later cleanup workstreams in this prompt.

# Relevant Docs

- `docs/CODE_AUDIT.md`
- `docs/README.md`
- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`
- `docs/EPICS.md`

# Implementation Guidance

- Search all source, tests, package scripts, build configuration, and deployment configuration before
  moving or deleting anything.
- For every touched entity or contract, check for duplicate type definitions, inline response shapes,
  local copies, optionality/nullability drift, and field-name drift. If adding or changing a field
  would require editing multiple identical shapes, refactor ownership first.
- Preserve intentional boundary mappers. Similar code is not automatically duplicate when it maps
  persistence rows, domain objects, API responses, or browser state at different ownership layers.
- Keep browser-specific concerns such as `Blob`, `AbortSignal`, streaming, and audio at their app
  boundaries unless a smaller, environment-neutral helper is clearly safe.
- Prefer deleting duplicate wrappers when one existing canonical function already owns the behavior;
  avoid introducing a generic utility with more options than the current call sites need.
- Record the resulting ownership decisions in a focused implementation note or code comments only
  when the reason would otherwise be non-obvious. Do not create a second roadmap or audit document.

# Constraints

- Do not change endpoint paths, request/response shapes, database schema, provider behavior, or
  runtime ordering.
- Do not add a new endpoint or require stack E2E for this cleanup-only prerequisite.
- Do not delete code solely because it is textually similar; require verified equivalent semantics.
- Preserve existing user work and keep the diff limited to contract ownership decisions.

# Deliverables

- A reviewed ownership matrix or equivalent focused record covering R1–R7.
- Minimal ownership/contract cleanup required to unblock prompts `01`–`04`.
- Updated or added focused tests only where ownership changes could otherwise regress behavior.
- A clear list of candidates intentionally kept separate and why.

# Mandatory Pre-Implementation Check

Before editing, inspect `docs/CODE_AUDIT.md`, the repository status, package entrypoints/scripts, and
all source-of-truth docs listed above. Verify that no current uncommitted user work overlaps the
planned files. Re-check every touched contract for duplicate definitions, inline shapes,
optionality/nullability drift, and field-name drift.

# Mandatory Final Step — Documentation Update

Update `docs/PROJECT_STATUS.md` and `docs/EPICS.md` if the cleanup status or EPIC scope changed.
Update `docs/ARCHITECTURE.md`, `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md`,
`docs/GAME_MASTER_CONTRACT.md`, `docs/MEMORY_SYSTEM_SPEC.md`, or `docs/TEST_STRATEGY.md` only when
ownership or behavior in that document changed. If no source-of-truth contract changed, state that
explicitly in the implementation summary. Do not mark EPIC 11.1 complete yet.

# Acceptance Criteria

- Every R1–R7 candidate has one unambiguous owner or an explicit keep-separate rationale.
- No new duplicate public contract or inline response shape is introduced.
- Existing API and runtime behavior are unchanged.
- Focused checks for touched code pass.
- The next prompt can proceed without guessing which copy is canonical.

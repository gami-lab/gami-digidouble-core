# Consolidate Memory, Provider, and Stream Helpers

# Context

The audit found repeated recent-user/avatar exchange pairing implementations and repeated provider,
timeout-signal, terminal-event, and storage/web helper functions. Some differences may be deliberate:
memory projection semantics, provider lifecycle ownership, persistence boundaries, and browser
stream behavior must remain explicit.

# Scope

- Address R5 and R6 after reviewing prompt `00`’s ownership decisions.
- Compare and consolidate equivalent recent-exchange/window logic only when limits, ordering,
  speaker pairing, empty-turn behavior, and truncation semantics are identical.
- Consolidate provider/web helpers such as timeout signal creation, terminal event handling, and
  storage helpers only when their lifecycle and environment boundaries match.
- Preserve separate implementations where Avatar/GM projections, persistence adapters, provider
  adapters, or browser stream consumers intentionally differ.
- Add focused deterministic coverage for consolidated helpers and update imports.

# Relevant Docs

- `docs/CODE_AUDIT.md`
- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`
- `docs/EPICS.md`

# Implementation Guidance

- Treat semantic equivalence as the bar, not similar function names. Compare ordering, caps,
  filtering, speaker roles, fallback behavior, error propagation, cancellation, cleanup, and
  ownership of side effects.
- Keep domain/application memory projection logic separate from infrastructure persistence decoding
  and from browser event rendering unless the contract is truly shared.
- Provider helpers must remain behind internal ports/adapters; do not expose provider payloads or
  raw diagnostics.
- For every touched entity or contract, check duplicate type definitions, inline response shapes,
  local copies, optionality/nullability drift, and field-name drift. Refactor ownership first if a
  field change would otherwise require multiple identical shapes.
- Prefer a small pure helper with explicit inputs over a generic orchestration abstraction. Keep
  timeout and cancellation behavior deterministic and bounded.
- No endpoint is added by this cleanup. If any change appears to alter an HTTP/SSE contract, stop and
  update the owning contract plan before proceeding.

# Constraints

- Preserve memory layer boundaries, GM non-blocking behavior, stream ordering, interruption cleanup,
  provider fallback, and persistence semantics.
- Do not add a datastore, provider, dependency, endpoint, or compatibility layer.
- Do not consolidate helpers merely to reduce line count when their side effects or environments
  differ.

# Deliverables

- R5 and R6 resolved or documented as intentionally separate.
- Focused tests for exchange-window semantics and any consolidated provider/stream helper behavior.
- No leaked raw prompts, provider payloads, vectors, audio, or unbounded transcripts.
- Clean imports and explicit helper ownership.

# Mandatory Pre-Implementation Check

Read the audit, prompt `00`, memory and GM contracts, API/stream contracts, and all candidate helper
call sites. Inspect current uncommitted work. Before editing touched contracts, search for duplicate
types, inline response shapes, local copies, optionality/nullability drift, and field-name drift.

# Mandatory Final Step — Documentation Update

Update `docs/PROJECT_STATUS.md` and `docs/EPICS.md` with progress. Update `docs/MEMORY_SYSTEM_SPEC.md`,
`docs/GAME_MASTER_CONTRACT.md`, `docs/API_CONTRACT.md`, `docs/ARCHITECTURE.md`, or
`docs/TEST_STRATEGY.md` if ownership or behavior changed; otherwise record that the documented
contracts remain unchanged. Do not mark EPIC 11.1 complete before prompt `05`.

# Acceptance Criteria

- R5 and R6 have one owner per truly shared behavior or a concrete keep-separate rationale.
- Existing memory ordering/caps, stream ordering/cancellation, and provider lifecycle behavior are
  unchanged.
- Deterministic focused tests pass, including edge cases for empty, capped, and interrupted flows.
- Lint and typecheck pass.

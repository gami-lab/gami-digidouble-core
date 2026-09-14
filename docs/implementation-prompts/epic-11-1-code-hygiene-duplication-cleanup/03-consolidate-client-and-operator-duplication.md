# Consolidate Browser API and Operator-App Duplication

# Context

The audit found three browser API clients repeating URL normalization, API-key injection, envelope
validation, error conversion, and request handling. Admin and console also duplicate model-config
request mapping and Avatar override mapping. Web has additional binary/audio and abort behavior that
must remain at the appropriate browser boundary.

# Scope

- Address R1 and R2 across `apps/admin`, `apps/console`, `apps/web`, and `packages/shared` only as
  needed for a minimal, well-owned extraction.
- Consolidate protocol-level helpers such as URL normalization, envelope/error guards, and error
  conversion when they are environment-neutral.
- Consolidate equivalent model-config request and Avatar override mappers while preserving each
  app’s UI state ownership.
- Remove obsolete local copies and update imports/tests.
- Keep app-specific request functions, streaming, binary/audio, and abort semantics at their
  boundaries unless the ownership matrix proves a smaller safe abstraction.

# Relevant Docs

- `docs/CODE_AUDIT.md`
- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`
- `docs/EPICS.md`

# Implementation Guidance

- Follow prompt `00`’s ownership decision. A shared helper must be contract/protocol-level and must
  not pull browser runtime concerns or Core domain types into the wrong package.
- Compare headers, authentication behavior, URL joining, JSON/envelope validation, error codes,
  abort behavior, binary response handling, and stream behavior before merging clients.
- Compare model-config and Avatar override trimming, omission, `undefined`/`null` behavior, and field
  names before merging mappers.
- Keep API response mapping at the API boundary and UI state mapping in the consumer app. Do not
  move persistence or domain entities into `packages/shared` to make mappers look identical.
- For every touched entity or contract, check duplicate type definitions, inline response shapes,
  local copies, optionality/nullability drift, and field-name drift. If a new field needs edits in
  multiple identical shapes, refactor ownership first.
- Add focused tests for shared protocol helpers and mapper edge cases; no endpoint changes are part
  of this EPIC, so no new stack E2E endpoint test is expected.

# Constraints

- Preserve current API paths, request/response envelopes, headers, auth, streaming, audio, and
  cancellation behavior.
- Do not make the three apps depend on UI-framework or server-only code.
- Do not introduce a large generic client framework or speculative configuration layer.
- Do not change public API contracts or add endpoints.

# Deliverables

- Protocol-level duplication consolidated with a clear owner, or an explicit rationale for keeping
  an app-specific copy.
- Equivalent operator mappers consolidated without changing omission or validation semantics.
- Tests proving client protocol and mapper behavior at their actual ownership boundary.
- Clean imports and no duplicate helpers left unexplained in touched areas.

# Mandatory Pre-Implementation Check

Read `docs/CODE_AUDIT.md`, prompt `00`, all three client implementations, both operator mapper
implementations, package exports, and current API/shared docs. Check `git status` for user work.
Before editing touched contracts, search for duplicate types, inline response shapes,
optionality/nullability drift, and field-name drift.

# Mandatory Final Step — Documentation Update

Update `docs/PROJECT_STATUS.md` and `docs/EPICS.md` with EPIC progress. If shared contract ownership,
API mapping, or test boundaries changed, update `docs/ARCHITECTURE.md`, `docs/API_CONTRACT.md`,
`docs/DATA_MODEL.md`, and `docs/TEST_STRATEGY.md` as applicable. Otherwise record that endpoint
contracts and browser behavior remain unchanged. Do not mark EPIC 11.1 complete before prompt `05`.

# Acceptance Criteria

- R1 and R2 are consolidated or explicitly justified at the correct boundary.
- Admin, console, and web preserve their existing auth, envelope, error, stream, binary, and abort
  behavior.
- Model-config and Avatar override payloads are byte-for-byte equivalent for existing inputs.
- Focused app/shared tests, lint, and typecheck pass.

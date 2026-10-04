# Admin API Validation, Mapping & Schema Parity

# Context

With `avatarOverride` added to the shared type (prompt `01`), the admin API surface for scenarios
must accept, validate, and persist it — and must also stop silently dropping `memoryOverride`,
which the type has carried since EPIC 6.1 but which never got wired through the API layer. Today,
`apps/core/src/api/routes/model-selection-mappers.ts` (`normalizeCreateScenarioModelSelection`) and
`apps/core/src/api/routes/model-selection-validation.ts` (`validateScenarioModelSelection`) both
only handle `defaultProfile`/`gameMasterOverride`; and the Fastify JSON body schemas in
`apps/core/src/api/routes/scenarios.ts` (`createScenarioBodySchema` and `updateScenarioBodySchema`)
declare `modelSelection` with `additionalProperties: false` and only
`defaultProfile`/`gameMasterOverride` properties — so sending `avatarOverride` or `memoryOverride`
today is stripped or rejected at the schema layer before validation even runs.

# Scope

In scope:

- `model-selection-mappers.ts`: extend `normalizeCreateScenarioModelSelection` to normalize
  `avatarOverride` and `memoryOverride` the same way as the existing two fields (trim `model`, pass
  through `provider`).
- `model-selection-validation.ts`: extend `validateScenarioModelSelection` — the "must define ...
  when provided" guard and the chained `validateModelProfile(...)` calls — to cover
  `avatarOverride` and `memoryOverride`.
- `scenarios.ts`: add `avatarOverride` and `memoryOverride` property definitions (mirroring the
  existing `defaultProfile`/`gameMasterOverride` shape exactly) to both `createScenarioBodySchema`
  and the `modelSelection` object in `updateScenarioBodySchema`'s `anyOf` branch.
- Extend `apps/core/src/api/routes/scenarios.stack-e2e.test.ts`: add assertions for
  `avatarOverride`/`memoryOverride` to the existing "creates scenario with runtime model selection"
  test, the "updates and clears modelSelection" test, and the "rejects requests with invalid
  modelSelection catalog entry" validation test.
- Unit tests for the mapper and validator covering the two new fields.

Out of scope:

- Admin UI changes (prompt `04`).
- The avatar trait preparation use case (prompt `03`).

# Relevant Docs

- `docs/API_CONTRACT.md` (scenario create/update request shape and validation rules)

# Implementation Guidance

- In `model-selection-mappers.ts`, follow the exact pattern already used for `gameMasterOverride`:
  a conditional spread checking `modelSelection.avatarOverride !== undefined`, copying
  `{ provider: ..., model: ...trim() }`. Apply the same for `memoryOverride`.
- In `model-selection-validation.ts`, the current guard rejects when neither `defaultProfile` nor
  `gameMasterOverride` is present. Decide deliberately whether `avatarOverride`/`memoryOverride`
  alone (without `defaultProfile`) should satisfy "modelSelection was provided with content" — most
  consistent with the EPIC's symmetry goal is: the guard should pass if **any** of the four fields
  is present, not just the original two. Update the error message text accordingly.
- In `scenarios.ts`, copy the `gameMasterOverride` JSON schema block verbatim for both new fields,
  including `required: ['provider', 'model']` and `additionalProperties: false` on the nested
  object — only the outer `modelSelection.properties` key name changes.
- When extending the stack-e2e test, prefer adding new assertions inside existing `it` blocks over
  adding new ones, unless the EPIC's stack-e2e rule (auth/validation/not-found coverage for new
  behavior) requires a dedicated case — in which case follow the existing
  `describe('Stack E2E — ... — validation', ...)` naming convention.
- Run the project's scenario stack-e2e test target after changes, not just unit tests, since this
  prompt's correctness hinges on the full request → validation → mapping → persistence → read-back
  path.

# Constraints

- DRY: if the four `modelSelection` property schema blocks are now fully identical in shape,
  consider (but do not over-engineer) extracting a shared JSON schema fragment — only do this if it
  doesn't complicate the existing `as const` typing Fastify relies on for request typing.
- Backward compatibility: requests with only `defaultProfile`/`gameMasterOverride` (today's valid
  shapes) must continue to validate and persist exactly as before.
- Explicit contracts: do not relax `additionalProperties: false` — new fields must be explicitly
  declared, not permitted generically.

# Deliverables

- Updated mapper, validator, and both JSON schemas accepting and round-tripping all four
  `modelSelection` fields.
- Extended stack-e2e coverage proving `avatarOverride`/`memoryOverride` survive create → read,
  update → read, and clear (`null`) flows, and that invalid catalog entries for either field are
  rejected with `400`.
- Unit tests for the mapper and validator.

# Mandatory Pre-Implementation Check

1. Touched contracts: `CreateScenarioRequest`/`UpdateScenarioRequest` (shared DTOs, already
   type-complete per prompt `01`), the Fastify JSON schemas (hand-written, must be manually kept in
   sync — this is the actual risk area for drift).
2. Search for any other place the four `modelSelection` keys might be enumerated by hand (e.g.
   OpenAPI/Swagger doc generation, other route files) — re-verify with a repo-wide grep for
   `gameMasterOverride` before coding, since that string is a reliable marker of every place
   needing the mirrored treatment.
3. Canonical owners: `model-selection-mappers.ts`, `model-selection-validation.ts`, `scenarios.ts`
   — all confirmed existing, no new files needed.
4. Reuse the exact existing per-field shape; do not invent a different validation message format.
5. N/A.

# Mandatory Final Step — Documentation Update

After implementation, update:

- `docs/API_CONTRACT.md` — the full precedence-section rewrite can be deferred to prompt `04`, but
  if you touch the request-body example payloads shown in `API_CONTRACT.md`, update them now so
  they don't show a stale two-field shape.
- `docs/PROJECT_STATUS.md` — update if it lists scenario `modelSelection` capabilities explicitly.

If no doc changes are needed beyond what's deferred to prompt `04`, state that explicitly.

# Acceptance Criteria

- [ ] `avatarOverride`/`memoryOverride` accepted by both create and update scenario JSON schemas
- [ ] Mapper normalizes both new fields identically to the existing two
- [ ] Validator enforces catalog validity for both new fields and accepts any of the four fields as
      satisfying "modelSelection has content"
- [ ] Stack-e2e tests cover create/update/clear/validation for both new fields
- [ ] Unit tests pass for mapper and validator
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass
- [ ] Docs reviewed/updated per above

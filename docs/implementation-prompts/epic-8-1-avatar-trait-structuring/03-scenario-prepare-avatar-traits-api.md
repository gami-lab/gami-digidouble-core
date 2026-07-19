# Title

Add Explicit Scenario Avatar Trait Preparation API

# Context

EPIC 8.1 requires an explicit preparation action. Trait computation must not be hidden behind a normal avatar read.

The API also needs to expose `computedTraits` on avatar reads so the derived structure is visible and reusable by later EPICs.

# Scope

Implement now:

- add the explicit scenario-scoped preparation endpoint
- wire the preparation use case into the API layer
- expose `computedTraits` on avatar read responses
- add route-level tests plus the required stack-e2e file for the new endpoint

Out of scope:

- admin UI
- prompt-assembly changes for runtime behavior
- advanced async job orchestration for preparation

# Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Keep the action explicit and scenario-scoped.
- Prefer a route name that is unmistakable and fits existing conventions, for example:
  - `POST /v1/scenarios/:scenarioId/prepare-avatar-traits`
- Do not trigger trait computation from `GET` routes.
- Validate input at the API boundary and return standard `ApiResponse<T>` envelopes.
- Reuse shared DTOs for:
  - request/response shapes
  - updated avatar read shape including `computedTraits`
- Update every route that returns `AvatarSummary` so the new field is consistent:
  - create avatar
  - update avatar
  - list scenario avatars
  - any direct avatar read surface that uses the same shared shape
- For API semantics, prefer:
  - `computedTraits: null` before preparation
  - populated stable structure after preparation
- Keep preparation synchronous unless the current codebase clearly needs a background job for safety.
  - This EPIC asks for an explicit action, not a job system
- Stack-e2e ownership is mandatory in this slice because a new HTTP endpoint is being introduced.
  - Create `apps/core/src/api/routes/prepare-avatar-traits.stack-e2e.test.ts` or an equally clear route-aligned filename
  - Cover auth enforcement (`401` no key and wrong key)
  - Cover schema validation (`400`)
  - Cover unknown scenario (`404` with correct error code)
  - Add a success-path test if the stack can produce deterministic or provider-gated prepared output
  - If the happy path depends on a real provider, follow the existing `describe.skipIf(!apiKey)` pattern instead of deleting success coverage entirely
- Add route/unit or e2e tests with a deterministic fake LLM response so the success path is always covered somewhere in CI.

# Constraints

Respect:

- current architecture
- KISS
- YAGNI
- DRY
- API-first explicit contracts
- no hidden side effects on read operations

# Deliverables

- explicit scenario preparation endpoint
- shared request/response DTO updates
- avatar API responses including `computedTraits`
- route tests and stack-e2e coverage for the new endpoint

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] A scenario-scoped explicit preparation endpoint exists.
- [ ] The endpoint is authenticated and validated at the API boundary.
- [ ] Unknown scenarios return `404` with the correct `ApiResponse` error code.
- [ ] Avatar API responses consistently include `computedTraits`.
- [ ] A stack-e2e test file exists for the new endpoint and covers auth, validation, and not-found.
- [ ] A deterministic success-path test exists in unit/e2e coverage, and a stack happy path is added when the provider setup allows it.
- [ ] `docs/PROJECT_STATUS.md` and impacted docs are reviewed or updated.

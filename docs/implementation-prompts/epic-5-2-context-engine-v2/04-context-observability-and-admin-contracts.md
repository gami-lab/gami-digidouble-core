# Title

Expose Explainable Context Observability With Stable Admin Contracts

# Context

EPIC 5.2 requires observability of final assembled context. Operators must be able to inspect what context was selected, what was trimmed, and why, without relying on internal logs.

# Scope

Implement now:

- extend existing admin/runtime context inspection payloads to include Context Engine trace metadata
- ensure context observability contracts are canonicalized in shared DTO ownership
- redact sensitive fields while preserving debugging value
- keep route/use-case serialization deterministic and bounded
- if a new context observability endpoint is introduced, add mandatory stack-e2e coverage in the same slice

Out of scope:

- console visual redesign
- unrelated admin endpoints

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Prefer extending existing inspector/session-context route contracts before adding new routes.
- If a new endpoint is necessary, create `apps/core/src/api/routes/<route-name>.stack-e2e.test.ts` and include:
  - auth enforcement (missing/wrong key -> 401)
  - schema validation (invalid payload -> 400)
  - resource-not-found behavior (unknown resource -> 404)
- Keep all non-streaming responses in the `ApiResponse<T>` envelope.
- Add explicit redaction tests for prompt-sensitive or provider-sensitive values.
- Maintain strict DTO mapping at route boundaries; avoid leaking internal engine types.

# Constraints

- Contract stability first.
- KISS, YAGNI, DRY.
- No sensitive data leakage.
- Stack-e2e requirement is non-negotiable when adding endpoints.

# Deliverables

- updated admin/shared context observability DTOs
- route/use-case updates exposing explainable context traces
- unit/e2e tests for shape and redaction
- stack-e2e tests if endpoint surface changes

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
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Assembled context observability is exposed through stable shared/admin contracts.
- [ ] Trace metadata is available and useful for debugging.
- [ ] Redaction and bounded payload rules are enforced by tests.
- [ ] New endpoint (if any) has mandatory stack-e2e coverage.
- [ ] `docs/PROJECT_STATUS.md` is updated.

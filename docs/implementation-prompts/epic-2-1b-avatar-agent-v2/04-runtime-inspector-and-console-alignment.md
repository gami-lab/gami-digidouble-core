# Title

Align Runtime Inspector and Console with Avatar v2

# Context

Avatar v2 introduces richer context composition. Operators need to inspect what context was assembled and why, without exposing sensitive prompt/provider details. Admin and console surfaces must stay contract-aligned.

# Scope

In scope:

- expose/align inspectable Avatar context trace surfaces where already supported
- update console adapters/views to consume canonical shared contracts
- ensure no sensitive leakage in inspector payloads

Out of scope:

- broad UI redesign
- unrelated admin feature additions

# Relevant Docs

- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/CONTEXT_CONTRACT_OWNERSHIP_MAP.md`
- `docs/PRINCIPLES.md`

# Implementation Guidance

- Prefer extending existing inspector routes and DTOs over creating parallel endpoints.
- Use shared contracts from `packages/shared` in console adapters.
- Include enough trace data for debugging context composition (kept/trimmed summaries, source metadata, policy markers).
- Exclude raw system prompts, provider credentials, and sensitive payloads.
- If a new endpoint is strictly required, add matching stack-e2e coverage.

# Constraints

- API envelope consistency (`ApiResponse<T>`) is mandatory.
- Preserve authentication rules for admin surfaces.
- Keep payloads bounded and stable.

# Deliverables

- Inspector/console contract alignment for Avatar v2 context trace.
- Tests for auth, shape, and no-sensitive-data leakage.
- Stack-e2e tests if and only if new endpoint(s) are introduced.

# Mandatory Stack E2E Rule

If this slice adds any new HTTP endpoint, add at least one corresponding `*.stack-e2e.test.ts` file that validates:

- auth behavior
- request validation behavior
- not-found or invalid-id behavior
- happy-path response envelope and shape

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step - Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Inspector and console share canonical Avatar v2 context trace contracts.
- [ ] Context trace is useful for operators and remains bounded.
- [ ] No sensitive prompt/provider data leaks in API or console output.
- [ ] Any new endpoint has matching `*.stack-e2e.test.ts` coverage.

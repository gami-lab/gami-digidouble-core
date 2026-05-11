# Title

Knowledge API Contracts And Mandatory Stack-E2E Coverage

# Context

EPIC 5.1 introduces operational surfaces for ingesting and inspecting knowledge data. This slice adds explicit API contracts and enforces non-negotiable stack-e2e coverage for each new endpoint.

# Scope

Implement now:

- add API endpoints for minimum EPIC operations:
  - create knowledge source
  - list/filter knowledge sources
  - trigger ingestion for a source
  - get ingestion job status/history
  - query retrieval for a given runtime context (admin/debug-safe)
- define request/response DTOs in canonical shared contract owners
- add route validation schemas and response serialization
- add stack-e2e tests for every new endpoint file

Out of scope:

- full console UX wiring
- advanced authorization model beyond Phase A API key rules

# Relevant Docs

- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/TECH_STACK.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Keep endpoint naming consistent with existing route conventions under `apps/core/src/api/routes`.
- Follow `ApiResponse<T>` envelope and project error code conventions.
- For route-level schemas, validate required fields and enum constraints (`memory|world|media`).
- Ensure unknown resource IDs return `404` with correct error envelope.
- Implement stack-e2e files named `*.stack-e2e.test.ts` in the same route folder.
- Follow existing pattern from `exchange.stack-e2e.test.ts` and other stack-e2e route tests.

Required stack-e2e minimum per new endpoint:

- auth enforcement: no API key and wrong API key both return `401`
- schema validation: invalid/missing required fields return `400`
- resource-not-found: unknown IDs return `404` with correct error code
- if happy path cannot run yet, skip with clear TODO tied to this EPIC

# Constraints

- Backward compatibility for existing endpoints.
- No local/inline DTO duplicates in routes or console clients.
- Keep handlers thin; use Application use cases.
- Do not leak sensitive payloads in admin/debug endpoints.

# Deliverables

- endpoint route files + use case wiring
- shared DTO updates
- route/e2e/stack-e2e tests
- API contract documentation updates

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

- [ ] New EPIC 5.1 endpoints are implemented with validated schemas.
- [ ] Every new endpoint has a `*.stack-e2e.test.ts` file.
- [ ] Stack-e2e tests cover auth, validation, and not-found baseline.
- [ ] API response envelopes and error codes follow existing contracts.
- [ ] API docs reflect all new endpoints and DTOs.

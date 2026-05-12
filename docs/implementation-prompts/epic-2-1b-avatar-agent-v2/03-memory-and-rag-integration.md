# Title

Integrate Memory and Typed RAG into Avatar Flow

# Context

Contracts and prompt assembly are defined, but Avatar behavior only improves if `SendMessage` reliably supplies the right context payload from memory and retrieval pipelines. This slice wires the data path end-to-end within existing architecture.

# Scope

In scope:

- integrate memory/retrieval acquisition into Avatar send-message execution
- pass typed retrieval sections (`memory`, `world`, `media`) into Avatar context
- ensure bounded selection and stable fallbacks when data is absent

Out of scope:

- introducing new retrieval algorithms
- redesigning memory persistence model
- adding net-new admin APIs unless strictly necessary

# Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`

# Implementation Guidance

- Reuse existing repositories/services for memory and typed retrieval.
- Keep orchestration in Application layer; keep persistence logic in Infrastructure.
- Ensure execution remains non-blocking where possible and preserves latency constraints.
- Record observability signals for selected context slices (counts/metadata, not sensitive content).
- Preserve deterministic ordering for selected context elements.

# Constraints

- No provider SDK calls outside LLM abstraction layer.
- No API contract breakage without explicit contract update.
- Avoid unbounded context growth.

# Deliverables

- End-to-end Avatar context enrichment path in send-message flow.
- Integration tests covering memory + typed retrieval inclusion.
- Observability hooks for context selection metadata.

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

- [ ] Send-message flow assembles Avatar v2 context from memory and typed retrieval.
- [ ] Missing memory/retrieval data does not fail request handling.
- [ ] Integration tests verify bounded context inclusion and ordering.
- [ ] Observability captures non-sensitive context selection metadata.
- [ ] Any new endpoint has matching `*.stack-e2e.test.ts` coverage.

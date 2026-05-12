# Title

Implement Avatar Prompt Assembly v2

# Context

EPIC 2.1b core value is adaptive Avatar behavior. This requires a deterministic prompt assembly path that consistently injects persona, memory, and retrieval context without bypassing architecture boundaries.

# Scope

In scope:

- implement Avatar v2 prompt assembly using canonical contracts
- inject user persona, bounded short-term memory, working memory summary, long-term memory excerpts, and typed retrieval snippets
- keep assembly deterministic and inspectable

Out of scope:

- rewriting the full Context Engine policy
- adding new retrieval stores
- changing Game Master routing rules

# Relevant Docs

- `docs/EPICS.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md`

# Implementation Guidance

- Implement in existing Avatar/domain/application prompt assembly path (no parallel ad-hoc builder).
- Respect precedence rules from existing context architecture; document explicit ordering in code-level comments where non-obvious.
- Ensure missing components degrade safely (no crashes if one memory/retrieval layer is absent).
- Keep the assembled payload bounded and deterministic for equivalent inputs.
- Emit/retain trace metadata needed by inspector surfaces without exposing raw sensitive prompts.

# Constraints

- No cross-layer shortcuts.
- No provider-specific logic in domain/application prompt assembly.
- Preserve backward compatibility for existing send-message flow.
- Avoid large refactors unrelated to Avatar v2 behavior.

# Deliverables

- Avatar v2 prompt assembly implementation.
- Updated send-message integration using canonical assembly flow.
- Unit tests proving persona/memory/retrieval influence in deterministic scenarios.

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

- [ ] Avatar replies differ appropriately when persona context changes.
- [ ] Avatar can reference recent and long-term context without transcript replay.
- [ ] Typed retrieval context is available to Avatar prompt assembly.
- [ ] Deterministic tests cover key precedence/inclusion paths.
- [ ] Any new endpoint has matching `*.stack-e2e.test.ts` coverage.

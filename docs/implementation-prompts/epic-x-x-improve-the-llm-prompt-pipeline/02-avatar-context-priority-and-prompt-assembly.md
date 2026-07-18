# Title

Reorder Avatar Context By Runtime Priority

# Context

The Avatar currently receives correct information, but too much of it competes inside one large system prompt. Static reference material, runtime instructions, user persona, memory, retrieval, and avatar-awareness data should not all have the same visual and logical weight.

This slice should improve instruction following by making Avatar prompt assembly reflect operational importance rather than the historical order in which data sources were added.

# Scope

Implement now:

- review the Avatar prompt assembly path end to end:
  - context selection
  - context projection
  - final prompt section ordering
- refine Avatar prompt assembly so it clearly distinguishes:
  - immediate runtime instructions
  - current conversation state and continuity
  - user-specific context
  - retrieved knowledge/reference material
  - persistent avatar identity/persona
- reduce duplicated or low-signal sections where the same information is currently repeated in multiple forms
- keep prompt assembly deterministic and inspectable for identical inputs

Out of scope:

- changing the GM product role
- new retrieval systems
- unbounded token-budget work outside the established Context Engine policy

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Start from the real flow already in place:
  - `apps/core/src/domain/avatar/persona-prompt.service.ts`
  - `apps/core/src/domain/context/context-engine.service.ts`
  - `apps/core/src/application/use-cases/send-message/**`
  - `apps/core/src/application/services/avatar-memory-context-assembler.service.ts`
- Make section ordering explicit and justified. If the final prompt order is non-obvious, document it with one concise comment near the assembler.
- Prefer one canonical Avatar prompt assembly path; do not introduce a second builder in parallel.
- Separate static reference content from dynamic runtime state. If a section is large and low-priority, consider moving it later or compressing it rather than repeating it.
- Preserve graceful degradation when memory or retrieval layers are absent.
- If runtime inspection surfaces expose assembled Avatar context, keep them aligned with the new section model instead of leaving old labels behind.

# Constraints

- Respect architecture boundaries.
- KISS, YAGNI, DRY.
- No provider-specific prompt branching.
- No changes to user-visible product capability beyond clearer prompt organization.
- Avoid unrelated refactors in send-message flow.

# Deliverables

- updated Avatar prompt assembly ordering and sectioning
- any minimal supporting context-projection changes needed upstream
- deterministic tests proving section precedence, omission behavior, and stable output shape
- aligned inspector/context trace labels where required

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

- `docs/ARCHITECTURE.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Avatar prompt sections reflect runtime importance more clearly than the current assembly.
- [ ] Duplicated or redundant context is reduced without losing required information.
- [ ] Assembly remains deterministic for equivalent inputs.
- [ ] Missing memory/retrieval/persona layers are handled cleanly.
- [ ] Tests cover ordering, inclusion, and omission behavior from the consumer perspective.
- [ ] `docs/PROJECT_STATUS.md` is updated.

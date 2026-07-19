# Define Structured Runtime Context Sections And Precedence

# Context

The current `ContextEngine` already performs deterministic selection and token-budget enforcement, but its output is organized around legacy fields such as `gmNotes`, `workingMemory`, `scenario`, and merged retrieval data. EPIC 8.2 needs the runtime context to express semantic responsibility and operational priority clearly before the string prompt is assembled.

The target order is:

1. Director Notes
2. Response Rules
3. Conversation State: working memory, current conversation summary, active conversation state
4. User Persona
5. World Context
6. Retrieved Context
7. Avatar Traits

# Scope

Implement now:

- define or refactor the internal structured input/output needed to represent the target runtime sections;
- update deterministic precedence and budget metadata so the order is explicit and inspectable;
- keep Avatar and Game Master projections separate;
- preserve existing short-term memory, working memory, long-term facts, typed retrieval, GM directive, and scenario behavior;
- make the distinction between world context, retrieved context, and Avatar Traits explicit in internal contracts.

Out of scope:

- changing retrieval queries, ranking, visibility filtering, chunking, or ingestion;
- generating or editing Avatar Traits;
- changing the seven-field trait schema;
- writing the final markdown prompt string;
- adding a new context-selection algorithm or scoring system.

# Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/DATA_MODEL.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`
- `apps/core/src/domain/context/context-engine.service.ts`
- `apps/core/src/domain/context/context-engine.types.ts`
- `apps/core/src/domain/context/context-engine.policy.ts`
- `apps/core/src/domain/context/session-context.types.ts`

# Implementation Guidance

- Keep `ContextEngine` framework-agnostic and deterministic. It should select and group supplied data; it should not own prompt prose or call an LLM.
- Use the existing context engine as the starting point. Extend its canonical contracts rather than creating a second assembler beside it.
- Represent only data the current runtime already has. For example, do not invent an `activeConversationState` source if the repository only has working memory and recent exchanges; map the available bounded state explicitly and document the limitation.
- Treat `gmDirective` as the internal source for Director Notes and `AvatarConfig.adjustments` as the source for Response Rules unless an existing canonical source proves otherwise.
- Keep scenario-level `worldContext` separate from Avatar Traits. Do not copy scenario facts into the trait object or merge world retrieval into static Avatar data.
- Keep retrieved knowledge typed as `memory`, `world`, and `media`, preserving visibility filtering and the existing GM unrestricted retrieval channel.
- Add an explicit `avatarTraits` segment or equivalent trace metadata only if it is needed to explain selection. Avoid adding fields that are never consumed or inspected.
- Preserve protected-segment and token-budget behavior. If the new precedence changes which segments are trimmed, add a deterministic regression test explaining the intended priority.
- Update shared inspector contracts only when the internal snapshot is exposed over an existing API. Do not add a new endpoint merely to expose the refactor.

# Constraints

Respect:

- API -> Application -> Domain -> Infrastructure boundaries;
- deterministic, bounded context assembly;
- existing visibility and observability rules;
- no raw prompt content in event or inspector traces unless an existing contract already explicitly permits it;
- no speculative context sections or trait-selection rules;
- backward compatibility for existing context consumers where possible.

# Deliverables

- canonical structured runtime context contracts for the Avatar projection;
- explicit precedence/selection metadata representing EPIC 8.2 ordering;
- updated `ContextEngine` behavior and unit tests for grouping, ordering metadata, and budget trimming;
- updated shared inspector types/mappers only where the existing runtime inspection contract requires it.

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs move together.

# Acceptance Criteria

- [ ] The internal Avatar context has a clear representation of the target semantic sections.
- [ ] Director Notes and Response Rules have higher precedence than transient and static reference context.
- [ ] Conversation state is grouped separately from permanent Avatar identity.
- [ ] World context and retrieved context remain distinct from Avatar Traits.
- [ ] Existing typed retrieval visibility rules and GM projection behavior are unchanged.
- [ ] Token-budget selection remains deterministic and its rationale remains inspectable.
- [ ] Unit tests prove the new precedence and trimming behavior.
- [ ] Documentation is reviewed or updated before the slice is considered complete.

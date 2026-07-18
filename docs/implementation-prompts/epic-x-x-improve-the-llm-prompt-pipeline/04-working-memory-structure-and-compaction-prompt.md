# Title

Improve Working Memory Structure And Compaction Output

# Context

Working memory currently provides continuity through summary, unresolved threads, and candidate facts. That baseline works, but EPIC X.X calls out a gap: some progression-relevant information is repeatedly re-inferred later instead of being represented explicitly at compaction time.

This slice should improve the structure and usefulness of working memory while keeping it bounded, inspectable, and grounded in the conversation.

# Scope

Implement now:

- review the current working-memory compaction prompt, input builder, parser, and stored structure
- refine the working-memory output so it better distinguishes:
  - what has already been discussed
  - what remains unresolved
  - which objective facts should persist
- evaluate whether an additive explicit field such as `coveredTopics` is the minimal useful representation for already-explored subjects
- update downstream consumers that rely on working-memory shape, especially GM context assembly and inspection surfaces

Out of scope:

- full memory-system redesign
- transcript archival behavior
- unrelated episodic-memory changes

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Start from:
  - `apps/core/src/application/services/memory-maintenance.service.ts`
  - `apps/core/src/domain/memory/**`
  - repositories storing conversation working memory
  - GM context assembly paths that consume working memory
  - admin memory inspection routes and shared DTOs
- Keep the change additive and bounded. If a new field such as `coveredTopics` is introduced, it should have a clear consumer and deterministic parsing/validation path.
- Do not let the compaction prompt become larger just because the output shape grows. Replace vague instructions with clearer structure where possible.
- Preserve the rule that the system does not invent facts. Any retained field must remain grounded in prior memory plus recent exchanges.
- Ensure admin/runtime inspection surfaces explain the new structure cleanly and do not expose raw prompt content.
- If persistence shape changes, update canonical domain and shared contract owners first, then repository mappings, then API surfaces.

# Constraints

- Respect current memory architecture and async maintenance flow.
- KISS, YAGNI, DRY.
- No unbounded summaries or transcript replay.
- No schema drift between stored memory, GM input context, and admin inspection DTOs.

# Deliverables

- refined working-memory prompt and parser/validator support
- updated working-memory storage and consumer contracts if needed
- deterministic tests for compaction output shape, boundedness, and downstream GM consumption
- aligned admin/inspection surfaces for the new structure

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

- `docs/DATA_MODEL.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Working memory distinguishes discussed topics, unresolved threads, and durable facts more clearly than before.
- [ ] Any added field has a clear canonical owner, parser/validator path, and downstream consumer.
- [ ] GM memory input benefits from the refined structure without schema drift.
- [ ] Tests cover bounded compaction behavior and contract-safe downstream usage.
- [ ] `docs/PROJECT_STATUS.md` is updated.

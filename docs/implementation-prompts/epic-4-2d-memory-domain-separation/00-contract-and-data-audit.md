# Establish Memory And Knowledge Contract Ownership

## Context

EPIC 4.2d changes a high-fanout term that currently means two different things. Static RAG
`memory` appears in Domain, Application, shared HTTP contracts, context snapshots, diagnostics,
admin clients, and fixtures, while true conversational memory has its own repositories and lifecycle.
Changing the literal without first locating canonical owners would create partial aliases and contract drift.

## Scope

Implement now:

- inventory every static-knowledge and conversational-memory contract, persistence field, API shape,
  prompt projection, diagnostic payload, client mirror, and test fixture affected by the separation;
- identify the canonical owner and mapping boundary for each shape;
- audit knowledge-source/chunk metadata for `userId`, `sessionId`, and `conversationId` and produce a
  repeatable, non-mutating classification report for existing static sources;
- classify legacy static `memory` sources as clearly shared Avatar knowledge, clearly shared world
  knowledge, or ambiguous/invalid user-specific material;
- consolidate duplicated types before the rename where one added union member would otherwise
  require editing multiple identical local shapes.

Out of scope:

- renaming or migrating data in this slice;
- converting documents into working, episodic, or long-term memory;
- changing retrieval ranking, embedding infrastructure, or memory compaction;
- adding operator endpoints or redesigning admin applications.

## Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/RAG_SYSTEM_IMPLEMENTATION.md`
- `docs/AVATAR_RAG_SETUP_GUIDE.md`
- `docs/CONTEXT_CONTRACT_OWNERSHIP_MAP.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`
- `packages/shared/src/knowledge-contract-types.ts`
- `packages/shared/src/memory-contract-types.ts`
- `packages/shared/src/runtime-inspector-types.ts`
- `apps/core/src/domain/knowledge/knowledge.types.ts`
- `apps/core/src/domain/memory/memory.types.ts`
- `apps/core/src/domain/context/session-context.types.ts`

## Implementation Guidance

- Trace `KnowledgeType`, `TypedRetrievalResult`, typed/recorded knowledge sections, source create/list/
  upload requests, route schemas, repository rows, event reconstruction, admin/console clients, seeds,
  and test builders. Record which type is canonical and which code must map it.
- Trace conversational memory independently: recent messages/exchanges, conversation working memory,
  episodic `ConversationMemory`, session/avatar compatibility summaries, and `UserFact` repositories.
- Treat `packages/shared/src/knowledge-contract-types.ts` as the likely HTTP owner and
  `apps/core/src/domain/knowledge/knowledge.types.ts` as the internal owner only after confirming
  their current dependency direction. Do not create another union in a route or UI.
- Inspect knowledge source and chunk `metadata` recursively enough to identify reserved scope keys.
  The report must include safe IDs, current type, visibility, offending key names, and proposed
  classification; never include source contents, vectors, user fact values, or other sensitive data.
- Define deterministic classification rules. A legacy `memory` source is not automatically valid
  Avatar knowledge merely because it lacks scope keys. Ambiguous sources remain blocked for explicit
  operator classification/removal.
- Store the audit/classification mechanism where existing repository tooling keeps one-off data
  migrations or validation scripts. It must support dry-run and be testable without production data.

## Constraints

- Respect API -> Application -> Domain -> Infrastructure.
- KISS, YAGNI, DRY; refactor only duplication that directly blocks this EPIC.
- Do not infer or manufacture user memories from static documents.
- Do not log source text, vectors, credentials, or personal values.
- Do not mutate legacy data during the audit.

## Deliverables

- a checked-in ownership/inventory artifact or focused code comments/tests that make canonical owners explicit;
- a deterministic dry-run classifier/report for legacy static `memory` and reserved-scope metadata;
- removal of blocking duplicate contract definitions;
- tests for classification categories and safe report output.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: knowledge source/chunk, `KnowledgeType`, typed retrieval,
   context snapshots, admin DTOs, working memory, episodic memory, and user facts.
2. Search for duplicated type definitions, repeated inline response shapes, local admin/console
   copies, inconsistent optionality/nullability, and field-name drift.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one before changing terminology.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required;
- `docs/CONTEXT_CONTRACT_OWNERSHIP_MAP.md` with confirmed owners and mapping boundaries;
- `docs/DATA_MODEL.md` if classification invariants need recording;
- `docs/EPICS.md` only when progress is accurately represented.

If no additional documentation changes are needed, explicitly verify that impacted docs remain
accurate. Code, tests, and docs move together.

## Acceptance Criteria

- [ ] Every affected internal and shared contract has one named canonical owner.
- [ ] No new local copy of a knowledge or memory DTO is introduced.
- [ ] Legacy sources are deterministically categorized without mutation.
- [ ] Ambiguous/user-specific documents are reported, not converted or silently relabeled.
- [ ] Report output is bounded and excludes contents, vectors, and personal values.
- [ ] Tests cover each classification and reserved-key case.
- [ ] Documentation is reviewed or updated before the slice is complete.

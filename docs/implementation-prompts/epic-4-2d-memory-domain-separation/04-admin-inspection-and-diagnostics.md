# Clarify Admin Inspection And Runtime Diagnostics

## Context

Operators must be able to tell whether an item is shared static knowledge, conversation working
memory, episodic memory, or a long-term user fact. Renaming the backend union is insufficient if
admin responses, traces, event reconstructions, and UI labels still use generic “memory” buckets.

## Scope

Implement now:

- align existing knowledge management/retrieval and memory inspection DTOs with canonical terms;
- update admin and console clients/components so static shared knowledge and each conversational
  memory layer are visually and structurally distinct;
- update runtime context/retrieval/memory diagnostics, event snapshots, presenters, and safe readers;
- display scenario ownership and Avatar visibility for static sources, and the correct user/session/
  conversation scope for memory records without conflating them;
- expose migration/quarantine status for ambiguous legacy static sources through the smallest
  existing operator surface that can own it cleanly.

Out of scope:

- a general admin redesign;
- displaying raw vectors, full sensitive source contents, or private fact values where not already authorized;
- adding arbitrary migration workflows or automatic classification buttons;
- changing runtime selection behavior established by prior slices.

## Relevant Docs

- `docs/PRINCIPLES.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/RAG_SYSTEM_IMPLEMENTATION.md`
- `docs/AVATAR_RAG_SETUP_GUIDE.md`
- `docs/CONTEXT_CONTRACT_OWNERSHIP_MAP.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/PROJECT_STATUS.md`
- `packages/shared/src/knowledge-contract-types.ts`
- `packages/shared/src/memory-contract-types.ts`
- `packages/shared/src/runtime-inspector-types.ts`
- `apps/core/src/api/routes/knowledge-retrieval.presenter.ts`
- `apps/core/src/application/services/runtime-inspector-event-context.ts`
- `apps/core/src/application/use-cases/list-session-events/`
- `apps/admin/src/scenarios/`
- `apps/console/src/components/`

## Implementation Guidance

- Reuse canonical shared DTOs in both admin clients. Do not redeclare `KnowledgeType`, typed sections,
  working memory, episodic memory, or facts in component files.
- Use explicit labels: “Shared Avatar Knowledge”, “Shared World Knowledge”, “Media Knowledge”,
  “Conversation Working Memory”, “Episodic Memory”, and “Long-Term User Facts”. Avoid an unlabeled
  generic “Memory” result category where static and personal records could be confused.
- Static source cards/results should show scenario and visibility policy. Memory inspectors should
  show the appropriate safe scope/provenance and selection reason. Never imply Avatar visibility is
  user access control.
- Update trace counters and event readers from static `memory` to `avatar_knowledge`. Preserve
  backward reading of already stored events only at the deserialization boundary if operationally
  required; normalize to the canonical output shape.
- Make quarantined/ambiguous legacy sources clearly non-ready and actionable without exposing source
  text. Prefer extending an existing knowledge-source status/list response over adding an endpoint.
- If a new endpoint is genuinely unavoidable, define its shared request/response types first and add
  a colocated `*.stack-e2e.test.ts` covering missing/wrong API keys (`401`), invalid input (`400`),
  unknown resources (`404` with correct `ApiResponse` code), and success.
- Add component tests that assert visible labels and grouping, not implementation-specific markup.

## Constraints

- Respect API -> Application -> Domain -> Infrastructure and shared DTO ownership.
- KISS, YAGNI, DRY; prefer existing operator routes and layouts.
- Preserve bounded and redacted diagnostics.
- No raw vectors, secrets, prompt bodies, or unnecessary personal values in operator output.
- Backward event compatibility must not leak the legacy term into current responses.

## Deliverables

- canonical admin retrieval and memory-inspection DTOs;
- updated presenters, event readers, traces, admin/console clients, and labels;
- visible migration/quarantine state through an existing surface where possible;
- route/presenter/component tests for structural separation and safe output;
- mandatory stack-e2e coverage only if a new HTTP endpoint is introduced.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched contracts: knowledge source/result DTOs, memory layer DTOs, context/event
   snapshots, trace payloads, migration status, and admin client view models.
2. Search for duplicated DTOs, local unions, repeated inline response shapes, inconsistent
   optionality/nullability, and legacy event readers.
3. Identify canonical owner of each contract.
4. Reuse `packages/shared` types and explicit core mappers.
5. If migration status crosses the API boundary without an owner, create one before UI work.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required;
- `docs/API_CONTRACT.md` with changed admin response shapes or any new endpoint;
- `docs/CONTEXT_CONTRACT_OWNERSHIP_MAP.md` with shared operator DTO ownership;
- `docs/MEMORY_SYSTEM_SPEC.md`, `docs/RAG_SYSTEM_IMPLEMENTATION.md`, and
  `docs/AVATAR_RAG_SETUP_GUIDE.md` with matching operator terminology;
- `docs/TEST_STRATEGY.md` if new UI/route contract coverage is added.

If no additional documentation changes are needed, explicitly verify accuracy. Code, tests, and docs
move together.

## Acceptance Criteria

- [ ] Operators can distinguish every static knowledge and conversational-memory category by structure and label.
- [ ] Static diagnostics show scenario ownership/Avatar visibility without user-memory scope.
- [ ] Memory diagnostics retain correct private scope and selection provenance.
- [ ] Current API/UI output contains no ambiguous static `memory` bucket.
- [ ] Legacy event normalization is isolated to a boundary and tested if retained.
- [ ] Ambiguous migration items are safely visible and actionable.
- [ ] New endpoints, if any, have mandatory stack-e2e coverage.
- [ ] Documentation is updated before the slice is complete.

# Prove Isolation And Complete Documentation

## Context

The EPIC is complete only when tests prove that scenario knowledge is consistently shared while
personal continuity remains isolated and lifecycle-bound. This final slice closes cross-component
gaps, validates migration behavior, runs repository-wide gates, and makes documentation the source of truth.

## Scope

Implement now:

- build a requirements-to-tests matrix for the full EPIC definition of done;
- add only missing deterministic unit, integration, API, stack, and component coverage;
- test two-user consistency for static retrieval and two-user isolation for every conversational-memory layer;
- test conversation close, Avatar switch, reset/clear, new-conversation hydration, user deletion,
  scenario deletion, ingestion, and reindex boundaries;
- test legacy migration/alias/quarantine behavior and absence of ambiguous terms in canonical outputs;
- verify prompt sections, provenance, bounds, GM bypass, async behavior, and non-contamination;
- run full quality gates and synchronize all impacted documentation.

Out of scope:

- semantic/vector search over user memory or transcripts;
- changing compaction quality or retrieval ranking;
- unrelated test cleanup, UI redesign, or infrastructure work;
- expanding Phase A beyond the EPIC definition.

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
- all implementation and tests touched by prompts `00` through `04`

## Implementation Guidance

- Build the matrix before writing tests. Reuse lower-level proof and add cross-boundary tests only
  where the invariant cannot be demonstrated locally.
- At minimum prove:
  - identical scenario/query/Avatar visibility yields the same static candidates for users A and B;
  - user A's working, episodic, and fact records never appear in user B's Avatar, GM, API, or event projections;
  - Avatar visibility restricts Avatar retrieval while explicit GM bypass sees eligible shared sources;
  - no retrieval request, trace, result, source, or chunk has user/session/conversation scoping;
  - recent exchanges remain bounded; closure creates exactly one episodic record and zero chunks;
  - Avatar switch closes/compacts and hydrates according to current memory rules without moving data into RAG;
  - reset/clear and user deletion leave shared knowledge unchanged;
  - scenario deletion removes static sources/chunks without deleting unrelated users' memory;
  - reindex changes only static corpus data and memory maintenance changes only memory data;
  - static retrieved text is not persisted as a fact unless independently supported by the
    conversation-memory extraction contract;
  - legacy `memory` inputs normalize or reject exactly as documented and canonical responses never emit them;
  - ambiguous legacy data remains quarantined/reported.
- Assert async Avatar-first behavior with deterministic fakes; do not introduce sleeps or live LLM calls.
- Update existing `knowledge.stack-e2e.test.ts` and memory/session stack tests when contracts change.
  Every endpoint newly introduced in prompts `00`-`04` must have its own colocated stack-e2e file.
- Run focused suites first, then formatting, lint, typecheck, tests, relevant PostgreSQL integration/
  stack suites, coverage, and build according to repository scripts.
- Search final docs/code/UI for ambiguous phrases. Contextual uses such as “memory subsystem” are
  valid; static knowledge examples/types labeled `memory` are not, except documented legacy input handling.

## Constraints

- Respect current architecture and canonical contract ownership.
- KISS, YAGNI, DRY.
- Tests are deterministic and provider/network-free.
- Test contracts and lifecycle behavior, not LLM prose quality.
- Do not mark the EPIC done while migration ambiguity or documentation drift remains.

## Deliverables

- requirements-to-tests matrix and complete regression coverage;
- verified cross-user isolation/consistency and lifecycle non-interference;
- passing repository quality gates or explicitly documented environment-only limitations;
- synchronized architecture, data, API, GM, memory, RAG, setup, testing, status, and EPIC docs;
- removal of stale terminology in current contracts, diagnostics, examples, and operator labels.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify all contracts changed by earlier slices, including migration status and compatibility boundaries.
2. Search for duplicate fixtures/types, repeated inline response shapes, local client copies,
   inconsistent optionality/nullability, and untested exhaustive switches.
3. Confirm the canonical owner and existing proof for each acceptance criterion.
4. Reuse existing test builders/shared types before adding fixtures.
5. Create a canonical owner first if final review finds an orphan contract.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required and must describe shipped behavior;
- `docs/EPICS.md` — mark EPIC 4.2d complete only after every acceptance criterion passes;
- `docs/ARCHITECTURE.md` — separate subsystem ownership and flows;
- `docs/DATA_MODEL.md` — scopes, cascades, canonical type values, and migration result;
- `docs/API_CONTRACT.md` — canonical request/response types, compatibility policy, and admin DTOs;
- `docs/GAME_MASTER_CONTRACT.md` — separate memory/retrieval inputs and unrestricted visibility policy;
- `docs/MEMORY_SYSTEM_SPEC.md` — complete conversational lifecycle and no-vector/no-RAG rules;
- `docs/RAG_SYSTEM_IMPLEMENTATION.md` and `docs/AVATAR_RAG_SETUP_GUIDE.md` — shared static semantics and examples;
- `docs/CONTEXT_CONTRACT_OWNERSHIP_MAP.md` — final owners and section names;
- `docs/TEST_STRATEGY.md` and `docs/TEST_COVERAGE_PLAN.md` — isolation and lifecycle boundary coverage;
- `docs/TECH_STACK.md` only if migration/deployment requirements changed.

If a listed document needs no text change, record that it was reviewed and remains accurate. Code,
tests, and docs move together.

## Acceptance Criteria

- [ ] Tests prove shared static knowledge consistency across users and private memory isolation across users.
- [ ] Tests cover close, switch, reset/clear, hydration, user deletion, scenario deletion, ingestion, and reindex boundaries.
- [ ] Prompt and context tests prove distinct bounded sections and provenance for Avatar and GM.
- [ ] No user memory is vectorized/retrieved as knowledge and no static result is serialized as memory.
- [ ] Legacy migration/alias/quarantine paths are deterministic, observable, and fully tested.
- [ ] All changed existing endpoints and every new endpoint have required route/stack coverage.
- [ ] Full quality gates pass or only genuine environment limitations are documented.
- [ ] All source-of-truth docs use unambiguous terminology and `PROJECT_STATUS` is current.
- [ ] EPIC 4.2d is marked complete only after the entire definition of done is proven.

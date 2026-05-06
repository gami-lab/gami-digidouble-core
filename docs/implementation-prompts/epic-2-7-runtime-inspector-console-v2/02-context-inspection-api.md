# Assembled Context Inspection API

## Context

EPIC 2.7 explicitly requires “assembled context inspection.” Current inspection surfaces expose GM
state, memory, runtime state, persona, and metrics, but they do not expose the actual bounded
context that the Avatar and Game Master consume.

Without this, operators still have to infer why a turn behaved a certain way. That is insufficient
once memory, persona, and later retrieval/context layers interact.

## Scope

**In scope:**

- add an admin-safe endpoint to inspect assembled context for the current session, for example:
  - `GET /v1/admin/sessions/{sessionId}/context`
- expose safe, bounded snapshots for both:
  - Avatar turn context
  - Game Master context
- reuse existing memory/context assembly paths where possible
- add route tests and a stack-e2e file for the new endpoint

**Out of scope:**

- full prompt text dumping
- provider request/response bodies
- future RAG/context-engine layers not yet implemented in Phase A
- console rendering beyond what is needed to validate the endpoint contract

## Relevant Docs

- `docs/EPICS.md` — EPIC 2.7 assembled context inspection requirement
- `docs/API_CONTRACT.md` — runtime context semantics and bounded memory contracts
- `docs/GAME_MASTER_CONTRACT.md` — `GameMasterInput.context.memory`, user persona, scenario context
- `docs/PRINCIPLES.md` — context is the product; structured control beats prompt sprawl
- `docs/TEST_STRATEGY.md` — assert what the consumer must observe, not implementation details
- `docs/PROJECT_STATUS.md` — memory v2 and persona context are already implemented

## Implementation Guidance

1. Before adding new code, read the current context assembly paths:
   - Avatar memory/context assembly
   - Game Master input construction
   - user persona retrieval
   - scenario/session lookup used in turn execution

2. The operator-facing context endpoint should expose the data that explains a turn, not an opaque
   raw prompt string. Prefer structured sections such as:
   - `avatarContext`
     - `avatarId`
     - `recentExchanges`
     - `workingMemory`
     - `longTermFacts`
     - `userPersona`
     - `gmNotes`
     - scenario metadata actually used at turn time
   - `gmContext`
     - `recentMessages`
     - `memory`
     - `currentState`
     - `availableAvatars`
     - `userPersona`
     - scenario goals/description actually used by GM

3. Keep it bounded and safe:
   - no provider credentials
   - no raw secret env values
   - no unbounded transcript replay
   - no model-specific SDK payloads
   - no raw prompt templates unless the project explicitly wants that exposure

4. If the current code only assembles these inputs transiently, choose the smallest coherent
   implementation:
   - deterministic on-demand reconstruction from the latest session/conversation state, or
   - a lightweight snapshot object persisted/emitted where reconstruction would clearly drift

5. Reuse canonical shared DTO ownership from prompt 0. Do not define the context response shape in
   the console first.

6. Tests:
   - use-case tests for omitted optional layers and bounded output
   - route tests for auth/not-found/happy path shape
   - `apps/core/src/api/routes/admin-session-context.stack-e2e.test.ts` with auth,
     validation if applicable, and not-found coverage

## Constraints

- do not bypass existing context assembly logic with a separate inspector-only code path unless
  there is no safer alternative
- no full prompt dumping for convenience
- no sensitive or provider-specific leakage
- keep output deterministic and bounded

## Deliverables

- new admin context-inspection endpoint
- canonical shared request/response DTOs
- application logic that reuses existing assembly paths cleanly
- route tests and stack-e2e coverage

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`

If no doc changes are needed, explicitly verify that the docs are still accurate.

## Acceptance Criteria

- [ ] operators can inspect safe bounded Avatar and GM context for a session
- [ ] the response explains memory, persona, and scenario inputs without raw prompt leakage
- [ ] the endpoint returns `401` on auth failure and `404` for missing sessions
- [ ] the endpoint has route tests and a matching `*.stack-e2e.test.ts` file
- [ ] `pnpm test` passes for the touched slice

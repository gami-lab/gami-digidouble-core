# 02 — Episodic Memory Persistence And Conversation Hydration

## Context

Working memory alone does not provide cross-conversation continuity. EPIC 4.2c requires durable episodic memories generated on conversation close and used to hydrate new conversations.

## Scope

Implement now:

- `conversation_memories` persistence model (user + avatar + scenario + conversation scope)
- episodic generation at conversation close (exactly one episode per closed conversation)
- retrieval API/service for episodic memories by relevance + recency
- hydration flow when creating a new conversation

Out of scope:

- semantic vector ranking or separate vector DB
- full Context Engine v2 integration beyond required hydration inputs

## Relevant Docs

- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Add explicit persistence contract for episodic memory (port + in-memory + Postgres adapters).
- Episodic payload should include bounded summary, key discoveries, unresolved topics, and extracted fact candidates.
- Keep long-term entries immutable in normal operation.
- On new conversation creation:
  - load recent episodes for same user/avatar/scenario
  - select relevant episodes deterministically
  - synthesize hydration summary
  - create initial working memory from hydration output
- Do not hydrate from raw transcripts.

## Constraints

- Preserve current response envelopes and auth model.
- No hidden background behavior without observability events/logs.
- Keep data model migration reversible and explicit.

## Deliverables

- episodic memory repository + schema updates
- close-conversation episodic generation hook
- conversation-start hydration hook
- deterministic tests for generation + hydration behavior

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
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md` (if any exposed shape changes)
- `docs/EPICS.md` status/checklist if progress markers are updated

If no doc changes are needed, explicitly verify docs are still accurate.

## Acceptance Criteria

- [ ] Conversation close creates one episodic memory entry.
- [ ] New conversation hydration uses episodic memory, not transcript replay.
- [ ] Episodic retrieval scope is user + avatar + scenario.
- [ ] Hydration behavior is deterministic and tested.
- [ ] Build gates pass and docs are synced.

# 06 — Documentation Synchronization and EPIC Closure

## Context

Prompts 01–05 have implemented and tested:

- Avatar persona domain model and `IAvatarRepository` port
- `PersonaPromptService` for persona-driven system prompt assembly
- `SendMessageUseCase` with session context, history, and message persistence
- `POST /v1/conversations/{sessionId}/messages` HTTP endpoint
- Full test coverage

Before closing EPIC 2.1, all documentation must be verified and synchronized to reflect what was actually built. Docs that no longer match the code are misleading to future agents and developers.

This is not a formality. The repository's documentation **is the source of truth**.

## Scope

**In scope:**

- Full review and update of every impacted documentation file
- Mark EPIC 2.1 as complete in `PROJECT_STATUS.md`
- Validate the `API_CONTRACT.md` section for `POST /v1/conversations/{sessionId}/messages` matches the implementation
- Validate `DATA_MODEL.md` Avatar and Message entity definitions match what was implemented
- Validate `ARCHITECTURE.md` module descriptions still accurately describe the avatar and conversation modules
- Update `TEST_STRATEGY.md` if new test patterns were introduced

**Out of scope:**

- Implementing anything — this prompt is purely review and documentation
- Starting EPIC 2.2 work

## Relevant Docs to Review

Work through each document systematically:

| Document                 | What to check                                                               |
| ------------------------ | --------------------------------------------------------------------------- |
| `docs/PROJECT_STATUS.md` | Mark EPIC 2.1 complete; add implementation summary                          |
| `docs/API_CONTRACT.md`   | Verify `/v1/conversations/{sessionId}/messages` matches implementation      |
| `docs/DATA_MODEL.md`     | Verify Avatar entity fields, Message entity fields, config JSONB note       |
| `docs/ARCHITECTURE.md`   | Verify Avatar module and Conversation module descriptions                   |
| `docs/TEST_STRATEGY.md`  | Verify mock strategy, file naming, and coverage sections are still accurate |
| `docs/EPICS.md`          | No changes needed — EPIC definitions are fixed roadmap items                |

## Implementation Guidance

### `docs/PROJECT_STATUS.md`

Add a new section under Sprint 2 for **EPIC 2.1 — Avatar Agent v1** following the same format as the EPIC 1.2 entries. Include:

- The list of what was built (domain model, prompt service, use case, endpoint)
- Key design decisions made (e.g., history limit of 20, `avatarId` required in request, `TODO` marker for GM)
- Test summary: number of tests, coverage metrics after this EPIC
- Update the Sprint 2 table: EPIC 2.1 → **Complete**

### `docs/API_CONTRACT.md`

Locate Section 2 "Send Message". Verify:

- Request body fields match implementation (`avatarId` required — note this is temporary for Sprint 2 and will be replaced by scenario-defaulted avatar in Sprint 4)
- Response shape matches `SendMessageResponse`
- Error codes listed match what the route returns (404, 409, 502, 500)

Update the section if any field, type, or behavior diverges from what was implemented.

### `docs/DATA_MODEL.md`

Verify Avatar entity definition matches the `AvatarConfig` and `Avatar` types implemented in Prompt 01:

- All fields present and correctly typed
- `personaPrompt` called out as required (not nullable)
- `config` JSONB noted as extensible

Verify Message entity:

- `role` values include `'avatar'` (not `'assistant'` — the domain uses `'avatar'`)
- `metadata` fields match `MessageMetadata` type

### `docs/ARCHITECTURE.md`

Read the Avatar module description. Confirm it accurately reflects:

- What the avatar module now contains: `avatar.types.ts`, `persona-prompt.service.ts`, fixture factory
- What the conversation module now contains: session types, message types

Correct any stale language (e.g., references to "response generation" being in the avatar module when it is actually orchestrated by the use case in the application layer).

### `docs/TEST_STRATEGY.md`

Verify the "Implemented Test Stack" and "Mock strategy" sections still accurately describe the current test patterns. If the E2E test for messages was added, confirm `messages.e2e.test.ts` follows the documented `*.e2e.test.ts` convention.

### Commit convention

When all docs are updated, commit using:

```
docs: synchronize docs after EPIC 2.1 — Avatar Agent v1

- PROJECT_STATUS: EPIC 2.1 marked complete with full implementation summary
- API_CONTRACT: POST /v1/conversations/{sessionId}/messages verified and updated
- DATA_MODEL: Avatar and Message entities aligned with implementation
- ARCHITECTURE: Avatar module description updated
- TEST_STRATEGY: confirmed accurate, no changes needed [or: updated X]
```

## Constraints

- Do not modify code in this prompt — documentation only
- If a documentation discrepancy reveals an actual implementation bug, note it but do not fix it here — open a separate fix in a follow-up commit with a `fix:` prefix
- Docs must describe what IS implemented, not what is planned — future plans belong in `EPICS.md`

## Deliverables

- Updated `docs/PROJECT_STATUS.md` — EPIC 2.1 complete, sprint table updated
- Updated `docs/API_CONTRACT.md` — Send Message endpoint verified/updated
- Updated `docs/DATA_MODEL.md` — Avatar and Message entities verified/updated
- Verified `docs/ARCHITECTURE.md` — module descriptions accurate
- Verified `docs/TEST_STRATEGY.md` — test patterns current
- Commit with `docs:` prefix

## Acceptance Criteria

- [ ] `docs/PROJECT_STATUS.md` marks EPIC 2.1 as **Complete** in the Sprint 2 table
- [ ] `docs/PROJECT_STATUS.md` includes a detailed implementation summary for EPIC 2.1
- [ ] `docs/API_CONTRACT.md` Send Message section matches what `messages.ts` actually does
- [ ] `docs/DATA_MODEL.md` Avatar entity is accurate to `avatar.types.ts`
- [ ] `docs/DATA_MODEL.md` Message entity uses `'avatar'` role (not `'assistant'`)
- [ ] `docs/ARCHITECTURE.md` Avatar module description is still accurate
- [ ] No code changes made in this prompt
- [ ] Commit message uses `docs:` prefix and references EPIC 2.1

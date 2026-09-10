# EPIC 4.2d requirements-to-tests matrix

This matrix is the release evidence for the static-knowledge and conversational-memory boundary.
It maps the definition of done to deterministic tests, API/stack tests, migration audits, and
source-of-truth documentation. PostgreSQL and stack suites remain environment-gated by their
existing repository conditions; they supplement, rather than replace, deterministic unit proof.

| Requirement                                                                                                                  | Evidence                                                                                                                                                                       | Status                                                    |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Canonical owners exist for static knowledge, conversational memory, context projections, and operator DTOs                   | `CONTEXT_CONTRACT_OWNERSHIP_MAP.md`; shared/domain contract tests and TypeScript compilation                                                                                   | Covered                                                   |
| Static retrieval is shared across users for the same scenario/query/Avatar visibility                                        | `typed-retrieval.service.test.ts` — same canonical request produces identical candidates and traces without user scope                                                         | Covered                                                   |
| Working memory, episodic memory, and user facts remain isolated by user/session/conversation scope                           | `memory-selection.service.test.ts`; `avatar-memory-context-assembler.service.test.ts`; memory repository tests                                                                 | Covered                                                   |
| Retrieval requests, traces, sources, and chunks have no user/session/conversation scope                                      | `knowledge.stack-e2e.test.ts`; typed retrieval contract tests; repository metadata validation tests                                                                            | Covered                                                   |
| Avatar visibility restricts Avatar retrieval while explicit GM bypass sees eligible shared sources only                      | `typed-retrieval.service.test.ts`; `run-game-master.typed-retrieval.use-case.test.ts`; knowledge route tests                                                                   | Covered                                                   |
| Recent exchanges and all conversational-memory layers are bounded and remain under Conversation State                        | `avatar-memory-context-assembler.service.test.ts`; context projection and prompt renderer tests                                                                                | Covered                                                   |
| Avatar and GM prompts use distinct bounded Conversation State and Retrieved Context sections with provenance                 | context-engine, Avatar prompt, and GM input renderer tests                                                                                                                     | Covered                                                   |
| Conversation close creates exactly one episodic memory and zero static knowledge rows                                        | `end-conversation.use-case.test.ts`; episodic-memory service tests; close use case has no knowledge dependency                                                                 | Covered                                                   |
| Avatar switch closes/compacts and hydrates memory without moving data into static knowledge                                  | `switch-avatar.use-case.test.ts`; episodic continuity/start-conversation tests; switch use case has no knowledge dependency                                                    | Covered                                                   |
| Reset/clear and user deletion leave shared static knowledge unchanged                                                        | `reset-session.use-case.test.ts`; user-fact deletion boundary tests; PostgreSQL source integration deletes an unrelated user row; Phase A has no whole-user deletion aggregate | Covered for implemented deletion boundaries               |
| Scenario deletion removes owned static sources/chunks without deleting unrelated user memory                                 | PostgreSQL knowledge-source integration test; `delete-scenario.use-case.test.ts`; reset/memory repository tests                                                                | Covered when PostgreSQL is available                      |
| Ingestion and reindex mutate only static corpus data; memory maintenance mutates only memory data                            | knowledge ingestion/reindex tests; memory maintenance tests                                                                                                                    | Covered locally; add cross-repository assertion if absent |
| Retrieved static text is never persisted as a fact solely because it was rendered or injected                                | memory maintenance/fact extraction tests; `send-message.use-case.test.ts` asserts maintenance input has no retrieved-context section                                           | Covered                                                   |
| Legacy `memory` input normalizes or rejects as documented and canonical output never emits it                                | knowledge source management route tests; knowledge stack contract tests                                                                                                        | Covered                                                   |
| Legacy static rows classify deterministically; ambiguous or user-scoped rows remain quarantined and reports are safe/bounded | `legacy-memory-audit.test.ts`; `legacy-memory-migration.test.ts`; quarantine presenter tests                                                                                   | Covered                                                   |
| Async GM and memory maintenance preserve Avatar-first behavior and isolate failures                                          | send-message, GM, and memory-maintenance tests                                                                                                                                 | Covered                                                   |
| Current diagnostics, event readers, admin, and console output use explicit categories and safe scopes                        | runtime inspector, session-event, `admin-session-context.test.ts`, admin/console component tests; operator DTO tests                                                           | Covered                                                   |
| All changed endpoints and every newly introduced endpoint have route/stack coverage                                          | colocated knowledge, admin, runtime, and memory route tests; stack suites                                                                                                      | Covered; stack evidence is environment-gated              |
| Documentation is synchronized and EPIC 4.2d is marked complete only after the matrix is green                                | this matrix plus the final documentation review in `PROJECT_STATUS.md`                                                                                                         | Covered after final gates                                 |

## Verification commands

Focused suites run before repository-wide gates:

```text
pnpm --filter @gami/core exec vitest run --config vitest.config.ts \
  src/application/services/knowledge/typed-retrieval.service.test.ts \
  src/application/services/memory-selection.service.test.ts \
  src/application/services/avatar-memory-context-assembler.service.test.ts \
  src/application/use-cases/end-conversation/end-conversation.use-case.test.ts \
  src/application/use-cases/switch-avatar/switch-avatar.use-case.test.ts \
  src/application/use-cases/reset-session/reset-session.use-case.test.ts
pnpm --filter @gami/core test:integration-e2e
pnpm --filter @gami/core test:stack-e2e
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Tests use deterministic fakes and fixtures. No live provider, network, source contents, vectors,
credentials, or private fact values are required for the EPIC proof.

## Gate result

On 2026-09-10, Core unit/coverage (982 tests), Admin, Console, and Web suites passed; typecheck, lint,
format-check, and build passed. Stack E2E was environment-gated because the configured app URL was
unavailable, so its tests were skipped by the existing preflight. PostgreSQL integration execution
was also unavailable in this environment; the scenario-cascade assertion remains registered in
the DB-gated suite for execution when PostgreSQL is available. The repository-wide test command
also includes unrelated conversation-evaluation viewer tests that require loopback `listen` and
fail with sandbox `EPERM`; the affected package suite is an environment limitation, not an EPIC
4.2d assertion failure.

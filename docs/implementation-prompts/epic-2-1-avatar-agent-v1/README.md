# EPIC 2.1 — Avatar Agent v1

## Objective

Build the first believable conversational entity.

An Avatar must:

- carry a named identity with a defined persona
- answer in character, using that persona to shape its system prompt
- sustain coherent multi-turn exchanges within a session
- feel distinct from a generic chatbot

This EPIC replaces the placeholder `"You are a helpful assistant."` system prompt from EPIC 1.2 with a real, persona-driven prompt assembly pipeline.

**Generated:** April 2026  
**Depends on:** EPIC 1.1, EPIC 1.2 (both complete)

---

## Prompt Files

| #   | File                                                             | Description                                                                      |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 01  | [01-persona-domain-model.md](./01-persona-domain-model.md)       | Domain model for Avatar persona: types, repository port, config shape            |
| 02  | [02-persona-prompt-assembly.md](./02-persona-prompt-assembly.md) | Domain service that turns an AvatarConfig into a runtime system prompt           |
| 03  | [03-send-message-use-case.md](./03-send-message-use-case.md)     | `SendMessageUseCase` — the real conversation use case replacing `SendRawMessage` |
| 04  | [04-api-endpoint.md](./04-api-endpoint.md)                       | `POST /v1/conversations/{sessionId}/messages` Fastify route                      |
| 05  | [05-tests-and-hardening.md](./05-tests-and-hardening.md)         | Unit + API tests, coverage gate, lint/typecheck                                  |
| 06  | [06-doc-sync.md](./06-doc-sync.md)                               | Final documentation synchronization and EPIC closure                             |

---

## Execution Order

Run in strict sequence. Each prompt builds on the previous output.

```
01 → 02 → 03 → 04 → 05 → 06
```

**01** must be done first — every subsequent prompt depends on the types and port it defines.  
**02** must precede 03 — the use case depends on the prompt assembly service.  
**03** must precede 04 — the route wires the use case.  
**05** can start once 03 is done, but final run must be after 04 is complete.  
**06** is always last — doc sync reviews completed implementation.

---

## Dependencies Between Prompts

```
01 (Avatar domain types + IAvatarRepository port)
  └─▶ 02 (PersonaPromptService — domain service)
        └─▶ 03 (SendMessageUseCase — application layer)
              ├─▶ 04 (POST /v1/conversations/:sessionId/messages route)
              └─▶ 05 (tests — unit + API)
                    └─▶ 06 (doc sync)
```

---

## Definition of Done

- [ ] `AvatarConfig` domain type enriched with all persona fields needed to generate a distinct prompt
- [ ] `IAvatarRepository` port interface defined; in-memory implementation for tests exists
- [ ] `PersonaPromptService` domain service assembles a persona system prompt from config
- [ ] `SendMessageUseCase` uses a real avatar config to build the system prompt for every turn
- [ ] `POST /v1/conversations/{sessionId}/messages` route exists and returns `SendMessageResponse`
- [ ] Avatar sustains coherent multi-turn exchanges within a session (session context passed to LLM)
- [ ] Avatar feels distinct: persona, tone, and style all flow into the LLM system prompt
- [ ] Unit tests cover prompt assembly rules and use case orchestration
- [ ] API tests verify route behavior without live LLM
- [ ] Coverage gate (≥80%) remains green
- [ ] All quality gates pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`
- [ ] `docs/PROJECT_STATUS.md` updated
- [ ] All impacted docs synchronized

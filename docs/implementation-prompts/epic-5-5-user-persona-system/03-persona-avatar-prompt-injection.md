# 03 — Persona Avatar Prompt Injection

## Context

The persona is stored (prompt 01) and retrievable via API (prompt 02). This prompt wires it
into the conversation turn: `SendMessageUseCase` loads the user's persona from the repository
and passes it into `assemblePersonaPrompt`, so that the avatar's system prompt reflects who the
user is.

## Scope

**In scope:**

- Extend `assemblePersonaPrompt` in `domain/avatar/persona-prompt.service.ts` to accept an
  optional `userPersona` in its `opts` parameter
- Emit a persona context sentence when `userPersona.role` is set
- Add `IUserRepository` as an optional dependency of `SendMessageUseCase`
- Load user persona by `session.userId` before calling `assemblePersonaPrompt`
- Graceful degradation: if `IUserRepository` is not injected or user has no record, proceed
  without persona injection
- Unit tests for the updated `assemblePersonaPrompt` and the updated `SendMessageUseCase`

**Out of scope:**

- GM persona threading (prompt 04)
- Injecting `tonePreference` or `interactionHints` beyond the basic role context sentence
  (keep minimal for Phase A; extend later in EPIC 2.1b / 5.2)

## Relevant Docs

- `docs/ARCHITECTURE.md` — domain services must not call repositories directly; the use case
  is responsible for loading and passing data down
- `docs/PRINCIPLES.md` — context is assembled from explicit inputs, never via implicit global state
- `docs/TEST_STRATEGY.md` — unit tests use mocks/stubs, never call real LLM or DB

## Implementation Guidance

### Extend `assemblePersonaPrompt`

Current signature:

```ts
export function assemblePersonaPrompt(
  config: AvatarConfig,
  opts?: { gmNotes?: string; avatarAwareness?: AvatarAwarenessItem[] },
): string
```

New signature:

```ts
export function assemblePersonaPrompt(
  config: AvatarConfig,
  opts?: {
    gmNotes?: string
    avatarAwareness?: AvatarAwarenessItem[]
    userPersona?: UserPersona
  },
): string
```

Inject persona context as a section **before** `DEFAULT_STYLE_RULE` and **after** name/tone
sections. Only emit when `userPersona.role` is a non-empty string:

```
You are speaking with someone in the role of: {userPersona.role}.
```

Keep this sentence intentionally minimal for Phase A. EPIC 2.1b / 5.2 will expand context
assembly into the full Context Engine.

`tonePreference` and `interactionHints` can also be included in Phase A if the injection
remains a single short sentence each — use judgment. Do not over-engineer.

### Extend `SendMessageUseCase`

Current constructor injects repositories for conversation, session, avatar, scenario, message,
event log, and an optional GM use case. Add:

```ts
private readonly userRepository?: IUserRepository
```

as an optional last constructor parameter (or inject via a config/options struct if the
constructor is already long — match the existing style).

Before calling `assemblePersonaPrompt`, add a load step:

```ts
const userPersona = await this.loadUserPersona(session.userId)
```

```ts
private async loadUserPersona(userId: string): Promise<UserPersona | undefined> {
  if (this.userRepository === undefined) return undefined
  try {
    const user = await this.userRepository.findById(userId)
    return user?.persona
  } catch {
    // persona load failure must never break message delivery
    return undefined
  }
}
```

Then thread `userPersona` into the `assemblePersonaPrompt` call inside the method that builds
the system prompt. Do not change the method signature of `assemblePersonaPrompt` call site in
a way that requires editing GM-related code — that is done in prompt 04.

### Server wiring

`SendMessageUseCase` is instantiated somewhere in `api/server.ts` or a factory. Pass
`serverAdapters.userRepository` as the new optional argument.

### Unit tests

#### `persona-prompt.service.test.ts` additions

Add test cases:

- `assemblePersonaPrompt` with `userPersona: { role: 'psychologist' }` → output contains
  "psychologist" (role sentence present)
- `assemblePersonaPrompt` with `userPersona: {}` (empty) → no extra persona sentence emitted
- `assemblePersonaPrompt` with no `userPersona` → behavior unchanged from current tests
- Role sentence appears before `DEFAULT_STYLE_RULE` in the assembled output

#### `send-message.use-case.test.ts` additions

Add test cases:

- When `userRepository.findById` returns a user with persona, `assemblePersonaPrompt` is called
  with that persona (spy or check assembled prompt contains role text)
- When `userRepository` is not injected (undefined), use case still succeeds
- When `userRepository.findById` throws, use case still succeeds (persona silently omitted)
- When user exists but has no persona, no extra sentence in the assembled prompt

## Constraints

- `domain/avatar/persona-prompt.service.ts` is a pure domain function — it must NOT import
  from infrastructure or call anything async. `UserPersona` is passed in; never loaded inside.
- The load step lives in `SendMessageUseCase` (application layer), not in the domain service.
- Persona injection must be **additive and safe** — it must never throw or break message delivery.
- Do not change the existing `persona-prompt.service.test.ts` test expectations; only add new cases.

## Deliverables

- `apps/core/src/domain/avatar/persona-prompt.service.ts` — updated with `userPersona` opt
- `apps/core/src/domain/avatar/persona-prompt.service.test.ts` — new persona test cases added
- `apps/core/src/application/use-cases/send-message/send-message.use-case.ts` — loads persona,
  threads into prompt assembly
- `apps/core/src/application/use-cases/send-message/send-message.use-case.test.ts` — new test
  cases for persona injection and graceful degradation
- `apps/core/src/api/server.ts` — `userRepository` threaded into `SendMessageUseCase`

## Mandatory Pre-Implementation Check

Before coding:

1. Read `persona-prompt.service.ts` in full — understand the section ordering and the
   `DEFAULT_STYLE_RULE` placement before choosing where to insert persona context.
2. Read `send-message.use-case.ts` constructor and the call site of `assemblePersonaPrompt`
   to understand exactly where the load step must go.
3. Confirm `UserPersona` type is importable from `domain/user/index.ts` (created in prompt 01).
4. Confirm the prompt assembly function is called in exactly one place within the use case.
5. Search for any existing `userPersona` references to avoid duplication.

## Mandatory Final Step — Documentation Update

After implementation:

- Verify `docs/ARCHITECTURE.md` notes about `domain/avatar/persona-prompt.service.ts` remain
  accurate.
- No API contract changes in this prompt — confirm `API_CONTRACT.md` is unchanged.
- `pnpm lint && pnpm typecheck && pnpm test` must pass.

## Acceptance Criteria

- [ ] `assemblePersonaPrompt` emits a role context sentence when `userPersona.role` is set
- [ ] Empty or absent `userPersona` produces no change in the assembled prompt
- [ ] `SendMessageUseCase` loads persona from `userRepository` before calling `assemblePersonaPrompt`
- [ ] Persona load errors are swallowed — message delivery never fails due to persona failure
- [ ] All new and existing unit tests pass
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass

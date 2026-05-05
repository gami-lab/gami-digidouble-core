# Prompt 03 — Memory Context Injection

## Context

User facts extracted in Prompt 02 must reach the avatar's system prompt. The existing
`RuntimeContext.userFacts` placeholder is already defined but not populated. This prompt
wires the `IUserMemoryFactRepository` into `SendMessageUseCase` so facts are fetched and
injected into the persona prompt at turn time.

The injection must be:

- lightweight (one DB query per turn, bounded to a fixed limit)
- optional (graceful when facts are absent or repository not injected)
- non-blocking (errors must not fail the turn)

## Scope

**In scope:**

- Fetch user facts in `SendMessageUseCase` via `IUserMemoryFactRepository`
- Pass facts into `assemblePersonaPrompt` through `RuntimeContext.userFacts`
- Verify `assemblePersonaPrompt` actually incorporates `userFacts` into the system prompt
- Unit test the injection path in `SendMessageUseCase`

**Out of scope:**

- API endpoints (Prompt 04)
- Changes to fact extraction logic (Prompt 02)

---

## Relevant Docs

- `docs/GAME_MASTER_CONTRACT.md` §4 — GM Input `context.memory.longTermFacts` shape (analogous)
- `apps/core/src/domain/context/context.types.ts` — `RuntimeContext.userFacts` type
- `apps/core/src/domain/avatar/persona-prompt.service.ts` — `assemblePersonaPrompt` — read this
  fully before modifying it
- `apps/core/src/application/use-cases/send-message/send-message.use-case.ts` — where `userPersona`
  is loaded; facts follow the same optional-dependency pattern

---

## Mandatory Pre-Implementation Check

1. Read `assemblePersonaPrompt` fully — check if `userFacts` is already consumed. If it is,
   confirm the prompt format. If not, you must add it.
2. Check `RuntimeContext.userFacts` type — it is `Record<string, string>`. The `UserFact` shape
   from the repository uses `{ key, value, category }`. Define a clear mapping: serialize as
   `{ [key]: value }` (drop category and confidence at injection time, keep it simple).
3. Read `SendMessageUseCase` dependencies — `IUserMemoryFactRepository` must be added as the
   last optional constructor parameter (do not break existing constructor call sites).
4. Search for any test files that construct `SendMessageUseCase` directly — count them and plan
   to update them if the constructor signature changes.

---

## Implementation Guidance

### Step 1 — Add `IUserMemoryFactRepository` to `SendMessageUseCase`

Add as the last optional constructor parameter:

```ts
private readonly userMemoryFactRepository?: IUserMemoryFactRepository,
```

Import the port. Do not change any other constructor parameters.

### Step 2 — Fetch Facts During a Turn

Add a private method:

```ts
private async loadUserFacts(userId: string): Promise<Record<string, string>> {
  if (this.userMemoryFactRepository === undefined) return {}
  try {
    const facts = await this.userMemoryFactRepository.findByUserId(userId)
    // Limit to most recent 10 facts to keep prompt size bounded
    return Object.fromEntries(facts.slice(0, 10).map((f) => [f.key, f.value]))
  } catch {
    // Non-blocking — never fail a turn because of memory retrieval
    return {}
  }
}
```

Call it alongside `loadUserPersona`:

```ts
const userPersona = await this.loadUserPersona(session.userId)
const userFacts = await this.loadUserFacts(session.userId)
```

### Step 3 — Pass Facts into `assemblePersonaPrompt`

`assemblePersonaPrompt` already accepts an options object. Add `userFacts` to it:

```ts
const systemPrompt = assemblePersonaPrompt(avatar, {
  ...(session.gmNotes !== undefined ? { gmNotes: session.gmNotes } : {}),
  avatarAwareness: buildAvatarAwareness(avatar, scenarioAvatars, session.unlockedAvatarIds),
  ...(userPersona !== undefined ? { userPersona } : {}),
  ...(Object.keys(userFacts).length > 0 ? { userFacts } : {}),
})
```

### Step 4 — Update `assemblePersonaPrompt` to Use `userFacts`

Read `apps/core/src/domain/avatar/persona-prompt.service.ts` first.

If `userFacts` is not yet consumed:

Add `userFacts?: Record<string, string>` to the options type accepted by `assemblePersonaPrompt`.

Append a section to the assembled system prompt when `userFacts` is non-empty:

```text
## User Context (remembered facts)
{key}: {value}
{key}: {value}
...
```

Keep it compact — no verbose introductions. One line per fact.

If `assemblePersonaPrompt` already handles `userFacts`, verify the format and skip this step.

### Step 5 — Update `ServerAdapters` and Route Wiring

In `apps/core/src/api/server.ts`, pass `userMemoryFactRepository` into `SendMessageUseCase`
construction (or into the route options where the use case is built — follow the existing
pattern for `userRepository`).

### Step 6 — Unit Tests

Extend `apps/core/src/application/use-cases/send-message/send-message.use-case.test.ts`:

| Test                                    | Expected                                                               |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `userMemoryFactRepository` not injected | turn succeeds, `userFacts` not in system prompt                        |
| repository returns 2 facts              | `assemblePersonaPrompt` called with `userFacts` having those 2 entries |
| repository throws                       | turn still succeeds (non-blocking fetch)                               |
| repository returns more than 10 facts   | only 10 used                                                           |

Also extend `apps/core/src/domain/avatar/persona-prompt.service.test.ts` (or create it if
missing):

| Test                                                 | Expected                            |
| ---------------------------------------------------- | ----------------------------------- |
| `userFacts: {}`                                      | no "User Context" section in prompt |
| `userFacts: { language: 'English', role: 'friend' }` | both facts appear in prompt         |
| `userFacts` not provided                             | no error                            |

---

## Constraints

- Fact fetch is **non-blocking** — errors must return `{}` silently, never propagate
- Facts are limited to 10 per turn to prevent prompt bloat
- `assemblePersonaPrompt` must not break existing tests — `userFacts` must be optional
- Do not change any existing constructor parameters in `SendMessageUseCase`

---

## Deliverables

- Updated `SendMessageUseCase` with optional `IUserMemoryFactRepository` parameter
- Updated `assemblePersonaPrompt` to consume `userFacts` (if not already done)
- Updated server wiring in `server.ts`
- Unit tests for fact injection path in `SendMessageUseCase`
- Unit tests for `assemblePersonaPrompt` with `userFacts`

---

## Mandatory Final Step — Documentation Update

No new API endpoints. Verify:

- `docs/DATA_MODEL.md` §4 (Session) and §10 (UserMemoryFact) accurately describe when facts
  are injected into context
- `docs/GAME_MASTER_CONTRACT.md` §4 context section notes `longTermFacts` — confirm our injection
  approach is consistent with the GM input model (they use the same domain concept)

---

## Acceptance Criteria

- [ ] `SendMessageUseCase` fetches user facts when repository is injected
- [ ] `assemblePersonaPrompt` includes a "User Context" section when facts are present
- [ ] Memory errors never fail a turn
- [ ] `pnpm typecheck` and `pnpm test` pass with zero errors

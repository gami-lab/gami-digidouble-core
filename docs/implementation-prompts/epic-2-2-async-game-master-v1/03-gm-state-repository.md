# 03 — IGmStateRepository Port and In-Memory Implementation

## Context

The Game Master maintains lightweight state across turns: current avatar, progression description,
topics covered, and interaction count. This state must be readable and writable across use case
invocations.

This prompt defines the port interface (`IGmStateRepository`) and provides an in-memory
implementation for use in tests and local flows — following the same pattern established by
`IAvatarRepository` and `ISessionRepository` in EPIC 2.1.

Persistence concerns (actual PostgreSQL implementation) are deferred to the persistence epic.

---

## Scope

**In scope:**

- `IGmStateRepository` port in `application/ports/IGmStateRepository.ts`
  - `findBySessionId(sessionId: string): Promise<GameMasterState | null>`
  - `save(sessionId: string, state: GameMasterState): Promise<void>`
- `InMemoryGmStateRepository` in `infrastructure/db/in-memory-gm-state.repository.ts`
- Unit tests for the in-memory implementation
- Wire `IGmStateRepository` into `server.ts` `ServerAdapters` (optional parameter, same pattern as other repos)

**Out of scope:**

- PostgreSQL implementation (deferred to persistence epic)
- Any use case orchestration (Prompt 04)
- Any changes to existing repositories or types

---

## Relevant Docs

- `docs/ARCHITECTURE.md` — Ports/adapters pattern; Infrastructure layer rules; replaceable infrastructure principle
- `docs/DATA_MODEL.md` — `GameMasterState` is session-scoped; one state record per session
- `apps/core/src/application/ports/IAvatarRepository.ts` — reference pattern for minimal port definition
- `apps/core/src/infrastructure/db/in-memory-avatar.repository.ts` — reference pattern for in-memory impl
- `apps/core/src/domain/game-master/game-master.types.ts` — `GameMasterState`

---

## Implementation Guidance

### Port (`application/ports/IGmStateRepository.ts`)

Minimal interface — two operations:

```ts
export interface IGmStateRepository {
  findBySessionId(sessionId: string): Promise<GameMasterState | null>
  save(sessionId: string, state: GameMasterState): Promise<void>
}
```

`findBySessionId` returns `null` when no state exists for the session (first turn — caller must
initialize from a default state).

`save` upserts: creates if absent, replaces if present.

### In-memory implementation

```ts
export class InMemoryGmStateRepository implements IGmStateRepository {
  private readonly store: Map<string, GameMasterState>

  constructor(initialData: Array<{ sessionId: string; state: GameMasterState }> = []) { ... }

  findBySessionId(sessionId: string): Promise<GameMasterState | null> { ... }
  save(sessionId: string, state: GameMasterState): Promise<void> { ... }
}
```

Store a deep copy on `save` to avoid mutation surprises in tests.

### Server wiring (`api/server.ts`)

Add `gmStateRepository?: IGmStateRepository` to `ServerAdapters`. Pass it through to the
`messagesRoute` options (same pattern as `avatarRepository`). The route will pass it to the
`TriggerGmObservationUseCase` in Prompt 04.

No default fallback needed at route level for now — the use case will construct one via
`options.gmStateRepository ?? new InMemoryGmStateRepository()`.

### Unit tests

`in-memory-gm-state.repository.test.ts`:

- `findBySessionId` returns `null` when repo is empty
- `findBySessionId` returns state for existing session
- `save` stores new state; subsequent `findBySessionId` returns it
- `save` overwrites existing state
- Stored state is a copy — mutating returned value does not affect stored value

---

## Constraints

- Port interface lives in `application/ports/` — no infrastructure imports
- In-memory implementation lives in `infrastructure/db/` — imports only the port and domain types
- No async framework dependencies — `Promise.resolve()` is fine
- TypeScript strict mode — no `any`

---

## Deliverables

- `apps/core/src/application/ports/IGmStateRepository.ts`
- `apps/core/src/infrastructure/db/in-memory-gm-state.repository.ts`
- `apps/core/src/infrastructure/db/in-memory-gm-state.repository.test.ts`
- `apps/core/src/api/server.ts` — `ServerAdapters` updated with optional `gmStateRepository`

---

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — mark Prompt 03 of EPIC 2.2 as done
- `docs/DATA_MODEL.md` — verify the `GameMasterState` description is accurate (it should be —
  no structural changes in this prompt). If implementation added fields, update accordingly.
- No other docs should need changes at this stage.

---

## Acceptance Criteria

- [ ] `IGmStateRepository` port is defined with `findBySessionId` and `save`
- [ ] `InMemoryGmStateRepository` implements the port correctly
- [ ] `findBySessionId` returns `null` for unknown session IDs
- [ ] `save` upserts (create + overwrite both work)
- [ ] Saved state is deep-copied — mutation of the returned value does not affect the store
- [ ] `ServerAdapters` in `server.ts` accepts optional `gmStateRepository`
- [ ] Unit tests cover null-return, find-existing, save-new, overwrite, and copy-safety
- [ ] `pnpm lint` and `pnpm typecheck` pass

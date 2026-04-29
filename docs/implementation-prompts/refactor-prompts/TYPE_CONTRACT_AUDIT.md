# Type Contract Audit

**Status:** Draft — April 2026  
**Scope:** Avatar, Scenario, Session, Conversation, Message, GameMaster  
**Purpose:** Identify duplicated or drifting TypeScript contracts before a consolidation refactor.  
**Action:** Do not modify implementation files until the refactor plan is executed.

---

## Executive Summary

The codebase has significant contract duplication across its four layers (domain → application → api → console).
The root cause is that each use-case and each route handler redefines inline response shapes instead of sharing
a small set of canonical output types. The most impactful issues are:

1. **`SessionSummary`** is defined 5+ times with subtly different field subsets.
2. **`ConversationSummary`** is defined 4 times identically in separate use-case files.
3. **Avatar response shapes** are repeated inline in every use-case output and every route handler.
4. **`packages/shared`** only exports the `ApiResponse` envelope — no entity types at all.
5. **The console client** (`apps/console/src/api/`) manually copies all entity types with observable drift
   (e.g. `AvatarSummary` in the console is missing `availabilityKey` and `config`).

---

## Layer Reference

| Layer                 | Path                                   |
| --------------------- | -------------------------------------- |
| Domain                | `apps/core/src/domain/`                |
| Application ports     | `apps/core/src/application/ports/`     |
| Application use-cases | `apps/core/src/application/use-cases/` |
| API routes            | `apps/core/src/api/routes/`            |
| Console client        | `apps/console/src/api/`                |
| Shared package        | `packages/shared/src/`                 |

---

## Model Audits

---

### 1. Avatar

**Risk: HIGH**

#### Where types are defined

| File                                                                         | Type(s)                                                                      |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `domain/avatar/avatar.types.ts`                                              | `AvatarStatus`, `Avatar` (persistence), `AvatarConfig` (runtime)             |
| `application/ports/IAvatarRepository.ts`                                     | `CreateAvatarParams`, `UpdateAvatarParams`                                   |
| `application/use-cases/create-avatar/create-avatar.types.ts`                 | `CreateAvatarInput`, `CreateAvatarOutput` (inline avatar shape)              |
| `application/use-cases/update-avatar/update-avatar.types.ts`                 | `UpdateAvatarInput`, `UpdateAvatarOutput` (references `AvatarConfig` — good) |
| `application/use-cases/list-scenario-avatars/list-scenario-avatars.types.ts` | `ListScenarioAvatarsOutput` (inline avatar array shape)                      |
| `application/use-cases/get-available-avatars/get-available-avatars.types.ts` | `AvatarSummary` (Pick of `AvatarConfig`)                                     |
| `api/routes/avatars.ts`                                                      | `PatchAvatarBody`, `PatchAvatarResponse` (inline avatar shape)               |
| `api/routes/scenarios.ts`                                                    | `CreateAvatarRequestBody`, `CreateAvatarResponse` (inline avatar shape)      |
| `apps/console/src/api/scenarios.ts`                                          | `AvatarSummary`, `CreateAvatarParams` (manual copies)                        |

#### Domain split: `Avatar` vs `AvatarConfig`

The domain has two parallel types for the same entity:

| Field            | `Avatar`     | `AvatarConfig`                      |
| ---------------- | ------------ | ----------------------------------- |
| Primary key      | `id: string` | `avatarId: string` (different name) |
| All other fields | identical    | identical                           |

This id-field rename is the **only** difference. `AvatarConfig` is returned by all repository methods, all
use-case outputs, and all API responses. `Avatar` (with `id`) appears to exist for alignment with the raw
database row but is not used in practice — the repository itself constructs and returns `AvatarConfig` directly.
This split adds cognitive overhead and is a source of confusion.

#### Duplicated inline shapes

`CreateAvatarOutput.avatar`, `ListScenarioAvatarsOutput.avatars[n]`, `PatchAvatarResponse.avatar`, and
`CreateAvatarResponse.avatar` in the API layer all repeat the same 11-field inline object:

```ts
{
  avatarId: string
  scenarioId: string
  name: string
  status: AvatarStatus
  personaPrompt: string
  tone?: string
  description?: string
  adjustments?: string[]
  config: Record<string, unknown>
  availabilityKey?: string
  createdAt: string
  updatedAt: string
}
```

The addition of `availabilityKey` required updating every one of these separately.

#### Console drift

`apps/console/src/api/scenarios.ts` defines its own `AvatarSummary` that is missing:

- `config: Record<string, unknown>`
- `availabilityKey?: string`

It also defines `ScenarioStatus` as the type for `avatar.status` instead of `AvatarStatus`.

#### `CreateAvatarParams` duplication

Three places define the same create-input shape:

- `application/ports/IAvatarRepository.ts` → `CreateAvatarParams`
- `application/use-cases/create-avatar/create-avatar.types.ts` → `CreateAvatarInput`
- `apps/console/src/api/scenarios.ts` → `CreateAvatarParams`

All three are structurally identical (the console version is missing `availabilityKey`).

---

### 2. Scenario

**Risk: MEDIUM**

#### Where types are defined

| File                                                             | Type(s)                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `domain/scenario/scenario.types.ts`                              | `Scenario`, `ScenarioConfig`, `ScenarioAvatarAvailabilityConfig`   |
| `application/ports/IScenarioRepository.ts`                       | `CreateScenarioParams`, `UpdateScenarioParams`                     |
| `application/use-cases/create-scenario/create-scenario.types.ts` | `CreateScenarioOutput` (inline scenario shape)                     |
| `application/use-cases/list-scenarios/list-scenarios.types.ts`   | `ListScenariosOutput` (inline scenario array shape)                |
| `application/use-cases/update-scenario/update-scenario.types.ts` | `UpdateScenarioOutput` (returns full `Scenario` — good)            |
| `api/routes/scenarios.ts`                                        | `CreateScenarioResponse`, `UpdateScenarioResponse` (inline shapes) |
| `apps/console/src/api/scenarios.ts`                              | `ScenarioSummary`, `ScenarioStatus` (manual copies)                |

#### `ScenarioStatus` not exported from domain

`AvatarStatus` is a named exported type. `Scenario['status']` is an anonymous inline union
(`'draft' | 'active' | 'archived'`). Every consumer either:

- writes the literal union inline (`ListScenariosOutput`)
- declares a local `type ScenarioStatus = 'draft' | 'active' | 'archived'` (scenarios route, console client)
- uses `Scenario['status']` as an indexed access type

This means there is no single named `ScenarioStatus` to import.

#### Scenario response shape duplication

`CreateScenarioOutput.scenario` and `UpdateScenarioResponse.scenario` (route layer) redefine the same 6-field
inline shape. `UpdateScenarioOutput.scenario` returns the full `Scenario` domain type (which includes
`ScenarioConfig`, not `Record<string, unknown>`) — this is inconsistent with what the route actually
serializes (config as opaque object).

#### Console drift

`apps/console/src/api/scenarios.ts` `ScenarioSummary` omits `config` from the list response type, even
though the API returns it.

---

### 3. Session

**Risk: HIGH**

#### Where types are defined

| File                                                             | Type                                | Fields vs domain `Session`                                                |
| ---------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------- | ------------------------ |
| `domain/conversation/session.types.ts`                           | `Session`                           | Canonical                                                                 |
| `application/use-cases/start-session/start-session.types.ts`     | `SessionSummary`                    | Pick of all 9 fields                                                      |
| `application/use-cases/get-session/get-session.types.ts`         | `SessionSummary`                    | **Identical** to start-session                                            |
| `application/use-cases/switch-avatar/switch-avatar.types.ts`     | `SessionSummary`                    | Missing `unlockedAvatarIds`                                               |
| `application/use-cases/inspect-session/inspect-session.types.ts` | `InspectSessionSummary`             | Same 9 fields as start-session `SessionSummary` but a distinct named type |
| `application/use-cases/send-message/send-message.types.ts`       | `SendMessageSessionSummary`         | Missing `endedAt`                                                         |
| `application/ports/IConversationRepository.ts`                   | `SessionSummary`                    | Missing `unlockedAvatarIds`, `gmNotes`                                    |
| `apps/console/src/api/sessions.ts`                               | `SessionSummary`                    | Adds `                                                                    | null` to optional fields |
| `api/routes/conversations.ts`                                    | _(inline in `SendMessageResponse`)_ | Missing `endedAt`                                                         |

#### Key issues

- `SessionSummary` in `start-session` and `get-session` are **byte-for-byte identical** — a textbook
  unnecessary duplication.
- `InspectSessionSummary` has the same 9 fields as the shared `SessionSummary` but is a different named type
  for no reason.
- The console `SessionSummary` uses `activeAvatarId?: string | null` while the domain uses
  `activeAvatarId?: string` — a nullability mismatch that could cause runtime issues.
- `SendMessageSessionSummary` omits `endedAt`, silently dropping data from the API response type.
- `SessionSummary` defined inside `IConversationRepository.ts` is semantically wrong — a port for
  conversations should not be defining session shapes.

---

### 4. Conversation

**Risk: HIGH**

#### Where types are defined

| File                                                                                   | Type                                | Fields                                                     |
| -------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------- | ---------------- |
| `domain/conversation/session.types.ts`                                                 | `Conversation`                      | Canonical                                                  |
| `application/use-cases/start-conversation/start-conversation.types.ts`                 | `ConversationSummary`               | Pick of 7 fields                                           |
| `application/use-cases/list-session-conversations/list-session-conversations.types.ts` | `ConversationSummary`               | **Identical** to start-conversation                        |
| `application/use-cases/get-history/get-history.types.ts`                               | `ConversationSummary`               | **Identical** to start-conversation                        |
| `application/use-cases/switch-avatar/switch-avatar.types.ts`                           | `ConversationSummary`               | **Identical** to start-conversation                        |
| `application/use-cases/send-message/send-message.types.ts`                             | _(inline Pick)_                     | Missing `startedBy`, `reason`, `handoffFromConversationId` |
| `api/routes/conversations.ts`                                                          | _(inline in `SendMessageResponse`)_ | Missing `endedAt`                                          |
| `apps/console/src/api/sessions.ts`                                                     | `ConversationSummary`               | Adds `                                                     | null`to`endedAt` |

#### Key issues

- Four use-case files each define an identical `ConversationSummary` type picking the same 7 fields.
  Any field addition requires 4 edits.
- The `send-message` inline and the route-layer inline both omit `endedAt`, meaning a closed conversation
  is not fully representable in those contexts.

---

### 5. Message

**Risk: LOW-MEDIUM**

#### Where types are defined

| File                                      | Type                                                          |
| ----------------------------------------- | ------------------------------------------------------------- |
| `domain/conversation/session.types.ts`    | `Message`, `MessageMetadata`                                  |
| `application/ports/IMessageRepository.ts` | `SaveMessageParams` (mirrors `Message`)                       |
| `apps/console/src/api/sessions.ts`        | `Message` (manual copy, identical)                            |
| `apps/console/src/api/messages.ts`        | `AvatarMessageMetadata` (subset of `MessageMetadata`, inline) |

#### Key issues

- Console `Message` is a structural copy of the domain type. Currently identical but will drift.
- `AvatarMessageMetadata` in the console omits `totalTokens`, `costUsd`, `triggerSource` from
  `MessageMetadata`, making it a subset that is not explicitly derived.
- `SaveMessageParams` in `IMessageRepository` duplicates `Message` fields minus `metadata`'s optionality.

---

### 6. GameMaster

**Risk: MEDIUM**

#### Where types are defined

| File                                                                     | Type                                                                                                  |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `domain/game-master/game-master.types.ts`                                | `GameMasterState`, `GameMasterInput`, `GameMasterOutput`, `GameMasterStateSummary`, `GameMasterEvent` |
| `application/use-cases/list-session-events/list-session-events.types.ts` | `SessionEventRecord` (re-shapes event payload inline)                                                 |
| `apps/console/src/api/sessions.ts`                                       | `GmStateSummary`, `SessionEventRecord` (manual copies)                                                |

#### Key issues

- `GameMasterStateSummary` is defined in domain but `SessionEventRecord.payload.stateBefore` / `stateAfter`
  in the console is re-declared as an inline anonymous object — missing `interactionCount`.
- `GmStateSummary` in the console adds `interactionCount` but is a copy, not an import.
- The console `SessionEventRecord` and the application `SessionEventRecord` are parallel definitions of
  the same shape; any payload field change must be made in two places.
- `GameMasterInput.context.availableAvatars[n].scope` is a raw `string` — it would benefit from a shared
  `AvatarContextEntry` named type, but this is a lower priority.

---

### 7. Admin / Inspect Session

**Risk: LOW**

#### Where types are defined

| File                                                                           | Type                                                                                         |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `application/use-cases/inspect-session/inspect-session.types.ts`               | `InspectSessionSummary`, `InspectGmState`, `InspectTransitionRecord`, `InspectSessionOutput` |
| `application/use-cases/get-avatar-transitions/get-avatar-transitions.types.ts` | `AvatarTransitionRecord` (overlaps with `InspectTransitionRecord`)                           |
| `apps/console/src/api/sessions.ts`                                             | `InspectSessionResponse`, `SessionTransitionRecord`                                          |

#### Key issues

- `InspectTransitionRecord` and `AvatarTransitionRecord` describe avatar transitions but have different
  field names (`fromAvatarId`/`toAvatarId` vs shared `fromConversationId`/`toConversationId`).
  The inspect endpoint omits `fromConversationId` / `toConversationId`.
- `InspectSessionSummary` is structurally equivalent to `SessionSummary` but is a separate named type.

---

## `packages/shared` Usage Assessment

**Current state:** Severely underused.

`packages/shared` exports only:

- `ApiResponse<T>`, `ApiError`, `ResponseMeta`, `ErrorCode`
- `ok()` / `fail()` helper functions

It contains **zero entity types**. All entity shapes live inside `apps/core/src/` and are invisible
to the console. The console has no choice but to maintain manual copies of every type it uses.

**The package is already the right architectural location for shared contracts.** It is imported by both
`apps/core` and `apps/console`. Adding entity summary types here would immediately eliminate all console
client drift without violating any layering rule.

---

## Boundary Mapping: Legitimate vs Unnecessary Duplication

| Duplication                                       | Legitimate?       | Reason                                                                        |
| ------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------- |
| Domain `Avatar` vs application `AvatarConfig`     | Questionable      | Only id naming differs; adds complexity with no real benefit at current scale |
| Application input types vs port `CreateParams`    | Mostly legitimate | Input types may diverge (validation, defaults); params are repository-scoped  |
| API route local types vs use-case output types    | **No**            | Routes should import and pass through use-case outputs, not redefine shapes   |
| Console copies of entity types                    | **No**            | These should be shared types in `packages/shared`                             |
| `ConversationSummary` defined in 4 use-case files | **No**            | One canonical export should be shared                                         |
| `SessionSummary` defined in 5 use-case files      | **No**            | Same as above                                                                 |
| `InspectSessionSummary` vs `SessionSummary`       | **No**            | Same shape, only the name differs                                             |
| `SessionSummary` in `IConversationRepository`     | **No**            | Wrong file; a conversation port should not define session shapes              |

---

## Recommended Source-of-Truth Strategy

### Recommended approach: Domain-first with a thin shared layer

**Do not go schema-first with Zod yet.** Adding Zod inference for types that already exist as clean
TypeScript interfaces introduces complexity without current benefit. Keep KISS.

**Do not collapse all types into domain types.** The application layer legitimately needs input/output
shapes that differ from persistence entities.

### Proposed ownership model

```
domain/avatar/avatar.types.ts          → AvatarStatus, Avatar, AvatarConfig
domain/scenario/scenario.types.ts      → ScenarioStatus (new export), Scenario, ScenarioConfig
domain/conversation/session.types.ts   → Session, Conversation, Message, MessageMetadata
domain/game-master/game-master.types.ts → GameMasterState, GameMasterInput, GameMasterOutput,
                                          GameMasterStateSummary, GameMasterEvent

packages/shared/src/
  ├── api-response.ts                  → (unchanged)
  └── entity-types.ts (new)           → AvatarSummary, ScenarioSummary, SessionSummary,
                                         ConversationSummary, SessionEventRecord,
                                         InspectSessionOutput (and sub-types)
```

The shared entity types in `packages/shared` are **output/read shapes** — what the API returns.
They are safe to share because:

- They flow from server to client (one direction).
- They do not carry any infrastructure dependency.
- The console imports `@gami/shared`, already.

**Input/mutation types (create, update, patch) stay in the application layer** — they are
server-internal and the console constructs them locally from user input.

---

## Prioritized Refactoring Plan

### Phase 1 — Safest, highest impact

1. **Export `ScenarioStatus`** from `domain/scenario/scenario.types.ts`.
   Replace all inline `'draft' | 'active' | 'archived'` literals for scenarios.
   _Files to update: list-scenarios.types.ts, scenarios.ts (route), console scenarios.ts_

2. **Merge `ConversationSummary` into one canonical export** in
   `application/use-cases/start-conversation/start-conversation.types.ts` (or a dedicated
   `conversation.shared.types.ts` file). Delete the 3 identical copies in get-history, list-session-conversations,
   and switch-avatar.

3. **Merge `SessionSummary`** into one canonical export shared across start-session, get-session,
   inspect-session (replacing `InspectSessionSummary`), and switch-avatar.
   Remove the orphan `SessionSummary` from `IConversationRepository.ts`.

4. **Fix `SendMessageSessionSummary` and inline `SendMessageResponse` shapes** to use the canonical
   `SessionSummary` and `ConversationSummary`.

### Phase 2 — Broader cleanup

5. **Move `AvatarSummary`, `ScenarioSummary`, `SessionSummary`, `ConversationSummary`,
   `SessionEventRecord`** to `packages/shared/src/entity-types.ts`.
   Update console client to import from `@gami/shared` instead of defining local copies.
   This eliminates all console drift in one step.

6. **Eliminate inline avatar response shapes** in use-case outputs and route handlers.
   Use `AvatarSummary` (from shared) as the canonical response shape.
   Consider whether `Avatar` (persistence) and `AvatarConfig` (runtime) can be merged into one
   domain type with a stable `avatarId` key.

7. **Replace inline `SendMessageResponse` conversation/session shapes** in `conversations.ts`
   route with imports from the canonical shared types.

8. **Align console nullability**: `activeAvatarId?: string | null` in console vs `activeAvatarId?: string`
   in domain — resolve to domain convention and update console.

### Phase 3 — Optional tooling / automation

9. **Consider a `zod` schema for API request validation** (not response types) to get runtime
   validation and static inference from one source. This is only worth doing once Phase 1+2 are
   complete and contract ownership is stable.

10. **Add a CI check** (e.g. `tsc --noEmit` across both apps) that fails if `packages/shared` types
    fall out of sync with domain types. This can be a simple structural test file that assigns
    shared types from domain values and vice versa.

---

## Acceptance Criteria for the Future Refactor

A refactor pass is complete when all of the following are true:

- [ ] `ScenarioStatus` is a named exported type from the domain layer.
- [ ] `ConversationSummary` has exactly one definition; all use-case files import it.
- [ ] `SessionSummary` has exactly one definition; all use-case files import it.
- [ ] `InspectSessionSummary` is removed; uses canonical `SessionSummary`.
- [ ] `SessionSummary` is removed from `IConversationRepository.ts`.
- [ ] `packages/shared` exports at least `AvatarSummary`, `ScenarioSummary`, `SessionSummary`,
      `ConversationSummary`, `SessionEventRecord`.
- [ ] Console client (`apps/console/src/api/`) imports entity types from `@gami/shared` only —
      no local copies of entity shapes.
- [ ] `SendMessageResponse` in the route handler uses the canonical `ConversationSummary` and
      `SessionSummary`.
- [ ] `availabilityKey` is consistently present in all avatar summary types (no drift).
- [ ] `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test` all pass green.

---

## Files Changed by the Recent `availabilityKey` Addition (Reference)

This list illustrates the blast radius of a single field addition and is the direct motivation for this audit:

```
apps/core/src/domain/avatar/avatar.types.ts
apps/core/src/application/ports/IAvatarRepository.ts
apps/core/src/application/use-cases/create-avatar/create-avatar.types.ts
apps/core/src/application/use-cases/update-avatar/update-avatar.types.ts
apps/core/src/application/use-cases/list-scenario-avatars/list-scenario-avatars.types.ts
apps/core/src/api/routes/avatars.ts
apps/core/src/api/routes/scenarios.ts
docs/DATA_MODEL.md
docs/API_CONTRACT.md
API_GUIDE.md
```

Console `AvatarSummary` was **not** updated — it is currently missing `availabilityKey`.
This is the live drift described above.

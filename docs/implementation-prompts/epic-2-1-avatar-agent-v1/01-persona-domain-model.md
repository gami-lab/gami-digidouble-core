# 01 — Avatar Persona Domain Model

## Context

EPIC 1.2 introduced `SendRawMessageUseCase`, which hard-codes the system prompt to `"You are a helpful assistant."`. This placeholder must be replaced by a real persona-driven model.

Before anything else can be built for EPIC 2.1, the domain needs a stable `AvatarConfig` type and a port (`IAvatarRepository`) that the application layer can depend on.

The existing `AvatarConfig` in `domain/avatar/avatar.types.ts` is a stub. This prompt expands it into a real domain model aligned with `DATA_MODEL.md` and `ARCHITECTURE.md`.

## Scope

**In scope:**

- Expand `AvatarConfig` domain type with all persona fields needed to generate a distinct prompt
- Define `Avatar` entity type aligned with `DATA_MODEL.md` (id, scenario_id, name, slug, status, persona_prompt, config JSONB)
- Define `IAvatarRepository` port interface in `application/ports/`
- Create an `InMemoryAvatarRepository` in `infrastructure/db/` for use in tests
- Define a fixture factory function `makeAvatarConfig()` in a shared test helpers location for use across test files

**Out of scope:**

- Actual PostgreSQL repository implementation (EPIC 3.x)
- REST endpoint for managing avatars (back-office, Sprint 5)
- Cross-scenario avatar reuse or avatar library (post-MVP)
- Voice or media references (Phase B)

## Relevant Docs

- `docs/DATA_MODEL.md` — Avatar entity definition (fields, config JSONB shape, ownership by Scenario)
- `docs/ARCHITECTURE.md` — Module structure, port interfaces, layer rules
- `docs/PRINCIPLES.md` — YAGNI, KISS, no premature abstraction
- `docs/TECH_STACK.md` — TypeScript strict mode rules

## Implementation Guidance

### `domain/avatar/avatar.types.ts`

Expand the existing stub into a full domain model. The type must capture:

- `avatarId` — opaque string ID
- `scenarioId` — owning scenario
- `name` — display name
- `slug` — machine-readable identifier
- `status` — `'draft' | 'active' | 'archived'`
- `personaPrompt` — the core system prompt string that defines character, role, and behavior; this is the most important field
- `tone` — optional tone descriptor (e.g. `"warm and curious"`, `"dry and precise"`)
- `description` — optional human-readable description of the avatar
- `config` — optional `Record<string, unknown>` for JSONB-backed extensible configuration (response constraints, UI hints, etc.)
- `createdAt` / `updatedAt` — ISO timestamps

Keep a separate `AvatarConfig` interface that represents the runtime view — what the application layer needs to assemble a prompt. This is a subset of the full Entity (no DB timestamps needed at runtime).

### `application/ports/IAvatarRepository.ts`

Define a minimal read-focused port. For EPIC 2.1, the use case only needs to load an avatar by ID. Keep it minimal:

```ts
interface IAvatarRepository {
  findById(avatarId: string): Promise<AvatarConfig | null>
}
```

Do not add `save()`, `list()`, or `delete()` — those belong to the admin/back-office layer (Sprint 5). Follow the same pattern as `ISessionRepository` and `IMessageRepository` in the same folder.

### `infrastructure/db/in-memory-avatar.repository.ts`

Implement `IAvatarRepository` backed by a `Map<string, AvatarConfig>`. Accept initial data in the constructor. This is the implementation used in all tests through EPIC 2.x.

### Test helper: `makeAvatarConfig(overrides?)`

Create a factory function that returns a valid `AvatarConfig` with sensible defaults. Place it in `src/domain/avatar/avatar.fixtures.ts` or alongside the test file using it. It should accept `Partial<AvatarConfig>` overrides for flexible use in tests.

## Constraints

- No circular imports: `domain/` must not import from `application/` or `infrastructure/`
- `IAvatarRepository` lives in `application/ports/` — not in `domain/`
- `InMemoryAvatarRepository` lives in `infrastructure/db/` — not in `domain/`
- TypeScript strict mode: no `any`, all fields explicitly typed
- The `personaPrompt` field must be `string`, not optional — an Avatar without a persona is not a valid Avatar for this EPIC
- ESLint `max-lines` ≤ 300, `max-lines-per-function` ≤ 50

## Deliverables

- Updated `src/domain/avatar/avatar.types.ts` with full `Avatar` entity and `AvatarConfig` runtime interface
- New `src/application/ports/IAvatarRepository.ts`
- New `src/infrastructure/db/in-memory-avatar.repository.ts`
- Test fixture factory `makeAvatarConfig()` usable across test files
- Unit tests for `InMemoryAvatarRepository`: `findById` returns entity, `findById` returns null for unknown ID

## Mandatory Final Step — Documentation Update

After implementation, verify:

- `docs/DATA_MODEL.md` — confirm Avatar entity definition is still aligned; update if types diverge
- `docs/PROJECT_STATUS.md` — add a note that EPIC 2.1 / Prompt 01 is in progress

## Acceptance Criteria

- [ ] `AvatarConfig` has `personaPrompt: string` (required), `tone?: string`, `description?: string`, `config?: Record<string, unknown>`
- [ ] `Avatar` entity type includes `id`, `scenarioId`, `name`, `slug`, `status`, `personaPrompt`, `tone`, `description`, `config`, `createdAt`, `updatedAt`
- [ ] `IAvatarRepository` port exported from `application/ports/IAvatarRepository.ts`
- [ ] `InMemoryAvatarRepository` implements `IAvatarRepository` using a `Map`
- [ ] `makeAvatarConfig()` factory exists and returns a valid `AvatarConfig`
- [ ] Unit tests for `InMemoryAvatarRepository` pass
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass

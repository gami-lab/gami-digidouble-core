# Title

Add Fixed Trait Schema And Avatar Persistence

# Context

EPIC 8.1 needs one fixed derived trait structure that can be stored on every avatar and exposed consistently through API read models.

The current avatar model stores free-form author input (`personaPrompt`, `description`, `tone`, `adjustments`) but has no dedicated place for derived trait data. That derived data must stay separate from author-authored text and must not be buried inside `config`.

# Scope

Implement now:

- define the fixed seven-field avatar trait schema
- add domain support for optional computed traits on avatars
- add shared HTTP contract support for `computedTraits`
- add persistence support for derived trait storage on the `avatars` table
- update in-memory and Postgres avatar repositories to read and write the new field

Out of scope:

- LLM preparation behavior
- new API endpoints
- admin UI
- runtime prompt consumption in EPIC 8.2

# Relevant Docs

- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Define one fixed schema and keep it stable:
  - `identity`
  - `personality`
  - `speakingStyle`
  - `background`
  - `timeline`
  - `currentSituation`
  - `behaviouralRules`
- Every field should be `string[]`.
- Canonical nullability rule:
  - domain/internal types may use `undefined`
  - HTTP read contracts should expose `computedTraits: AvatarComputedTraits | null`
- Prefer a dedicated trait type such as `AvatarComputedTraits` and reuse it across domain and shared contracts rather than redefining field-by-field shapes.
- Persist derived traits in a dedicated `computed_traits JSONB` column on `avatars`.
- Update both:
  - `infra/postgres/init.sql`
  - `apps/core/src/infrastructure/db/schema-alignment.ts`
    so fresh stacks and existing local volumes stay aligned.
- Do not store derived traits inside `config`.
- Keep author-authored fields unchanged. The preparation flow must regenerate traits from source data later; it does not replace the source data.
- Add a narrow repository write path for derived traits.
  - Prefer something explicit like `saveComputedTraits(avatarId, computedTraits)` or `updateComputedTraits(...)`
  - Avoid exposing `computedTraits` through generic admin mutation payloads unless the existing repository shape makes a narrow write path impossible
- Update any mapping code that materializes `AvatarSummary` so create/update/list/get responses can eventually surface `computedTraits` consistently.

# Constraints

Respect:

- current architecture
- KISS
- YAGNI
- DRY
- strict typing
- explicit nullability rules

# Deliverables

- canonical `AvatarComputedTraits` type(s)
- `avatars.computed_traits` persistence support
- repository read/write support in both in-memory and Postgres implementations
- shared avatar read contracts updated for `computedTraits`

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] One fixed `AvatarComputedTraits` schema exists and matches the EPIC 8.1 field list.
- [ ] `AvatarSummary` exposes `computedTraits: AvatarComputedTraits | null`.
- [ ] Avatar persistence stores derived traits in a dedicated field or column.
- [ ] In-memory and Postgres avatar repositories round-trip computed traits.
- [ ] Author-authored avatar fields remain unchanged.
- [ ] `docs/PROJECT_STATUS.md` and impacted docs are reviewed or updated.

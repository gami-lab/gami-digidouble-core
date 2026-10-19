# Title

Establish The Media Contract And Remove The Knowledge-Based Media Path

# Context

Media exists today in two half-shapes: a `media` knowledge format that turns a URL into one chunk
(`toMediaChunk`), and presentation `cover`/`portrait` image URLs from 12.2. Adding assets, slots,
and cues on top of both would create three ways to reference an image. This slice fixes the
contract first, with no player-visible feature yet.

# Scope

Implement now:

- shared module `packages/shared/src/media-contract-types.ts`:
  - `MediaKind` (`image` | `video`), `MediaSource` (`upload` | `url`)
  - `MediaAssetSummary` (admin projection) and `PublicMediaAsset` (player projection: id, kind,
    file URL, poster URL, duration, alt/description only)
  - `MediaRef` (asset id) used everywhere an asset is referenced
  - limits constants (description length, max upload bytes per kind, allowed MIME types)
- presentation contract: `cover` and `portrait` become `MediaRef`; add `introMedia`, `outroMedia`
  (scenario) and `idleLoop` (avatar) as `MediaRef`; public projections resolve refs to
  `PublicMediaAsset` so the player never builds file URLs itself
- remove the `media` knowledge format: `KnowledgeSourceFormat`/`KNOWLEDGE_TYPES` entries,
  `toMediaChunk`, context-engine `media` candidate type, admin/console UI for it, fixtures, tests
- keep the stored refs type-checked in Core: unknown asset ids on save → `400 VALIDATION_ERROR`
  (enforced once the repository exists in `01`; here, define the validation seam)

Out of scope:

- storage, repository, routes (prompt `01`), triggers and cues (prompts `03`, `04`)

# Relevant Docs

- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md` (static knowledge vs media)
- `docs/GAME_MASTER_CONTRACT.md` (retrieval input mentions media)
- `docs/ARCHITECTURE.md`

# Implementation Guidance

- `rg "media|mediaUri|cover|portrait" packages/shared/src apps/core/src apps/web/src apps/admin/src apps/console/src tools`
  before changing anything; list every consumer.
- Follow `presentation-contract-types.ts` conventions: exported limits, guards, `null` clears on update.
- The GM retrieval input currently names "media" as a knowledge type; update the GM input types and
  prompt renderer so the type disappears cleanly. The GM catalogue input arrives in prompt `04`.
- 12.2 player components (`StoryScreens.tsx`, `Portrait.tsx`, `CharacterCard.tsx`) switch from a
  URL string to `PublicMediaAsset`; behavior stays the same (image only) until prompt `05`.
- Tests: guards and limits, presentation round trip with refs, public projection resolves refs,
  absence of the `media` knowledge type in schemas.

# Constraints

- One owner per type; no client-side copies.
- No migration or compatibility path (database recreated per deploy).
- No new dependency.

# Deliverables

- `media-contract-types.ts` with exports
- presentation contract using `MediaRef`; player projection with resolved assets
- `media` knowledge format removed end to end
- updated tests

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (Scenario, Avatar, presentation, knowledge types, GM input).
2. Search for duplicated type definitions and inline shapes in web, admin, console, tools.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/API_CONTRACT.md` (canonical owner list, presentation fields)
- `docs/DATA_MODEL.md` (knowledge types, presentation refs)
- `docs/MEMORY_SYSTEM_SPEC.md` and `docs/GAME_MASTER_CONTRACT.md` (no `media` knowledge type)

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] One shared media contract owner exists.
- [ ] Presentation fields reference media assets, not URLs.
- [ ] The `media` knowledge format and `toMediaChunk` are gone.
- [ ] Player still renders cover and portrait from resolved projections.
- [ ] Documentation reviewed and updated.

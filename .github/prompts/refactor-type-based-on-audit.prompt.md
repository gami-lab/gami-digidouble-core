You are an expert TypeScript architect and staff engineer.

Context:
A type contract audit exists at:

docs/implementation-prompts/refactor-prompts/TYPE_CONTRACT_AUDIT.md

The audit identifies duplicated model/API contract types across the codebase, especially around Avatar. A recent `availabilityKey` addition forced updates in many places, revealing a DRY problem.

Task:
Refactor the codebase according to docs/TYPE_CONTRACT_AUDIT.md.

Primary goal:
Reduce duplicated TypeScript model contracts while preserving clean architecture boundaries and public API behavior.

Refactoring rules:

1. Start with the highest-priority model from the audit, likely Avatar.
2. Introduce a clear source of truth for shared API/domain shapes.
3. Prefer derived types over manually repeated field lists.
4. Keep boundary-specific names only when they express a real boundary difference.
5. Do not collapse all layers into one type if that would damage architecture.
6. API DTOs may exist, but they should be derived from canonical contracts where possible.
7. Console must consume shared API contract types, not backend domain or infrastructure internals.
8. Repository/persistence mapping may keep explicit mapping code, but not duplicate full public response shapes unnecessarily.
9. Avoid adding new dependencies unless the audit explicitly recommends it.
10. Keep the refactor incremental and safe.

Expected direction:

- Create or improve shared contract types in `packages/shared` if appropriate.
- Define canonical reusable shapes such as:
  - AvatarStatus
  - AvatarContract / AvatarSummary / AvatarResponse
  - CreateAvatarRequest
  - PatchAvatarRequest
  - CreateAvatarResponse
  - PatchAvatarResponse
  - ListScenarioAvatarsResponse
- Derive create/update types from canonical fields where possible.
- Apply the same pattern only to other models if the audit marks them as high-risk or easy wins.

Tests:

- Update affected tests without weakening assertions.
- Add regression coverage that proves a public avatar response contains the expected fields, including `availabilityKey` when present.
- Add at least one type-level or compile-time-oriented check if the project already has a pattern for this.
- Do not remove meaningful contract tests.

Documentation:

- Update docs/implementation-prompts/refactor-prompts/TYPE_CONTRACT_AUDIT.md with a “Refactor completed” section:
  - what changed
  - what duplication remains intentionally
  - what should be addressed later
- Update API_CONTRACT.md or DATA_MODEL.md only if the implementation contract changes or was previously outdated.

Quality gates:
Run and fix issues from:

- pnpm format:check
- pnpm lint
- pnpm typecheck
- pnpm test

Deliverable:
A small, focused refactor that reduces type duplication without changing runtime behavior.

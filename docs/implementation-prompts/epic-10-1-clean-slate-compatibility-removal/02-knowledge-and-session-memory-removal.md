# Prompt 2 — Remove Legacy Knowledge And Session-Memory Compatibility

# Context

The audit identified two independent compatibility surfaces. Static knowledge still accepts the
previous `memory` type through API normalization, migration scripts, audit logic, and quarantine
storage. Sessions also retain a `memory_summary` mirror even though current layered memory tables own
the state. A fresh content/database deployment has no need for either historical path.

# Scope

Implement now:

- make all public and internal knowledge type contracts accept only `avatar_knowledge`, `world`, and `media`;
- remove the `memory` input alias, warning/event path, normalizer, migration/audit scripts, migration
  domain modules, legacy fixtures, and quarantine repository/table support;
- extract and retain the current reserved metadata-key validation before deleting any legacy audit module;
- update API boundary validation, application mappers, admin forms, seed data, retrieval contracts,
  and tests to use canonical static knowledge types;
- remove `sessions.memory_summary` from the fresh schema direction, session entity, repository ports,
  PostgreSQL/in-memory repositories, hydration fallbacks, reset/clear flows, admin DTOs, and UI;
- read session memory only from the current layered/session-memory model;
- replace tests that seed old summaries or legacy knowledge rows with current missing-state and
  invalid-input behavior where those behaviors remain product requirements.

Out of scope:

- removing current static retrieval, visibility, embedding, or memory-compaction behavior;
- changing the ownership boundary between static knowledge and conversational memory;
- changing GM state/event compatibility, which Prompt 3 owns;
- changing Scenario/Avatar content aliases, which Prompt 4 owns;
- adding endpoints. Existing route tests must be updated in place.

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md` — EPIC 10.1 and EPIC 4.2d
- `docs/PROJECT_STATUS.md`
- `docs/LEGACY_COMPATIBILITY_AUDIT.md`

# Implementation Guidance

1. Begin with a repository-wide inventory of `memory` knowledge references and `memory_summary`
   references. Distinguish the static knowledge type from conversational memory names that are still current.
2. Preserve the current reserved metadata-key rule (`userId`, `sessionId`, `conversationId`) in a
   non-legacy validation module. Its ownership must remain at the current source/chunk validation boundary.
3. Delete the alias at the API contract boundary rather than accepting and rejecting it later in the
   domain. Invalid legacy input should receive the standard current validation error envelope.
4. Remove migration/quarantine code and its schema only after confirming no current seed or operator
   path requires it. Fresh content is the replacement; do not silently classify old rows.
5. Remove `memory_summary` from all persistence and application paths. Do not add a new fallback to
   replay transcript history unless that is already a current memory-system behavior documented in
   `MEMORY_SYSTEM_SPEC.md`.
6. Check for duplicate knowledge and memory DTOs in shared packages, Core, admin, console, and web.
   Use the canonical types from Prompt 0 and update mappers rather than weakening types.
7. Keep current retrieval provenance and memory-layer inspection behavior intact. This prompt removes
   historical compatibility, not the memory system itself.

# Constraints

- No legacy alias, migration, quarantine, mirror, or fallback may be retained for old data.
- Preserve current user/session/conversation memory isolation and static-knowledge ownership rules.
- Preserve standard `ApiResponse<T>` error envelopes and API-boundary validation.
- Keep domain code independent of PostgreSQL and UI concerns.
- Do not delete reserved-key validation, current memory maintenance, or current retrieval visibility.
- No new HTTP endpoint is expected; if one is added, include the mandatory colocated stack-E2E file.

# Deliverables

- Strict canonical knowledge type contracts and updated API/admin/seed consumers.
- Removal of legacy knowledge alias, warning, migration, audit, quarantine, and legacy fixtures.
- Reserved metadata-key validation retained under a current owner.
- Removal of `memory_summary` schema/entity/port/repository/use-case/admin/UI paths.
- Updated unit, integration, and API tests for canonical inputs and current missing-memory behavior.
- Repository-wide search evidence showing no unintended production references remain.

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: `KnowledgeType`, source/chunk metadata, retrieval DTOs,
   Session, session-memory layers, admin memory DTOs, and API request/response envelopes.
2. Search for duplicate type definitions, copied knowledge unions, local memory-summary shapes, and
   inconsistent `null`/`undefined` handling.
3. Identify the canonical owner of static knowledge contracts and conversational-memory contracts.
4. Reuse shared types and explicit boundary mappers where they already exist.
5. If reserved-key validation has no independent canonical owner, create the smallest current validation
   module before deleting legacy audit code.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` (always required);
- `docs/DATA_MODEL.md` for removed quarantine and session-summary persistence;
- `docs/API_CONTRACT.md` for strict knowledge inputs and current memory inspection behavior;
- `docs/MEMORY_SYSTEM_SPEC.md` for canonical session-memory ownership;
- `docs/ARCHITECTURE.md` if module ownership changed;
- `docs/TEST_STRATEGY.md` if legacy migration tests are removed or test tiers change;
- `docs/EPICS.md` and any knowledge/RAG setup guides.

If no additional documentation changes are needed, explicitly verify that the docs remain accurate.
Code, tests, and docs move together.

# Acceptance Criteria

- [ ] `memory` is rejected at the API boundary and is absent from current shared/internal type unions.
- [ ] Legacy knowledge migration, audit, quarantine, warning, and fixture code is removed.
- [ ] Reserved metadata-key validation still runs through a current non-legacy owner.
- [ ] `memory_summary` is absent from schema, entities, ports, repositories, fallbacks, admin DTOs, and UI.
- [ ] Current session memory reloads from canonical layered memory only.
- [ ] API, unit, integration, and relevant UI tests pass with canonical content.
- [ ] Static knowledge and conversational memory remain isolated as documented.
- [ ] Documentation explicitly reflects the strict clean-content contract.

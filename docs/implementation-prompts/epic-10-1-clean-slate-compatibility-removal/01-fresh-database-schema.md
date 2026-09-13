# Prompt 1 — Replace Legacy Database Alignment With A Fresh Canonical Schema

# Context

The audit found runtime database alignment on every startup, duplicated compatibility DDL in
`infra/postgres/init.sql`, preservation of old Game Master columns, and cleanup branches for old
vectors and knowledge rows. A guaranteed fresh redeploy makes those paths unnecessary and harmful:
they keep historical schema decisions executable and obscure the actual current data model.

# Scope

Implement now:

- derive the canonical schema from current repositories, domain contracts, and `docs/DATA_MODEL.md`;
- make `infra/postgres/init.sql` the authoritative fresh-database bootstrap;
- remove the startup `alignPostgresSchema` call and compatibility-only schema-alignment module;
- remove old-volume preservation, old-column cleanup, old vector nulling, and obsolete GM column
  handling from bootstrap SQL;
- remove schema support for `gm_states.current_avatar_id` and `topics_covered` when they are not part
  of the current contract;
- keep current tables, constraints, indexes, vector profile/dimension integrity, and operational
  initialization required by the current runtime;
- update database/container startup wiring and fresh-deployment instructions so a new volume is
  explicitly required;
- update repository integration tests and fixtures to assert the current schema rather than ignored
  legacy columns.

Do not remove in this prompt:

- the knowledge `memory` alias migration/quarantine surface, which Prompt 2 owns;
- `sessions.memory_summary` application behavior, which Prompt 2 owns;
- current data-integrity validation, retry/cancellation behavior, or operational health checks;
- unrelated schema cleanup or speculative normalization.

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md` — EPIC 10.1
- `docs/PROJECT_STATUS.md`
- `docs/LEGACY_COMPATIBILITY_AUDIT.md`
- deployment/container documentation under `infra/` and `docs/`

# Implementation Guidance

1. Inspect all SQL bootstrap, schema-alignment, repository, and Docker startup paths before editing.
   Establish which current tables and columns are required by live repositories and tests.
2. Treat the empty database as the only supported starting state. Do not write a new migration path
   for old volumes and do not preserve old columns “just in case.”
3. Remove the application startup dependency on schema alignment and delete the module when no current
   caller remains. Remove imports and tests made obsolete by that deletion.
4. Keep the bootstrap deterministic and explicit. If rerunning `init.sql` safely is a current
   operational requirement, retain only idempotency needed for the current schema, not historical
   column/table detection.
5. Coordinate the final schema with the contract owner from Prompt 0. Do not leave a column because a
   repository can ignore it; remove it from the fresh schema and current repository row types.
6. Update fresh-stack tests or add a focused schema verification test using the project’s existing
   integration conventions. Do not add an HTTP endpoint for schema verification.
7. Verify the deployment procedure against a new database volume. Do not destroy an existing user
   volume during development unless the operator explicitly chooses that destructive action.

# Constraints

- The database remains PostgreSQL + pgvector; do not add a migration framework or a second datastore.
- Preserve current transaction, indexing, vector, and referential-integrity semantics.
- This EPIC intentionally abandons old database volumes; no backward-compatible read or rewrite path may remain.
- Keep application/domain code free of SQL concerns.
- Do not modify knowledge alias or session-memory business logic outside the explicitly isolated schema references.
- No new HTTP endpoint is expected; if one is added, its slice must add the required stack-E2E contract test.

# Deliverables

- Canonical fresh-database bootstrap SQL.
- Removal of startup schema alignment and compatibility-only alignment code.
- Current repository/schema tests and updated fixtures.
- Updated fresh-volume deployment documentation and operational checks.
- A search result or test evidence showing obsolete schema identifiers are no longer active current schema.

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: database tables for GM state, knowledge sources/quarantine,
   sessions/memory, vectors, and every repository row mapper that reads them.
2. Search for duplicated schema definitions, inline row shapes, and SQL column names copied across
   bootstrap, repositories, tests, and admin projections.
3. Identify the canonical owner of each persisted contract: `docs/DATA_MODEL.md` plus the domain/repository boundary.
4. Reuse existing shared/domain types where possible; do not create a second schema model.
5. If no canonical owner exists for a current table/column, define it before deleting compatibility DDL.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` (always required);
- `docs/DATA_MODEL.md` for removed tables/columns and the fresh-schema contract;
- `docs/ARCHITECTURE.md` if schema-alignment ownership or startup flow changed;
- `docs/TECH_STACK.md` and deployment docs for the fresh-volume procedure;
- `docs/TEST_STRATEGY.md` if schema verification tiers changed;
- `docs/EPICS.md` if EPIC progress wording is stale.

If no additional documentation changes are needed, explicitly verify that each remains accurate. Code,
tests, and docs move together.

# Acceptance Criteria

- [ ] Empty PostgreSQL + pgvector initialization succeeds with the canonical current schema.
- [ ] Application startup no longer calls schema alignment.
- [ ] Compatibility-only alignment code and obsolete GM schema columns are deleted.
- [ ] Current repositories and row mappers no longer depend on removed columns.
- [ ] Existing schema/integration tests are updated to assert current behavior, not ignored legacy data.
- [ ] Fresh-volume deployment instructions are explicit and verified.
- [ ] No old-volume migration or preservation path is introduced.
- [ ] `docs/PROJECT_STATUS.md`, data-model, architecture, stack, and deployment docs are accurate.

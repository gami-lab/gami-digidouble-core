# Knowledge Sources: Text/PDF/TXT Ingestion and Visibility Rules

## Context

Scenario Builder must let operators manage knowledge without code changes. Knowledge can be avatar memory or world knowledge and must support visibility targeting (single avatar, subset, all avatars, or GM-only where applicable).

## Scope

In scope:

- admin flows for creating/updating knowledge sources from pasted text and PDF/TXT upload
- assignment of source type (avatar memory vs world)
- visibility policy editor:
  - one avatar
  - subset of avatars
  - all avatars
  - none for avatars (GM-only world visibility)
- persistence and retrieval contract updates required to represent these policies

Out of scope:

- non-text document formats beyond PDF/TXT
- retrieval quality tuning beyond contract-safe plumbing

## Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Reuse existing ingestion pipeline modules where possible; avoid parallel ingestion stacks for admin uploads.
- Keep source typing and visibility explicit in domain and API contracts.
- Validate file type and size at API boundary.
- Ensure GM-only world visibility is represented explicitly (not inferred by omission).
- Ensure visibility updates are idempotent and safe for partial edits.
- Keep seed-script parity in mind: admin-created records should be equivalent to seeded records.

For each new endpoint introduced, add:

- route-level integration tests
- domain/application unit tests
- stack-e2e file in `apps/core/src/api/routes/<route-name>.stack-e2e.test.ts`

Required stack-e2e minimum coverage:

- `401` missing/wrong API key
- `400` invalid body/file metadata
- `404` unknown resource identifier with correct `ApiResponse` error code

If success-path seeding prerequisites are missing, keep a skipped happy-path test with a clear `TODO(EPIC-6.1)` note.

## Constraints

Respect:

- architecture boundaries
- KISS, YAGNI, DRY
- deterministic validation rules
- backward compatibility where relevant

## Deliverables

- admin knowledge source editor for text + PDF/TXT inputs
- visibility policy controls (avatar subset/all/GM-only world)
- backend support for source typing + visibility persistence
- required test coverage including stack-e2e for new endpoints

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/MEMORY_SYSTEM_SPEC.md` (if memory/visibility semantics changed)

If no doc changes are needed, explicitly confirm docs remain accurate.

## Acceptance Criteria

- [ ] admin can create/update knowledge via text and PDF/TXT
- [ ] source type and visibility are editable and persisted correctly
- [ ] GM-only world visibility is explicitly represented and enforced
- [ ] new endpoints include required stack-e2e coverage
- [ ] required documentation review/update completed

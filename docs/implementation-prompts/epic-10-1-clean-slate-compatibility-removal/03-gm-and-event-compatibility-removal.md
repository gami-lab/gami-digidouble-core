# Prompt 3 — Remove Pre-Current GM State, Output, And Event Compatibility

# Context

The audit found runtime normalization of pre-8.5 Game Master state, obsolete GM fields retained for
schema/API compatibility, parser defaults for fields the current contract declares required, and
legacy flattened event readers. A fresh database has no historical GM state or event rows, so current
repositories and inspection surfaces can be strict.

# Scope

Implement now:

- remove pre-current GM state migration/normalization and its tests;
- make persisted GM state deserialize only the current `GameMasterOrchestrationState` shape;
- remove obsolete state fields and old schema references not present in the current GM contract;
- make the GM output parser require every field marked required in `docs/GAME_MASTER_CONTRACT.md`,
  including `retrievalPlan` and `progressionUpdate` where the current contract requires them;
- remove parser defaults that exist only to accept older model output;
- make session-event inspection parse only the current structured `sections` payload shape;
- remove flattened Avatar/GM context readers and compatibility-only retrieval ranking/scope aliases;
- choose one canonical current retrieval ranking field from the current retrieval contract and remove
  unchosen `score`/`distance`/`similarity` compatibility projections;
- remove console/admin labels and presentation logic that describe legacy scope-match behavior;
- update current GM prompts, schemas, serializers, repositories, and tests together.

Out of scope:

- changing the current asynchronous GM lifecycle or routing/progression semantics;
- changing memory ownership or static retrieval ownership beyond removing old GM projections;
- changing Avatar/Scenario content aliases, which Prompt 4 owns;
- adding endpoints. Existing event/inspection routes retain their current contracts unless strict
  validation requires a documented error-shape correction.

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md` — EPIC 10.1 and EPIC 8.5
- `docs/PROJECT_STATUS.md`
- `docs/LEGACY_COMPATIBILITY_AUDIT.md`

# Implementation Guidance

1. Inventory current GM state, output, event, retrieval, and console contracts before removing
   fields. Compare shared DTOs, domain types, repository JSON, event mappers, route serializers, and
   UI projections for duplicate or drifted shapes.
2. Use the current GM contract as the source of truth. Do not preserve an older payload by making all
   fields optional or by adding a second parser.
3. Replace migration normalization with strict parsing/validation of the current persisted shape. Keep
   safe handling of malformed current JSON and bounded diagnostics; those are data-integrity behavior,
   not legacy support.
4. Update the GM prompt/schema and parser in one slice. Required fields must be required in the
   runtime contract, test fixtures, and prompt instructions.
5. Simplify event readers to the current structured payload. If old event rows are encountered in a
   fresh deployment, fail or report them as invalid current data rather than reconstructing them.
6. Select the retrieval ranking field by tracing the current retrieval service, shared DTO, recorded
   event, and console owner. Remove the other names everywhere instead of preserving a compatibility
   projection.
7. Preserve async/non-blocking GM execution, current routing guards, event redaction, and observability.

# Constraints

- The GM remains asynchronous and must not delay the Avatar response.
- Do not add a migration path, dual parser, fallback payload shape, or legacy field alias.
- Preserve current standard API envelopes, validation errors, safe diagnostics, and redaction rules.
- Keep domain contracts independent from API/UI and persistence representations.
- No new HTTP endpoint is expected; any new endpoint must include its required stack-E2E contract test.

# Deliverables

- Strict current GM state repository path with migration module removed.
- Current-only GM output parser, prompt/schema, and fixtures.
- Current-only event inspection parser and retrieval projection.
- Removed compatibility-only fields, readers, UI labels, and tests.
- Regression coverage for required output fields, invalid current payloads, current event rendering,
  async behavior, and safe failure diagnostics.

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: GM state, `GameMasterOutput`, orchestration guidance,
   recorded GM events, session event DTOs, retrieval result DTOs, and console trace projections.
2. Search for duplicate definitions, inline JSON shapes, old field spellings, and optionality drift
   across shared, domain, repository, API, admin, console, and tests.
3. Identify the canonical owner of GM contracts and current event/retrieval projections.
4. Reuse canonical shared/domain types and existing boundary mappers where possible.
5. If a current GM/event contract has no canonical owner, define it before deleting the migration reader.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` (always required);
- `docs/GAME_MASTER_CONTRACT.md` for strict required fields and removed compatibility wording;
- `docs/API_CONTRACT.md` for event/inspection DTO changes;
- `docs/DATA_MODEL.md` for GM state column/payload changes;
- `docs/ARCHITECTURE.md` if GM/event ownership changed;
- `docs/TEST_STRATEGY.md` for removed migration/legacy fixtures and current failure tests;
- `docs/EPICS.md` and runtime-inspector documentation.

If no additional documentation changes are needed, explicitly verify that all GM/event docs remain
accurate. Code, tests, and docs move together.

# Acceptance Criteria

- [ ] Pre-current GM state is not normalized or accepted.
- [ ] Current GM state has no obsolete compatibility fields or schema columns.
- [ ] Current GM output parser requires all required current fields and rejects missing legacy-shaped output.
- [ ] Event inspection accepts only current structured sections.
- [ ] One current retrieval ranking field is used consistently; legacy aliases are gone.
- [ ] Console/admin legacy scope-match labels and projections are removed.
- [ ] Async GM behavior, routing safeguards, redaction, and observability remain intact.
- [ ] Focused unit, integration, and E2E tests pass.
- [ ] GM, API, data-model, architecture, test, project-status, and EPIC docs are synchronized.

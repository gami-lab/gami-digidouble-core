# Prompt 5 — Complete Hardening, Fresh Deployment Verification, And Documentation Sync

# Context

The preceding prompts remove compatibility paths in separate vertical slices. The final slice must
prove that no compatibility residue remains, that current contracts are coherent across packages,
and that the product can be deployed from an empty database with fresh content. Documentation is a
release artifact and must be synchronized before EPIC 10.1 can be marked complete.

# Scope

Implement now:

- run a repository-wide search for every audit identifier and compatibility module/name, including
  aliases, migration readers, old schema columns, old DTO fields, warning strings, UI labels, and tests;
- classify every remaining match as current behavior, test-only fixture that should be removed, or
  an intentional non-legacy fallback documented in the EPIC;
- remove accidental residue and compatibility-only tests, scripts, fixtures, imports, and comments;
- add or strengthen deterministic tests for strict current contracts, malformed-current-data handling,
  fresh schema initialization, fresh seed/content validation, and runtime failure isolation;
- run the project’s applicable typecheck, lint, unit, integration, E2E, and stack-E2E tiers;
- verify a clean deployment from a new database volume and fresh content/seed run, without relying on
  an old volume or legacy input;
- verify no new endpoint was introduced without its colocated stack-E2E coverage;
- synchronize all source-of-truth documentation and mark EPIC 10.1 complete only when every criterion passes.

Out of scope:

- adding new product features;
- restoring compatibility to make historical fixtures pass;
- deleting normal resilience/error-handling fallbacks that are not legacy support;
- broad refactors unrelated to EPIC 10.1.

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
- `docs/EPICS.md` — EPIC 10.1
- `docs/PROJECT_STATUS.md`
- `docs/LEGACY_COMPATIBILITY_AUDIT.md`

# Implementation Guidance

1. Use the audit acceptance identifiers as a blocking checklist. Search both exact names and semantic
   variants; include `rg` searches in source, tests, scripts, SQL, docs, and UI.
2. Review the complete diff for accidental contract duplication or newly optional fields. The final
   code must have one owner per current contract and no compatibility adapter hidden behind a generic helper.
3. Treat failures in fresh deployment as implementation defects unless they are documented environment
   limitations already accepted by the repository’s test strategy. Do not skip a test merely because
   a legacy fixture no longer works; rewrite or delete that fixture.
4. Run tests according to `docs/TEST_STRATEGY.md`: deterministic unit tests first, infrastructure
   integration tests where required, in-process E2E, and live stack-E2E checks when the environment is available.
5. Confirm any stack-E2E files required by changed endpoints. This EPIC should not add endpoints; if
   one appeared during implementation, add auth (`401`), validation (`400`), not-found (`404`), and
   success/deferred-success coverage in the same route directory.
6. Update the clean redeploy procedure with explicit fresh-volume and fresh-content prerequisites,
   current seed ordering, verification commands, and the fact that old volumes are unsupported.
7. Only after all checks pass, update status/roadmap wording to show EPIC 10.1 complete. Do not claim
   completion from static search alone.

# Constraints

- The final runtime must remain within the four-layer architecture and current technology stack.
- “All backward compatibility” means all audited old-contract support; it does not mean deleting
  normal error handling, retries, cancellation, localization, or current additive features.
- Do not introduce a replacement migration path, alias, dual parser, or compatibility test fixture.
- Keep tests deterministic unless the test strategy explicitly requires real infrastructure.
- Do not weaken assertions to accommodate old behavior.
- No endpoint additions are expected; any exception requires the full stack-E2E rule.

# Deliverables

- Final compatibility-residue audit output and cleaned repository.
- Updated/deleted tests, fixtures, scripts, imports, and documentation.
- Passing verification results for the supported test tiers.
- Verified fresh database + fresh content deployment path.
- Updated `docs/PROJECT_STATUS.md`, `docs/EPICS.md`, and all impacted source-of-truth documents.
- EPIC 10.1 marked complete only with evidence for every definition-of-done item.

# Mandatory Pre-Implementation Check

Before coding:

1. Identify all touched entities/contracts and compare their final definitions across shared, domain,
   application, infrastructure, API, admin, console, web, SQL, and tests.
2. Search for duplicated type definitions, inline response shapes, copied field unions, and optionality drift.
3. Identify the canonical owner of each remaining contract and verify all consumers use it.
4. Reuse canonical types; do not add a final “temporary” type or helper.
5. If a remaining match is ambiguous, classify it from the source-of-truth docs before removing it;
   preserve only behavior explicitly identified as current resilience or operational behavior.

# Mandatory Final Step — Documentation Update

After implementation, review and update all of the following as applicable:

- `docs/PROJECT_STATUS.md` (always required);
- `docs/EPICS.md` — mark EPIC 10.1 complete only after all acceptance criteria pass;
- `docs/ARCHITECTURE.md`;
- `docs/TECH_STACK.md`;
- `docs/DATA_MODEL.md`;
- `docs/API_CONTRACT.md`;
- `docs/GAME_MASTER_CONTRACT.md`;
- `docs/MEMORY_SYSTEM_SPEC.md`;
- `docs/TEST_STRATEGY.md`;
- deployment, seed, RAG, scenario-builder, voice, runtime-inspector, and other impacted guides;
- `docs/LEGACY_COMPATIBILITY_AUDIT.md` if its status or findings need closure notes.

If no doc changes are needed for any listed file, explicitly verify that it remains accurate. Code,
tests, and docs move together; implementation is incomplete until this review is done.

# Acceptance Criteria

- [ ] Repository-wide audit finds no unintended legacy identifiers, aliases, migration readers, compatibility modules, or old-contract fixtures.
- [ ] No duplicated current entity/DTO contract was introduced.
- [ ] Fresh schema initialization and fresh content seeding succeed without old data or aliases.
- [ ] Current malformed-data and failure-isolation behavior remains safe and observable.
- [ ] Typecheck and lint pass.
- [ ] Unit, integration, E2E, and applicable stack-E2E suites pass under the documented test strategy.
- [ ] Any changed/new HTTP endpoint has the required stack-E2E auth, validation, not-found, and success/deferred-success coverage.
- [ ] Clean redeploy procedure is documented and verified.
- [ ] Project status, EPIC roadmap, contracts, architecture, data model, memory, stack, and testing docs are accurate.
- [ ] EPIC 10.1 is marked complete only after all preceding criteria are evidenced.

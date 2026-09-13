# Legacy and Backward-Compatibility Audit

Date: 2026-09-13

Repository: `gami-digidouble-core`

Revision audited: `046f607c`
Scope: production source, shared contracts, PostgreSQL bootstrap, repositories, API payload readers, seed tooling, and compatibility-oriented tests.

## Current status

The clean-slate contract is enforced in production code. No release-blocking backward-compatibility
or legacy-data handling was found.

The runtime does not read old database schemas, old persisted fields, retired API values, flattened
event payloads, or alternate content/configuration keys. A fresh database and fresh content are the
only supported deployment baseline.

One test-only adapter still accepts an omitted `coveredTopics` field and fills it with an empty
array. It is not used by the PostgreSQL runtime and does not preserve old deployed data, but it is
compatibility-shaped test scaffolding and is recorded below.

## Audit definition

This audit treats code as backward compatibility when it intentionally accepts or translates a
known obsolete schema, field, value, payload shape, persisted representation, or provider contract.

The following are not legacy handling by themselves:

- Defaults for optional fields in the current contract.
- Validation and rejection of malformed current input.
- Retry, cancellation, provider-error, and missing-current-state handling.
- Current model catalog aliases and current additive JSON/SSE transports.
- Negative tests that prove retired values or fields are rejected.

## Findings

### P0 — None

No production path preserves or reads a retired database schema, compatibility table, or legacy
column.

Evidence:

- [`infra/postgres/init.sql:3`](../infra/postgres/init.sql#L3) declares the canonical fresh-database schema.
- `apps/core/src/index.ts` builds repositories directly; there is no startup schema-alignment call.
- No production source contains `alignPostgresSchema`, `schema-alignment`, `memory_summary`,
  `current_avatar_id`, `topics_covered`, or `knowledge_source_quarantines`.
- The schema contract test asserts the absence of the retired session column and quarantine table:
  [`apps/core/src/infrastructure/db/schema-contract.integration.test.ts:55`](../apps/core/src/infrastructure/db/schema-contract.integration.test.ts#L55).

### P0/P1 — None for API and shared contracts

The current API and shared contract surface is canonical and rejects retired values rather than
translating them.

Evidence:

- Knowledge types are limited to `avatar_knowledge`, `world`, and `media`:
  [`packages/shared/src/knowledge-contract-types.ts:9`](../packages/shared/src/knowledge-contract-types.ts#L9).
- Retrieval references expose normalized `similarity`; the old `score` and `distance` projections
  are absent from the public DTO:
  [`packages/shared/src/knowledge-contract-types.ts:249`](../packages/shared/src/knowledge-contract-types.ts#L249).
- No production source contains the retired `routeKey`, `__GM_ONLY__`, or `legacyAdapter` paths.

### P0/P1 — None for Game Master state and output

Persisted Game Master orchestration state and model output are parsed as the current shapes only.
Unknown fields and missing required fields are rejected; no pre-current state is normalized.

Evidence:

- Persisted state uses an allow-list of current keys and requires the current retrieval and
  progression sections:
  [`apps/core/src/domain/game-master/gm-state-parser.ts:31`](../apps/core/src/domain/game-master/gm-state-parser.ts#L31).
- Model output uses the same strict current-contract approach:
  [`apps/core/src/domain/game-master/gm-output-parser.ts:51`](../apps/core/src/domain/game-master/gm-output-parser.ts#L51).
- The parser regression tests use retired fields only to prove that they are rejected; they do not
  provide a migration or fallback path.

### P0/P1 — None for event and retrieval payloads

Session-event inspection accepts structured current `sections` payloads only. Flattened or
pre-current context payloads are not translated. Retrieval diagnostics use the current typed
sections and normalized similarity contract.

Evidence:

- Avatar and GM event context readers require the current `sections` shape and reject unknown
  top-level keys:
  [`apps/core/src/application/use-cases/list-session-events/list-session-events.use-case.ts:194`](../apps/core/src/application/use-cases/list-session-events/list-session-events.use-case.ts#L194).
- Current working-memory event projections use the current field names and types:
  [`apps/core/src/application/use-cases/list-session-events/list-session-events.use-case.ts:543`](../apps/core/src/application/use-cases/list-session-events/list-session-events.use-case.ts#L543).

### P0/P1 — None for content and configuration

Fresh content is required to use the canonical fields. Active Avatars require prepared traits,
active Scenarios require canonical language, and the current availability policy determines whether
all Avatars are available or only explicitly unlocked Avatars.

Evidence:

- Active Avatars without `computedTraits` are rejected:
  [`apps/core/src/domain/avatar/avatar.types.ts:63`](../apps/core/src/domain/avatar/avatar.types.ts#L63).
- Prompt assembly requires structured sections and prepared traits:
  [`apps/core/src/domain/avatar/persona-prompt.service.ts:59`](../apps/core/src/domain/avatar/persona-prompt.service.ts#L59).
- An absent availability policy is an explicit current semantic, not a legacy-session fallback:
  [`apps/core/src/domain/scenario/scenario-policy.service.ts:4`](../apps/core/src/domain/scenario/scenario-policy.service.ts#L4).

### P2 — Test-only compatibility-shaped working-memory fixture

The in-memory working-memory adapter permits initial test data to omit `coveredTopics` and
normalizes it to `[]`:
[`apps/core/src/infrastructure/db/in-memory-conversation-working-memory.repository.ts:4`](../apps/core/src/infrastructure/db/in-memory-conversation-working-memory.repository.ts#L4).
The corresponding test explicitly calls this a legacy seeded row:
[`apps/core/src/infrastructure/db/in-memory-conversation-working-memory.repository.test.ts:67`](../apps/core/src/infrastructure/db/in-memory-conversation-working-memory.repository.test.ts#L67).

Assessment: this is not a production PostgreSQL/API compatibility path. It only affects the
in-memory test adapter and does not read or preserve deployed data. It is the sole compatibility-
shaped implementation found in the current source scan.

## Intentional negative-test and documentation matches

The following matches are deliberate evidence, not support for obsolete behavior:

- Schema tests mention removed columns/tables to assert that they are absent.
- GM parser tests mention obsolete field names to assert rejection.
- Current retrieval errors named `incompatible_profile` and `incompatible_dimension` protect the
  active embedding contract; they do not read old vectors.
- Historical implementation prompts and this audit contain retired identifiers as documentation.
- Normal current defaults, resilience paths, and previous-conversation/session lifecycle values are
  not compatibility with an obsolete format.

## Verification

Static checks performed against the current tree:

- Repository-wide search across `apps`, `packages`, `infra`, and `scripts` found no production
  modules or paths for schema alignment, the `memory` knowledge alias, session summary mirrors,
  GM state migration, old routing/visibility keys, or legacy model adapters.
- `pnpm lint` — passed.
- `pnpm typecheck` — passed.
- `pnpm test` — passed: 165 test files, 1,131 tests.
- `pnpm test:stack-e2e` — completed with 137 tests skipped because `http://localhost:3000` was
  unavailable; no compatibility assertion failed.
- `pnpm test:integration-e2e` — not completed in this environment because the database-backed run
  waited for its external database precondition and was interrupted. Static schema evidence and
  the database-gated schema test remain available for the deployment verification run.

## Conclusion

The production runtime is clean for the requested fresh-database deployment. No remediation is
required for live backward compatibility. The only remaining compatibility-shaped code is isolated
to the in-memory test adapter and its fixture; it has no effect on fresh deployment behavior.

# Unify Retrieval Diagnostics And Direct Consumers

## Context

Vector retrieval is incomplete if admin diagnostics, runtime inspection, or evaluation tools keep
constructing alternate retrieval behavior or cannot explain profile/distance/failure outcomes. This
slice routes every direct consumer through the canonical service and safely exposes enough bounded
information to diagnose quality without leaking embeddings or unbounded source content.

## Scope

Implement now:

- update the existing admin retrieval endpoint and presenter to use the configured vector service;
- extend shared/admin/runtime diagnostic DTOs with the agreed safe profile, timing, count,
  distance/similarity, query-variant, visibility-bypass, exclusion, and failure fields;
- update runtime inspection events and session-context diagnostics to carry bounded retrieval and
  final Context Engine inclusion/trimming facts;
- update console/admin displays and API adapters only as needed to render those fields;
- find scenario validation, scripted evaluation, and test-console code that directly requests
  knowledge and route it through the same application use case/service;
- prove no route, presenter, prompt assembler, UI helper, or evaluation tool implements ranking;
- update API, presenter, event-mapper, client, and UI tests.

Out of scope:

- adding a new retrieval endpoint;
- exposing raw vectors, raw provider payloads, secrets, full prompts, or unbounded documents;
- building a metrics dashboard, reranker, hybrid search, or evaluation framework beyond existing
  direct retrieval consumers;
- changing final Context Engine selection policy.

## Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Inspect `knowledge.ts`, `get-typed-retrieval`, `knowledge-retrieval.presenter.ts`,
  `runtime-inspector-event-context.ts`, Context Engine selection traces,
  `packages/shared/src/knowledge-contract-types.ts`, runtime-inspector shared types, admin/console
  knowledge clients, and scripted conversation/evaluation tooling.
- Keep the existing endpoint and `ApiResponse<T>` envelope. Because no endpoint is introduced, add
  no new stack-e2e file solely for this slice; update `knowledge.stack-e2e.test.ts` when its response
  or failure behavior changes.
- Report profile as bounded provider/model/dimension identifiers from canonical metadata. Never
  serialize vector values.
- Separate embedding latency from vector-search latency. For multiple searches, define whether
  search latency is total and optionally bounded per-type/per-query detail; avoid high-cardinality
  observability labels.
- Candidate and exclusion counts must have precise semantics. Distinguish SQL eligibility
  exclusions, visibility exclusions where cheaply/countably available, retrieval selection drops,
  duplicate removal, and Context Engine trimming without inventing expensive extra corpus scans.
- Preserve authorized matched-query text only where the existing diagnostic contract needs it;
  logs/events should prefer query source/index and lengths or hashes.
- Record explicit `gmUnrestricted`/visibility mode and controlled failure code. Do not reveal hidden
  chunk content or IDs merely to explain exclusions.
- Ensure recorded events remain bounded by existing limits and safely parse older events that lack
  new optional fields.

## Constraints

- Reuse canonical shared DTOs and explicit mappers; no local shape copies.
- API handlers only validate/map/call use cases; they do not retrieve or rank.
- Maintain backward compatibility for persisted events and current clients.
- No raw vectors or unsafe content in API traces, logs, telemetry, or errors.
- No new HTTP endpoint. If implementation nevertheless introduces one, it must include a matching
  `*.stack-e2e.test.ts` covering API-key auth, schema validation, resource not found where relevant,
  and success, following `exchange.stack-e2e.test.ts`.

## Deliverables

- Existing admin retrieval route backed by canonical vector retrieval.
- Safe, canonical diagnostic DTOs and presenters for profile, latency, counts, similarity/distance,
  query source, visibility mode, failure, inclusion, and trimming.
- Updated runtime event/session inspection projections with backward-compatible readers.
- Admin/console/evaluation consumers using the same retrieval boundary.
- Route, mapper, shared-contract, client, and relevant UI tests.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: admin request/response, retrieved item, trace, runtime event,
   session context, Context Engine selection trace, client view model, and evaluation definition.
2. Search for duplicated type definitions, repeated inline response shapes, local console/client
   copies, inconsistent optionality/nullability, and field-name drift.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one before feature work proceeds.

## Mandatory Final Step — Documentation Update

After implementation, review and update `docs/PROJECT_STATUS.md` (always), `docs/API_CONTRACT.md`,
`docs/ARCHITECTURE.md`, `docs/GAME_MASTER_CONTRACT.md`, `docs/TEST_STRATEGY.md`,
`docs/TEST_COVERAGE_PLAN.md`, and `docs/EPICS.md` as appropriate. Document safe-field and score
semantics precisely. Explicitly verify unchanged docs. Code, tests, and docs move together.

## Acceptance Criteria

- [ ] Admin, inspection, console, and direct evaluation retrieval use the canonical service.
- [ ] No route, presenter, prompt assembler, client, or tool contains a retrieval algorithm.
- [ ] Diagnostics distinguish embedding and vector-search latency and define all counts.
- [ ] Distance/similarity, matched variant, active profile, GM bypass, and failures are observable.
- [ ] Final Context Engine inclusion and trimming remain distinguishable from retrieval selection.
- [ ] Raw vectors and unsafe/unbounded content never enter responses, events, logs, or telemetry.
- [ ] Existing endpoint stack-e2e, contract, mapper, client, and UI tests pass.

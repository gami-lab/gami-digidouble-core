# EPIC 5.1d Requirements-to-tests matrix

This matrix is the release evidence for vector retrieval. It maps each behavior requirement to
deterministic tests, repository integration tests, runtime/API tests, or an explicit static audit.
The PostgreSQL and stack suites remain environment-gated by their existing `DB_AVAILABLE` and
`APP_URL` conditions; they are not replaced by a weaker in-memory assertion.

| Requirement                                                                                                                      | Evidence                                                                                                                                                                                                        | Status                                       |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Semantic paraphrases retrieve intended chunks without lexical overlap                                                            | `typed-retrieval.service.test.ts` — semantic fixture vectors map Spanish/French paraphrase inputs to the intended English chunks                                                                                | Covered                                      |
| Unrelated or coincidental-word chunks do not outrank intended matches                                                            | Same semantic fixture test asserts the unrelated lantern chunk is not selected; no text-token logic is used by the fixture                                                                                      | Covered                                      |
| All supported query sources are normalized, deduplicated, and batch-mapped in stable order                                       | `knowledge-query-embedding.service.test.ts` — supported sources, trim/empty handling, case-insensitive first occurrence, direct-query compatibility                                                             | Covered                                      |
| One validated batch and active profile identity are used for retrieval                                                           | `knowledge-query-embedding.service.test.ts`; `typed-retrieval.service.test.ts`; corpus/profile tests                                                                                                            | Covered                                      |
| Multi-variant balancing, duplicate removal, per-type bounds, and deterministic ties remain stable                                | `retrieval-selection.test.ts`; `typed-retrieval.service.test.ts` — bounded pools, best-match deduplication, tie breakers                                                                                        | Covered                                      |
| PostgreSQL cosine ordering and normalized similarity are consistent                                                              | `postgres-knowledge-chunk.repository.integration.test.ts` — nearest order, `distance`, `similarity`, candidate limit                                                                                            | Covered when PostgreSQL is available         |
| PostgreSQL filters scenario, ready status, type, visibility, static scope, profile, generation, and memory scope before limiting | Same PostgreSQL integration test; matching in-memory contract tests provide deterministic fallback coverage                                                                                                     | Covered when PostgreSQL is available         |
| Wrong dimensions and stale profiles fail safely without vector leakage                                                           | PostgreSQL and in-memory repository tests; query embedding validation tests                                                                                                                                     | Covered                                      |
| The nearest-neighbor SQL shape remains index-compatible                                                                          | PostgreSQL integration `EXPLAIN (COSTS OFF)` assertion verifies cosine ordering plus `LIMIT`; migration owns `vector_cosine_ops`                                                                                | Covered when PostgreSQL is available         |
| Avatar filtering and explicit GM-unrestricted visibility remain asymmetric                                                       | `typed-retrieval.service.test.ts`; in-memory and PostgreSQL visibility tests; `run-game-master.typed-retrieval.use-case.test.ts`                                                                                | Covered                                      |
| Provider and vector-search failures preserve Avatar response generation and required-evidence guidance                           | `knowledge-query-embedding.service.test.ts`; `typed-retrieval.service.test.ts`; `send-message.use-case.test.ts`                                                                                                 | Covered                                      |
| GM retrieval remains asynchronous and does not block Avatar response                                                             | `send-message.use-case.test.ts` background dispatch test; GM typed retrieval tests assert explicit unrestricted mode                                                                                            | Covered                                      |
| Admin route uses the canonical service and preserves the existing envelope                                                       | `get-typed-retrieval.use-case.test.ts`; `knowledge-retrieval.presenter.test.ts`; `knowledge.stack-e2e.test.ts`                                                                                                  | Covered; stack evidence is environment-gated |
| Runtime events and session inspection retain bounded retrieval/context traces and read older events                              | `runtime-inspector-event-context.test.ts`; `list-session-events.use-case.test.ts`; session-context mapper/use-case tests                                                                                        | Covered                                      |
| Raw vectors, provider payloads, secrets, and unbounded diagnostics never cross boundaries                                        | Embedding, presenter, runtime event, repository, and send-message safety assertions; static source audit                                                                                                        | Covered                                      |
| Avatar, GM, admin, inspection, and evaluation consumers share one production composition                                         | `apps/core/src/index.ts` composition audit; route/use-case wiring audit; evaluator source audit confirms HTTP-only conversation use                                                                             | Covered                                      |
| No production lexical/hash fallback, corpus scan, or alternate ranker remains                                                    | Static `rg` audit for `overlapScore`, `token-overlap`, metadata boosts, direct `<=>`, `listBySourceIds`, and hash adapters; legacy `token-overlap` values remain only in compatibility fixtures/display mapping | Covered                                      |

## Verification commands

The focused suites are run before the repository-wide quality gates:

```text
pnpm --filter @gami/core exec vitest run --config vitest.config.ts \
  src/application/services/knowledge/typed-retrieval.service.test.ts \
  src/application/services/knowledge/knowledge-query-embedding.service.test.ts \
  src/domain/knowledge/retrieval-selection.test.ts
pnpm --filter @gami/core test:integration-e2e
pnpm --filter @gami/core test:stack-e2e
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Normal unit tests use deterministic vectors and no network calls. Live provider checks and
PostgreSQL/stack checks remain opt-in or environment-gated according to the repository test
strategy.

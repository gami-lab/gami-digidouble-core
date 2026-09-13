# Retrieval-quality baseline harness

This is a small, versioned IR harness for the static knowledge retrieval path. It calls the actual
`TypedRetrievalService` with the current `KnowledgeQueryEmbeddingService`; it does not copy the
ranking or selection algorithm. The fixtures use stable IDs because production PostgreSQL chunk IDs
are generated UUIDs and therefore are not suitable as checked-in labels. The chunk text is a small
set of verbatim excerpts from `src/seed/murder-party/{crime-scene,places,avatar-*.md}`.

## Fixtures

`fixtures.ts` contains six investigator queries across world and avatar knowledge. Each entry has an
explicit expected chunk ID and a rationale naming the source content that makes the label fair. The
nearby distractors in the same file are included to make rank changes visible; they are not another
production corpus.

The scorer evaluates the expected IDs within their declared knowledge type. `recall@k` is the
fraction of fixtures with at least one expected ID in the first `k` returned items. MRR is the mean
of the reciprocal rank of the first expected item, or zero for a miss. The reported cutoffs are the
product limits: 3 (default), 7, and 9 (Avatar maximum profiles).

## Regenerate the current baseline

The command is deliberately opt-in because it sends the fixture corpus and six queries to OpenAI
and may incur provider charges. It requires the current production profile (`text-embedding-3-small`
with 1536 dimensions) and refuses a different dimension:

```sh
pnpm --filter @gami/core retrieval-quality -- \
  --live \
  --output apps/core/src/tools/retrieval-quality/baseline-after-1536.json
```

The command loads the repository `.env` when present, while an already-exported
`OPENAI_API_KEY` takes precedence. `baseline-before.json` is the historical 16-dimension report
captured before this migration and is intentionally not overwritten. The current CLI requires the
1536-dimension production profile; write later runs to a new output path. The report contains profile
identity, scores, counts,
stable fixture IDs, and returned chunk IDs only; it contains no query text, source content, vectors,
credentials, or provider payloads. Later retrieval-quality slices should regenerate the same report
after their changes and diff it against `baseline-before.json`.

The normal full-stack route is `/v1/admin/knowledge/retrieval`, which also invokes
`TypedRetrievalService`; this harness does not use that route because its generated PostgreSQL chunk
IDs would make the checked-in labels unstable. The normal composed stack can still be started with
`docker compose -f docker-compose.e2e.yml up -d --build --wait` for stack-E2E coverage.

# Fix Or Remove Dead Retrieval Diagnostics And An Unreachable Write Path

## Context

`docs/RAG_SYSTEM_AUDIT.md` identifies two small but concrete dead/misleading pieces of the retrieval
contract:

1. `excludedChunkCount` is hardcoded to `0` at both call sites in
   `typed-retrieval.service.ts` (`emptyType`/`retrieveByType`, lines 239 and 304), because visibility
   filtering moved into the SQL `WHERE` clause and the application layer can no longer observe what it
   excluded. The field still flows through `retrieval-trace-dto.ts`, `knowledge.types.ts`,
   `knowledge-contract-types.ts`, and is rendered to operators in
   `apps/console/src/pages/session-admin-knowledge.tsx:371` as `excluded(world)=0` — a diagnostic that
   looks live but never varies.
2. `PostgresKnowledgeChunkRepository.create()` is unreachable in production: every real vector write
   goes through `PostgresKnowledgeCorpusRepository`'s own `INSERT INTO knowledge_chunks` inside
   `replaceActiveSourceChunks`/`replaceStagedSourceChunks`. The method exists solely to satisfy
   `IKnowledgeChunkRepository`, and its only real caller is `InMemoryKnowledgeCorpusRepository` (the
   dev/test in-memory stack).

Neither is harmful today, but both misrepresent what the system actually does to a reader or an
operator, which is exactly the kind of drift this audit exists to catch.

## Scope

Implement now:

- for `excludedChunkCount`: either (a) compute a real value — e.g. a cheap, bounded `COUNT(*)` of
  visibility-ineligible chunks alongside the existing search query, scoped so it does not turn into an
  expensive full-corpus scan — or (b) remove the field end-to-end (domain type, trace DTO, shared
  contract type, event/session-context readers, and the console UI line that renders it). Choose (a)
  only if a bounded, cheap query is genuinely available; otherwise (b);
- for `PostgresKnowledgeChunkRepository.create()`: either remove it from the Postgres adapter and
  narrow `IKnowledgeChunkRepository` into read/delete/search plus a corpus-owned write path, or keep it
  but add an explicit code comment (and, if the interface allows it cleanly, a narrower "read+search"
  interface for the retrieval/read side vs. a "corpus write" interface for the ingestion/reindex side)
  so a reader is not misled into thinking single-chunk creation is a supported production write path;
- audit for any other trace/DTO field in the same family (e.g. `duplicateCount`,
  `selectionExcludedCount`) that claims to measure something the current SQL-pushed-filtering design
  can no longer actually observe, and apply the same fix-or-remove rule consistently.

Out of scope:

- embedding, chunking, or selection-policy changes (other slices);
- adding new observability infrastructure beyond what already exists (`IObservabilityAdapter`,
  existing trace events) — reuse it, don't build a new one;
- changing visibility-filtering semantics; this slice only changes what is _reported_ about them, not
  how they work.

## Relevant Docs

- `docs/RAG_SYSTEM_AUDIT.md`
- `docs/RAG_SYSTEM_IMPLEMENTATION.md`
- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`

## Implementation Guidance

- Start with `typed-retrieval.service.ts` (`RetrievedType`, `emptyType`, `retrieveByType`, `toTrace`),
  `retrieval-trace-dto.ts`, `knowledge.types.ts`, `packages/shared/src/knowledge-contract-types.ts`,
  and `apps/console/src/pages/session-admin-knowledge.tsx`.
- If choosing to compute a real `excludedChunkCount`: the natural place is
  `postgres-knowledge-chunk.repository.ts`'s `searchByVector` — consider whether a second bounded
  count query (same `WHERE` clause minus the visibility filter, minus the visibility filter alone) is
  cheap enough given `MAX_VECTOR_SEARCH_CANDIDATES`. If it requires an unbounded scan to get right,
  that's a signal to remove the field instead per the epic's diagnostics-cost guidance in
  `docs/EMBEDDING_OPERATIONS.md` ("Safety" section) and the 5.1d epic's own constraint against
  "expensive extra corpus scans."
- Check `runtime-inspector-event-context.ts` and any persisted event readers for backward-compatible
  parsing of the field before removing it — old persisted events may still contain it; readers must
  not break on its absence (this repo's existing pattern already treats such fields as optional).
- For the chunk-repository cleanup, check `in-memory-knowledge-chunk.repository.ts` and
  `in-memory-knowledge-corpus.repository.ts` to confirm which interface shape the in-memory stack
  actually needs before narrowing `IKnowledgeChunkRepository`.

## Constraints

- Respect `API -> Application -> Domain -> Infrastructure`.
- Backward compatibility: persisted events/older recorded traces that still contain
  `excludedChunkCount` must parse without error even after the field is removed from new writes.
- No raw vectors, unbounded content, or expensive full-table scans introduced to compute a "real"
  count — if it can't be done cheaply, remove the field instead of computing it expensively.
- Do not change ingestion/reindex behavior; this slice only touches the repository _interface_
  shape and read-path diagnostics.

## Deliverables

- `excludedChunkCount` is either backed by a real, cheaply-computed value everywhere it is reported,
  or removed consistently from the domain type, trace DTO, shared contract, event/session-context
  readers, and console UI.
- `PostgresKnowledgeChunkRepository.create()` is removed, narrowed out of the production interface, or
  clearly documented as non-production, matching what the codebase actually calls.
- Any sibling trace field found to have the same "always zero because SQL owns the filter" problem is
  fixed or removed consistently, not left as an inconsistent exception.
- Updated tests for the DTO/mapper/console changes.

## Mandatory Pre-Implementation Check

Before coding:

1. Confirm every reader of `excludedChunkCount` (event log readers, session-context diagnostics,
   admin/console UI, shared contract type, any test asserting on it) so removal or fix is applied
   consistently, not partially.
2. Confirm every caller of `IKnowledgeChunkRepository.create` across both the Postgres and in-memory
   implementations and their tests before removing or narrowing the interface.
3. Check whether `duplicateCount`/`selectionExcludedCount` (already optional/conditionally-present
   fields per `optionalCount` in `typed-retrieval.service.ts`) have the same "unmeasurable after SQL
   push-down" problem, or whether they are computed correctly today and out of scope here.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required;
- `docs/API_CONTRACT.md` if the public/admin diagnostic DTO shape changes;
- `docs/RAG_SYSTEM_IMPLEMENTATION.md` and `docs/RAG_SYSTEM_AUDIT.md` to reflect the resolved
  dead-code/diagnostics findings instead of still describing them as open;
- `docs/EPICS.md` only with truthful progress.

## Acceptance Criteria

- [ ] `excludedChunkCount` either reports a real, cheaply-computed value in every code path that sets
      it, or is removed from the domain type, trace DTO, shared contract type, event/session-context
      readers, and the console UI together — no path left reporting a hardcoded constant as live data.
- [ ] Older persisted events/traces that still contain the field (if removed) parse without error.
- [ ] `PostgresKnowledgeChunkRepository.create()` no longer exists as an unreachable production method
      with no documentation, and the `IKnowledgeChunkRepository` interface accurately reflects what
      each implementation actually needs to support.
- [ ] No new expensive/unbounded query is introduced to compute a diagnostic field.
- [ ] `docs/RAG_SYSTEM_AUDIT.md`'s dead-code findings #1 and #3 are marked resolved with a description
      of the actual resolution chosen.

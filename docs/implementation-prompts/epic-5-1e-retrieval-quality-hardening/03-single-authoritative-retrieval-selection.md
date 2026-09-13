# Make Context Engine The Single Authoritative Retrieval Selector

## Context

`selectBalancedRetrievedItems` (`apps/core/src/domain/knowledge/retrieval-selection.ts`) currently
runs three times for the Avatar path on the same underlying content:

1. once per knowledge type inside `TypedRetrievalService.retrieveByType`
   (`typed-retrieval.service.ts:226`);
2. again on the combined `avatar_knowledge + world` set inside
   `context-engine.service.ts`'s `pushAvatarRetrievalCandidates` (`context-engine.service.ts:358`);
3. a third time inside `persona-prompt.service.ts`'s `buildRetrievalContext`
   (`persona-prompt.service.ts:228`), using the same default `maxChunks`, on the output of step 2.

The third call is not wrong today — the selector is stable on an already-selected set — but it is
dead weight that obscures where selection actually happens, and it is a latent bug magnet: if the two
call sites' `options` (`maxChunks`, `minimumChunksBySource`) ever diverge, prompt output would silently
depend on which layer's options "won," with no test likely to catch it until behavior visibly changed.
`docs/RAG_SYSTEM_AUDIT.md` calls this out as a P1 code-quality finding.

## Scope

Implement now:

- make `context-engine.service.ts` the single place that runs `selectBalancedRetrievedItems` for the
  Avatar path (step 2 above stays; it is the correct layer, since it owns the token budget and final
  segment inclusion/exclusion decisions);
- change `persona-prompt.service.ts`'s `buildRetrievalContext` to format the items it is given
  directly, without calling `selectBalancedRetrievedItems` again;
- confirm `AvatarPromptRetrievalSections`/`AvatarPromptOptions['retrievalOptions']` still make sense
  once `persona-prompt.service.ts` no longer selects — simplify or remove now-unused option plumbing
  if `retrievalOptions` was only ever used to re-run selection;
- leave the per-type selection inside `TypedRetrievalService` (step 1) as-is: it operates within one
  knowledge type before the Avatar/GM split even exists, so it is not the same selection as steps 2/3
  and is not redundant with them.

Out of scope:

- changing selection _policy_ (minimums, balancing logic, limits) — this slice is about removing a
  redundant call site, not changing what gets selected;
- the Game Master retrieval path (`pushGmRetrievalCandidates`), which never calls
  `selectBalancedRetrievedItems` today and is out of scope here;
- embedding, chunking, or vector-search changes.

## Relevant Docs

- `docs/RAG_SYSTEM_AUDIT.md`
- `docs/RAG_SYSTEM_IMPLEMENTATION.md`
- `docs/ARCHITECTURE.md`
- `docs/GAME_MASTER_CONTRACT.md`

## Implementation Guidance

- Read `context-engine.service.ts`'s `pushAvatarRetrievalCandidates` /
  `applyAvatarRetrievedContextSegment` alongside `persona-prompt.service.ts`'s `buildRetrievalContext`
  /`formatRetrievedItems` before changing either — the goal is that the exact same _set and order_ of
  items reaches the final prompt text as before, just selected once instead of three times.
  Add/adjust a test that pins this (e.g. a fixture where a naive triple-selection and a single
  selection would disagree if `options` diverged, proving the new code path is order- and
  limit-correct).
- If `persona-prompt.service.ts` needs the trace or per-source counts for anything beyond selection
  (check `formatRetrievedItems` and its label logic), keep passing that data through without re-running
  the selector.
- Check `AvatarPromptOptions['retrievalOptions']` usage across the codebase (send-message use case,
  tests) before deciding whether to remove it or repurpose it as a read-only echo of what
  `context-engine.service.ts` already decided.

## Constraints

- Respect `API -> Application -> Domain -> Infrastructure`; `persona-prompt.service.ts` is a Domain
  service and must not reach back into retrieval selection logic that Application/Context Engine
  already owns.
- Do not change the final rendered prompt text for any existing passing test — this is a redundancy
  removal, not a behavior change. If a test's expectations only passed because of the (now removed)
  third selection pass silently correcting a bad input, fix the input, don't reintroduce a selection
  call to keep the test green.
- KISS/DRY: one selection call site for the Avatar path, full stop.

## Deliverables

- `persona-prompt.service.ts` no longer calls `selectBalancedRetrievedItems`.
- `context-engine.service.ts` remains the sole Avatar-path selector, with its existing budget/segment
  logic unchanged.
- Updated tests proving identical final prompt output before and after, plus a regression test for the
  option-divergence scenario described above.
- Cleaned-up `retrievalOptions` plumbing if it is no longer needed anywhere.

## Mandatory Pre-Implementation Check

Before coding:

1. Trace every caller of `buildRetrievalContext` and `AvatarPromptOptions['retrievalOptions']` to
   confirm nothing else depends on `persona-prompt.service.ts` re-selecting.
2. Confirm `context-engine.service.ts`'s existing combined selection already produces items in the
   final order/grouping (`avatar_knowledge` vs `world`) that `formatRetrievedItems` expects, so no
   reordering logic needs to move between files.
3. Search for any other call site of `selectBalancedRetrievedItems` beyond the three already
   identified, to avoid missing a fourth.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required;
- `docs/RAG_SYSTEM_IMPLEMENTATION.md` and `docs/RAG_SYSTEM_AUDIT.md` — both currently describe/flag
  the triple-selection; update them to reflect the single authoritative selection point;
- `docs/ARCHITECTURE.md` if it documents Context Engine vs. persona-prompt responsibilities;
- `docs/EPICS.md` only with truthful progress.

## Acceptance Criteria

- [ ] `selectBalancedRetrievedItems` is called exactly once for the Avatar retrieval path, inside
      `context-engine.service.ts`.
- [ ] `persona-prompt.service.ts` formats pre-selected items without re-selecting.
- [ ] Final Avatar prompt output is unchanged for all existing passing fixtures/tests.
- [ ] A new test demonstrates that selection options no longer need to be duplicated/kept in sync
      across two layers.
- [ ] `docs/RAG_SYSTEM_IMPLEMENTATION.md` and `docs/RAG_SYSTEM_AUDIT.md` reflect the single selection
      point.

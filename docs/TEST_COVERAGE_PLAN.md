# Test coverage plan

This is a risk map, not a test inventory. Test names and exact locations belong beside the code; for
test-design rules and tier definitions, read [TEST_STRATEGY.md](TEST_STRATEGY.md).

## Highest priority

1. Public API/shared DTO compatibility and standard error envelopes.
2. Conversation lifecycle and Avatar turn persistence.
3. Async GM safety and memory ownership.
4. Retrieval visibility, vector-profile integrity, and context separation.
5. Stream/voice/audio cancellation and identity correctness.
6. Admin inspection redaction and recovery actions.

## Coverage by boundary

| Area                  | Must prove                                                                                                                                                                                                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API                   | Auth, validation, not-found/conflict/provider mapping, stable success shapes, bounded inputs/outputs.                                                                                                                                                                                                       |
| Conversation          | Complete lifecycle, active Avatar, history ordering, reset/end/switch ownership, exact-once messages.                                                                                                                                                                                                       |
| Avatar/context        | Stable section precedence, bounded recent exchanges, prepared-trait requirements, response cleanup.                                                                                                                                                                                                         |
| Game Master           | Strict current output, safe invalid actions, async/non-blocking execution, stale guidance suppression, safe events.                                                                                                                                                                                         |
| Memory                | Three complete-exchange window, compaction ownership, hydration, fact trust/contradictions, isolation and clear/reset.                                                                                                                                                                                      |
| Knowledge             | Canonical types, visibility policy, reserved keys, paragraph splitting, hard chunk caps, no-overlap boundaries, ingestion/retry, source replacement, media boundaries.                                                                                                                                      |
| Embeddings/retrieval  | Profile and dimension matching, complete ordered batches, same-profile reindex reuse and atomic PostgreSQL promotion, vector/lexical filtering and fusion at the repository/service boundary, GM bypass limits, deterministic selection, controlled failure, and the opt-in labelled recall@k/MRR baseline. |
| Streaming/voice/audio | Ordering, disconnect cleanup, interruption semantics, utterance idempotency, provider-unavailable text continuity, transient audio delivery.                                                                                                                                                                |
| Operations            | Health, metrics, event/context/memory projections, redaction, replay/refresh/clear/reindex actions.                                                                                                                                                                                                         |
| Clients/tools         | Canonical HTTP usage, runtime event reconciliation, audio text fallback, evaluator ordering and valid partial reports.                                                                                                                                                                                      |

## Non-obvious invariants to protect

These are easy to regress silently because they are policy, not type-level constraints:

- Short-term memory keeps at most the **three** most recent _complete_ user/avatar exchanges (never
  an incomplete pair), in chronological order, without replaying the full transcript. Compaction
  runs after every third exchange plus on close, avatar-switch, and admin triggers.
- Contradicted Avatar claims are excluded from working-memory persistence; user-supported and
  verified-context claims remain eligible. Memory compaction is the sole writer of `summary`,
  `coveredTopics`, `unresolvedThreads`, and `candidateFacts`.
- GM retrieval visibility is intentionally unrestricted (`gmUnrestricted`) while Avatar retrieval
  stays filtered — both directions must be provable from the same diagnostics, not just one.
- Embedding/profile changes require a full staged reindex before promotion; stale-profile or
  incomplete writes must be rejected, never silently accepted or partially promoted.
- Voice/audio: no raw audio or transcript is ever persisted; one `(conversationId, utteranceId)` can
  execute at most once (covers in-flight duplicates, completed replays, expired reservations, and
  conflicting fingerprints). An unconfigured voice provider must leave the text route unaffected.
- Retrieval and admin/console diagnostics must never leak vectors, prompts, credentials, or provider
  payloads — only bounded profile/count/timing/similarity/outcome metadata.
- Streaming persists the user message before provider iteration, never persists a partial Avatar
  message, and schedules GM/memory work only after a successful terminal completion.

## Other modules to keep covered

- Avatar trait preparation: per-avatar failure isolation, rerunnable recomputation, and persistence
  of `computedTraits` without mutating authored avatar fields.
- User persona: partial/empty persona handling, prompt injection only when persona data is present,
  and persona-lookup failures never breaking message delivery.
- Runtime events (SSE): reconnect stability, session scoping with no cross-session leakage, and
  publication failures not breaking Avatar replies.
- Metrics: turn-metric reconstruction from persisted events, and correct behavior for mixed GM/non-GM
  sessions.

## Release flows

- Fresh deployment: schema bootstrap -> health -> canonical seed -> trait preparation -> knowledge ingestion/reindex -> retrieval check -> conversation.
- Text turn: start session -> start conversation -> JSON message -> history -> async event/state inspection.
- Streaming turn: same setup -> ordered stream -> completion/interruption -> persistence and background-work assertions.
- Recovery: failed provider/GM/memory/reindex -> bounded diagnostic -> retry or explicit operator action.

Critical release flows worth protecting end to end: create session, start conversation, send
message, read history, switch avatar and verify new conversation boundaries, close conversation and
verify memory-compaction effects, register/upload a knowledge source, trigger ingestion and inspect
job state, run a retrieval-backed conversation, and inspect session runtime through admin APIs.

## Regression fixtures

Keep fixtures small, explicit, and scenario-based rather than generic. Maintain reusable sets for:
scenarios, avatars, multi-conversation sessions, knowledge visibility combinations, and provider
responses. Adversarial and edge-case inputs matter as much as happy-path ones; never use real user
data without anonymization. Fixture changes are reviewed like code changes.

## Non-goals

Do not use this document to list every endpoint, entity, test file, fixture, coverage percentage, or
historical audit — those change with code and create stale context. It should also not become a
slice-by-slice delivery journal or a duplicate of `TEST_STRATEGY.md`.

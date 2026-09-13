# Test coverage plan

This is a risk map, not a test inventory. Test names and exact locations belong beside the code.

## Highest priority

1. Public API/shared DTO compatibility and standard error envelopes.
2. Conversation lifecycle and Avatar turn persistence.
3. Async GM safety and memory ownership.
4. Retrieval visibility, vector-profile integrity, and context separation.
5. Stream/voice/audio cancellation and identity correctness.
6. Admin inspection redaction and recovery actions.

## Coverage by boundary

| Area                  | Must prove                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| API                   | Auth, validation, not-found/conflict/provider mapping, stable success shapes, bounded inputs/outputs.                                        |
| Conversation          | Complete lifecycle, active Avatar, history ordering, reset/end/switch ownership, exact-once messages.                                        |
| Avatar/context        | Stable section precedence, bounded recent exchanges, prepared-trait requirements, response cleanup.                                          |
| Game Master           | Strict current output, safe invalid actions, async/non-blocking execution, stale guidance suppression, safe events.                          |
| Memory                | Three complete-exchange window, compaction ownership, hydration, fact trust/contradictions, isolation and clear/reset.                       |
| Knowledge             | Canonical types, visibility policy, reserved keys, chunking, ingestion/retry, source replacement, media boundaries.                          |
| Embeddings/retrieval  | Profile and dimension matching, complete ordered batches, vector filtering, GM bypass limits, deterministic selection, controlled failure.   |
| Streaming/voice/audio | Ordering, disconnect cleanup, interruption semantics, utterance idempotency, provider-unavailable text continuity, transient audio delivery. |
| Operations            | Health, metrics, event/context/memory projections, redaction, replay/refresh/clear/reindex actions.                                          |
| Clients/tools         | Canonical HTTP usage, runtime event reconciliation, audio text fallback, evaluator ordering and valid partial reports.                       |

## Release flows

- Fresh deployment: schema bootstrap -> health -> canonical seed -> trait preparation -> knowledge ingestion/reindex -> retrieval check -> conversation.
- Text turn: start session -> start conversation -> JSON message -> history -> async event/state inspection.
- Streaming turn: same setup -> ordered stream -> completion/interruption -> persistence and background-work assertions.
- Recovery: failed provider/GM/memory/reindex -> bounded diagnostic -> retry or explicit operator action.

## Non-goals

Do not use this document to list every endpoint, entity, test file, fixture, coverage percentage, or
historical audit. Those change with code and create stale context.

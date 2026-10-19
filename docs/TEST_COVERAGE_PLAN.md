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
| API                   | Auth, route-tier matrix, validation, not-found/conflict/provider mapping, stable success shapes, bounded inputs/outputs.                                                                                                                                                                                    |
| Conversation          | Complete lifecycle, active Avatar, history ordering, reset/end/switch ownership, exact-once messages.                                                                                                                                                                                                       |
| Avatar/context        | Stable section precedence, bounded recent exchanges, prepared-trait requirements, response cleanup.                                                                                                                                                                                                         |
| Game Master           | Strict current output, safe invalid actions, async/non-blocking execution, stale guidance suppression, safe events.                                                                                                                                                                                         |
| Memory                | Three complete-exchange window, compaction ownership, hydration, fact trust/contradictions, isolation and clear/reset.                                                                                                                                                                                      |
| Knowledge             | Canonical types, visibility policy, reserved keys, paragraph splitting, hard chunk caps, no-overlap boundaries, ingestion/retry, source replacement, no media type.                                                                                                                                         |
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
  Utterance keys always carry a Redis TTL, set in the same command as the write.
- Built `web`, `admin`, and `console` bundles contain no secret name or secret-shaped value.
- Media: the open file route serves only uploads of active scenarios (anything else is `404`) and
  honours single `Range` requests; uploads stream to storage, are checked against their leading
  bytes and per-kind size limit, and leave no file behind on failure; presentation refs must name
  an asset of the same scenario whose kind fits the slot; a referenced asset cannot be deleted.
- Player identity comes only from a Core-signed token; another player's session, conversation,
  history, runtime state, events stream, or audio is indistinguishable from a missing one (`404`).
- Session unlock state is fixed at session start and changes only through Game Master unlocks; the
  Avatar prompt's awareness and the available-Avatars endpoint must agree for the same session.
- Retrieval and admin/console diagnostics must never leak vectors, prompts, credentials, or provider
  payloads — only bounded profile/count/timing/similarity/outcome metadata.
- Streaming persists the user message before provider iteration, never persists a partial Avatar
  message, and schedules GM/memory work only after a successful terminal completion.

## Other modules to keep covered

- Nightly test depth: add mutation and conversation-regression suites when their scripts exist,
  performance smoke/soak checks once baseline thresholds are defined, and secrets scanning once an
  approved tool is available for the GitHub organization.
- Avatar trait preparation: per-avatar failure isolation, single-avatar and unprepared-only
  selection, per-avatar source visibility, rerunnable recomputation, persistence
  of `computedTraits` without mutating authored avatar fields, and model resolution through
  scenario default -> global default only (never Avatar role/entity/scenario overrides).
- Player presentation: create/update/clear round-trips through admin, PostgreSQL, and the player
  projections (`PublicScenarioSummary`, `AvailableAvatarSummary`); replacing `config` keeps it,
  invalid input is `400`, the route schema and the shared guards accept and reject the same
  fixtures, and orchestration output is identical with or without it. Admin forms
  must keep the shared limits and send `null` when every field is emptied.
- Player conversation: starter questions use the same send path as typed text; switching
  character goes through `switch-avatar`; the presence state (listening/thinking/speaking) comes
  from one pure mapper and is announced in a polite live region; a denied or missing microphone
  leaves a working text mode.
- Player moments: GM unlocks and suggestions become staged moments only for the current session,
  once per event id, never while the character is thinking or speaking, never with GM reasons,
  and a suggestion switches only on the visitor's action. The idle hint fires once per idle period,
  only on the visitor's turn, and clears on input.
- Scenario model selection: every slot in `SCENARIO_MODEL_SLOTS` round-trips through API create/
  update and Postgres read-back, and each runtime role honors its scenario slot before the default.
- User persona: partial/empty persona handling, prompt injection only when persona data is present,
  and persona-lookup failures never breaking message delivery.
- Runtime events (SSE): reconnect stability, session scoping with no cross-session leakage, and
  publication failures not breaking Avatar replies. The stack-E2E suite still needs a live seeded
  runtime-event frame assertion; keep this as a release-coverage gap until stack seeding supports it.
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

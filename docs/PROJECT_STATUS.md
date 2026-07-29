# Project Status

Last updated: 2026-07-29
Current phase: Phase A core runtime delivered through EPIC 8.5 Prompt 4; EPIC 8.6 scripted evaluation delivered

## Snapshot

The platform is now a working headless conversational runtime with:

- persistent scenarios, avatars, sessions, conversations, and messages
- direct avatar response flow
- async Game Master orchestration
- deterministic layered memory
- typed knowledge ingestion and retrieval
- deterministic context assembly for Avatar and GM
- runtime SSE events and runtime-state snapshots
- admin inspection, replay, and memory-control tooling
- scenario-builder admin surfaces
- public web chat surface
- authenticated scripted evaluation tooling with semantic judging through the raw exchange boundary,
  strict JSON results, nullable cost semantics, model mismatch reporting, atomic incremental reports,
  deterministic fake-HTTP composition coverage, and an opt-in Villa Miralac definition
- progressive avatar-response rendering in the public web chat surface
- multi-model runtime configuration
- request and turn observability
- canonical shared message-stream DTOs and reusable SSE frame parsing for web and console clients
- additive internal LLM streaming contracts with native OpenAI, Anthropic, Mistral, xAI, null, and
  observed adapter support
- reusable streaming send-message execution with ordered deltas, terminal avatar persistence, and
  deterministic interruption handling
- additive SSE message-stream route with stack-e2e contract coverage
- web message-stream client and in-memory avatar-draft reconciliation with completion and
  interruption tests
- streaming cleanup and ordering hardening: contiguous client delta rendering, abort listener and
  reader cleanup, provider iterator cleanup, exact-once terminal persistence, and legacy JSON route
  contract coverage

## What Is Shipped

### Conversation Runtime

- Sessions contain one or more bounded conversations.
- Avatars answer users directly; the Game Master never blocks the normal reply path.
- Conversations can be started, ended, switched, listed, and replayed through documented APIs.
- Session runtime state and safe runtime events are exposed for reconnect and live UI updates.

### Game Master

- GM runs asynchronously after completed avatar turns and can also run on session start or manual replay.
- GM can inject notes, suggest or switch avatars, unlock avatars, and update lightweight orchestration state.
- GM decisions are validated by runtime guards before they affect session state; conversation
  lifecycle remains owned by the existing platform switch use case.
- GM output is stored as turn-scoped next-turn orchestration state; the next Avatar turn consumes matching dialogue guidance and retrieval intent exactly once.
- GM retrieval queries and required facts are used as RAG query variants, and are instructed to follow the Scenario description language used by the knowledge documents. The GM prompt treats retrieval as forward-looking preparation for the next related turn, anticipating likely continuation context in addition to handling exact questions, contradictions, and knowledge-boundary issues.
- Avatar retrieval keeps the best distinct match for the user question, GM retrieval queries, and GM required facts before filling remaining slots by global score; retrieval diagnostics preserve the matched input and chunk content for console inspection. Runtime events now expose the GM retrieval plan and link it to the subsequent Avatar turn, including per-proposal match outcomes.
- Required retrieval gaps inject explicit uncertainty guidance, and invalid routing falls back to `stay` without changing progression or memory ownership.
- Safe GM diagnostics are recorded in the event log and exposed through admin APIs.
- Invalid-output traces and parser failures record bounded metadata only; raw prompts, user
  messages, and model responses are excluded.
- GM state no longer persists legacy topic updates or interaction increments; session/conversation
  state owns Avatar routing and application code increments completed-exchange counts.
- Prompt 4 regression coverage protects the output contract, dynamic routing schemas, next-turn
  retrieval planning, unrelated-question stale-plan suppression, dialogue-control modes, stale
  orchestration state, persistence failure diagnostics, prompt sizing, and the scoped Mona
  contradiction flow.

### Memory

- Working memory, episodic memories, and long-term facts are all implemented.
- Conversation closure triggers memory compaction instead of relying on full transcript replay.
- Working memory now includes `summary`, `unresolvedThreads`, and `coveredTopics`.
- Memory compaction is the sole writer of `summary`, `coveredTopics`, `unresolvedThreads`, and
  `candidateFacts`; Avatar claims remain untrusted unless user-supported or provenance-labeled.
- Contradicted Avatar claims are filtered before working-memory persistence, while user-supported
  and verified-context claims remain eligible.
- Legacy GM state and pending orchestration records remain readable through compatibility
  normalization, with ambiguous legacy routing ignored.
- Legacy `topics_covered` values remain persistence-compatible but are omitted from current
  shared/admin GM projections.
- Memory layers are inspectable through admin routes and runtime tooling.

### Knowledge And Context

- Knowledge sources support typed ingestion (`memory`, `world`, `media`) with ingestion jobs.
- Text ingestion keeps complete paragraphs together, packs them toward the target chunk size, and
  carries the active Markdown header path into every relevant chunk before embedding.
- Avatar-scoped visibility filtering is enforced before avatar context assembly.
- GM retrieval is intentionally unrestricted for orchestration decisions.
- Admin retrieval diagnostics use the unrestricted GM view when no active avatar is selected.
- Context Engine assembles bounded Avatar and GM projections with deterministic precedence and trace metadata.
- Avatar prompt assembly consumes structured runtime sections, including prepared avatar traits when available.

### Operations

- Health, metrics, session inspection, session events, session context, and session memory endpoints are live.
- Admin runtime actions include GM replay, memory refresh, and memory clear.
- Global, role, scenario, and avatar model selection are configurable with deterministic precedence.
- Observability captures latency, token usage, effective model resolution, and safe runtime metadata.

### Apps

- `apps/console` is the local operator/debug surface.
- `apps/web` is the public player-facing chat surface.
- Scenario-builder flows cover scenario/avatar editing, knowledge-source authoring, visibility policy, and model selection.

### Evaluation Tooling

- The EPIC 8.6 contract cleanup, tool foundation, sequential HTTP runner, semantic judging,
  aggregation, atomic report persistence, and CLI execution are shipped in
  `tools/conversation-evaluation`.
- `TestDefinition`, `QuestionResult`, `JudgeResult`, and `RunReport` are tool-owned types; Core
  domain and HTTP DTOs are not extended with evaluation-only state.
- Versioned JSON definitions validate required fields, exact initial-avatar selection, duplicate
  questions, and unknown fields before any network work. Model fields are declared/expected
  metadata only, not request-level overrides.
- CLI and environment configuration resolves the Avatar API URL, API key, optional judge URL,
  report path, timeout, and a unique run-scoped user ID by default; explicit user IDs support
  controlled continuity tests. Definition validation is network-free, while the execution command
  intentionally makes authenticated requests only when explicitly invoked.
- The evaluator reuses shared conversation/entity and raw-exchange contracts. API-provided cost is
  preserved when present and normalized to `null` when absent; no pricing is inferred.
- The typed evaluator HTTP client decodes only `ApiResponse<T>`, sends API-key headers, bounds
  surfaced error messages, and handles configured timeouts and caller aborts. The runner creates
  one session and conversation, resolves an initial Avatar deterministically, awaits each JSON
  response in order, records shared message metrics, and returns partial `api_error` results
  without polling asynchronous Game Master or memory work.
- The evaluator sends bounded, structured question/criteria/answer evidence to authenticated
  `POST /v1/exchange` for semantic judging. Judge output is runtime-validated, including the
  deterministic fenced-JSON compatibility form, and malformed or unavailable judges remain
  `judge_error` rather than quality failures.
- Reports preserve attempted question inputs, Avatar responses and metrics, separate Avatar and
  judge model observations/mismatches, explicit pass-rate denominators, and nullable total cost.
  Report snapshots use atomic replacement after each attempted question, so partial runs remain
  valid JSON. Console summaries omit prompts, API keys, and unbounded payloads.
- The package test suite includes deterministic unit coverage plus a fake-HTTP integration-style
  three-question ordering test; the seeded Villa Miralac definition is readable and opt-in only.

## Current Architectural Invariants

- Layering remains `API -> Application -> Domain -> Infrastructure`.
- External input is validated at the API boundary.
- `@gami/shared` owns public/shared DTOs; route-local contract duplication should not be reintroduced.
- `RawExchangeResponse` and `LlmResponseMetrics` are owned by `packages/shared`; Core's raw exchange
  application output remains internal and is mapped at the API boundary.
- `tools/conversation-evaluation` is an external client/tool boundary; its report types remain
  outside the Core domain.
- `MessageStreamEvent` is owned by `@gami/shared`; future stream requests reuse `SendMessageRequest`.
- `LlmStreamEvent` and `LlmStreamOptions` are owned by the internal `ILlmAdapter` port; provider
  streams emit ordered deltas followed by one terminal response with usage metadata.
- `ObservedLlmAdapter` remains the single LLM observability boundary for streams and traces the
  full request once, not individual deltas; interrupted streams record bounded outcome/reason
  metadata on that same trace.
- `StreamingSendMessageUseCase` reuses the synchronous turn preparation and completion mechanics;
  it persists the user message before provider iteration, persists no partial avatar message, and
  schedules GM/memory work only after successful completion. Provider/client interruption closes the
  active iterator and skips final avatar persistence and post-turn work.
- Generic SSE frame parsing is owned by `@gami/shared`; client-specific subscription and reconnect
  behavior stays in each app. `parseMessageStreamEvent` validates decoded public frames before
  consumer state changes. The web message client buffers out-of-order deltas until their sequence
  is contiguous and cancels its reader/abort listener during cleanup.
- Avatar reply latency takes priority over synchronous orchestration work.
- Public contracts evolve additively whenever possible.
- Retrieval visibility is asymmetric by design: avatar-filtered, GM-unrestricted.

## Open Product Work

- No standalone guided-progression engine beyond existing GM heuristics.
- No completed hybrid response/cache path.
- No completed real-scenario validation milestone.
- No completed prototype-packaging milestone.

## Implementation References

- Use `EPICS.md` for the compact roadmap ledger.
- Use `API_CONTRACT.md` for HTTP contracts.
- Use `GAME_MASTER_CONTRACT.md` for GM runtime behavior.
- Use `MEMORY_SYSTEM_SPEC.md` for memory rules.
- Use `ARCHITECTURE.md` and `PRINCIPLES.md` before changing boundaries or responsibilities.

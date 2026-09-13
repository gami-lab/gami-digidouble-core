# Context contract ownership

Use this map to decide where a change belongs. Shared DTOs describe the wire contract; Core domain
and application types describe internal behavior; mappers connect them. This map exists to prevent
drift across `apps/core`, `apps/console`, and `packages/shared` as Context Engine, Game Master, and
memory contracts keep evolving — when in doubt, find the canonical owner below before adding a new
shape.

## Canonical owners

| Concern                               | Canonical owner                                             | Must not own it                 |
| ------------------------------------- | ----------------------------------------------------------- | ------------------------------- |
| Public entity/lifecycle DTOs          | `packages/shared/src/entity-types.ts`, `lifecycle-types.ts` | Persistence repositories        |
| Conversation/message DTOs             | `packages/shared/src/conversation-contract-types.ts`        | Provider adapters               |
| SSE frames and parsing                | `conversation-stream-contract-types.ts`, `sse.ts`           | UI state modules                |
| Knowledge/retrieval DTOs              | `knowledge-contract-types.ts`                               | Memory repositories             |
| Runtime inspection DTOs               | `runtime-inspector-types.ts`, `runtime-types.ts`            | Database row serializers        |
| Voice/audio DTOs                      | `voice-contract-types.ts`                                   | Provider-specific config        |
| Raw exchange DTOs                     | `raw-exchange-contract-types.ts`                            | Evaluation-only report models   |
| Avatar prompt/context policy          | Core domain/application (`domain/avatar`, `domain/context`) | Shared package and API handlers |
| GM output parsing/reduction           | Core Game Master domain/application (`domain/game-master`)  | API and UI                      |
| Memory selection/maintenance          | Core memory domain/application (`domain/memory`)            | Static knowledge ingestion      |
| Vector query and repository filtering | Core knowledge application/infrastructure                   | Clients and prompts             |

Internal Context Engine snapshots (`ContextScenarioSnapshot`, `AvatarContextSnapshot`,
`GmContextSnapshot`, `SessionContextSnapshot`) are owned by
`apps/core/src/domain/context/session-context.types.ts`. Their public/admin mirror is owned by
`packages/shared/src/runtime-inspector-types.ts`, mapped explicitly by
`apps/core/src/api/routes/mappers/session-context.mapper.ts` — route handlers always return the
shared DTO via this mapper; application/domain use cases only ever return the internal contract.

## Static knowledge ownership

- `KnowledgeType` is exactly `avatar_knowledge | world | media`; the shared tuple
  (`packages/shared/src/knowledge-contract-types.ts`) is the single source and is re-exported, not
  redeclared, by `apps/core/src/domain/knowledge/knowledge.types.ts`. `memory` is rejected as a
  knowledge type at the API boundary — conversational memory has its own contracts (below).
- Source/chunk domain shapes and retrieval results live in
  `apps/core/src/domain/knowledge/knowledge.types.ts`; presenters map them to the shared DTOs, and
  PostgreSQL row shapes in the knowledge repositories are private adapter details that never
  become an HTTP contract.
- Reserved metadata keys (the ones that would leak lifecycle scope into static content) are
  rejected recursively on source/chunk create, update, ingestion, and reindex writes — enforced in
  `apps/core/src/domain/knowledge/static-knowledge-validation.ts`.
- Static retrieval candidate filters are: scenario, `avatar_knowledge|world|media`, ready source,
  active profile/generation, and Avatar visibility. `gm_unrestricted` bypasses visibility only —
  it never bypasses scenario/type/readiness/active-corpus filtering, and a missing active avatar
  is not itself an authorization bypass.
- Static retrieval may accept conversational text (e.g. a working-memory summary) as its query
  string, but it never accepts a user/session/conversation ID, never reads memory repositories,
  and never boosts candidates by conversational scope. This is the load-bearing separation that
  keeps "static knowledge" and "conversational memory" from bleeding into each other.
- Scenario deletion removes scenario knowledge through the database foreign-key cascade; static
  reindex only touches corpus generations/chunks. Neither owns conversational memory rows.

## Conversational memory ownership

- Recent messages/exchanges: persisted messages in `apps/core/src/domain/conversation/session.types.ts`;
  the bounded exchange projection is derived (no separate short-term table) by
  `conversation-exchange-window.ts`.
- Working memory, episodic memory, session/avatar memory summaries, and durable user facts are all
  owned by `apps/core/src/domain/memory/memory.types.ts`, behind repository ports
  (`IConversationWorkingMemoryRepository`, `IConversationMemoryRepository`,
  `IUserMemoryFactRepository`); `memory-maintenance.service.ts` is the sole working-memory refresh
  workflow, and `memory-selection.service.ts` is the sole episode-selection workflow.
- Shared/admin memory DTOs live in `packages/shared/src/memory-contract-types.ts` and
  `lifecycle-types.ts`, composed further by `runtime-inspector-types.ts`. Core maps internal memory
  snapshots at the use-case/API boundary only — console/admin never declare a parallel shape.
- Lifecycle ownership is split deliberately: session reset owns messages and session/conversational
  memory rows; conversation close owns the episodic/fact background pipeline; memory maintenance
  owns the working-memory refresh. None of the three owns RAG repositories or embeddings — that
  stays with the knowledge module above.

## Avatar and GM prompt assembly

- Avatar prompt sections are assembled in `apps/core/src/domain/avatar/persona-prompt.service.ts`
  in a fixed order: Director Notes -> Response Rules -> Conversation State -> User Persona ->
  World Context -> Retrieved Context -> Avatar Traits. Retrieved knowledge is a separate section
  from Conversation State and is never merged into memory.
- GM's own projection is rendered by `gm-input-renderer.ts` from
  `apps/core/src/domain/game-master/game-master.types.ts`; it stays parallel to but separate from
  the Avatar projection — `conversationState` carries only memory layers, `retrievedContext` carries
  only static typed knowledge with provenance, and GM's explicit unrestricted retrieval result is
  never silently swapped in for the Avatar-filtered one or vice versa.
- Token budget/trimming (`ContextEngineTrace`, precedence policy in `context-engine.policy.ts`)
  stays internal to `domain/context` unless an existing shared runtime-inspector contract already
  exposes it — do not add a new shared trimming DTO without a concrete external consumer.
- Avatar identity requires prepared `computedTraits`; the authored `personaPrompt` is authoring
  data only and is never used as a runtime identity fallback.

## Entity, event, and evaluation contracts

- Avatar/Scenario/Session/Conversation/Message entities each have one internal domain owner
  (`domain/avatar`, `domain/scenario`, `domain/conversation`) and one public projection in
  `packages/shared/src/entity-types.ts` or `conversation-contract-types.ts`; a dedicated
  `*-summary.ts` mapper in `application/use-cases/shared/` is the only place that builds the public
  shape from the internal one. GM state/input/output follows the same pattern through
  `domain/game-master` and `runtime-inspector-types.ts`.
- Runtime/persisted events are built by Core event builders against `IEventLogRepository`
  internally, and mirrored publicly through `packages/shared/src/runtime-types.ts` and
  `runtime-inspector-types.ts`; `ListSessionEventsUseCase` is the only event-to-DTO mapper. Legacy
  event shapes are not supported — readers accept only the current structured-section payload.
- The raw exchange wire shape (`packages/shared/src/raw-exchange-contract-types.ts`,
  `llm-contract-types.ts`) is additive: existing response fields are preserved, and cost is
  explicitly not part of the current raw-exchange guarantee.
- `tools/conversation-evaluation` owns its own report/execution types
  (`TestDefinition`, `QuestionResult`, `JudgeResult`, `RunReport`) locally — it imports shared HTTP
  DTOs at its client boundary (never redeclaring entity/message/model-selection shapes) and
  normalizes an absent cost to `null` rather than inventing a tool-specific contract.

## Anti-duplication rules

- `@gami/shared` owns public names, validation-facing unions, and DTOs used by more than one client.
- Core owns internal entities, ports, policies, and orchestration state.
- API/application mappers are the only place to translate between internal and public shapes.
- Persistence schemas are infrastructure details; never make them the public contract by convenience.
- Evaluation reports and viewer models stay in `tools/conversation-evaluation`.
- Admin and console views consume canonical routes; they do not create compatibility read paths.
- Before adding a type, identify its consumer and owner. Reuse an existing shared DTO when the wire
  shape is the same; if internal and public needs genuinely differ, keep two explicit types and add
  a mapper rather than forking the shared one.
- Do not add aliases for removed contracts, flattened context projections, provider-shaped fields,
  or a static `memory` knowledge type.

## Projection rule

Runtime inspection may show bounded `conversationState` and `retrievedContext` sections together,
but they remain distinct. Conversation state contains exchanges, working memory, episodic memory,
and user facts. Retrieved context contains only scenario static knowledge and provenance. Event
readers accept only this current structured-section shape — there is no legacy flattened event
payload to support.

The full cross-boundary proof for these ownership boundaries (two-user consistency/isolation,
close/switch/reset/reindex/scenario-cascade behavior) is maintained in
[EPIC_4_2D_REQUIREMENTS_MATRIX.md](EPIC_4_2D_REQUIREMENTS_MATRIX.md).

# Context contract ownership

Use this map to decide where a change belongs. Shared DTOs describe the wire contract; Core domain
and application types describe internal behavior; mappers connect them.

| Concern                               | Canonical owner                                             | Must not own it                 |
| ------------------------------------- | ----------------------------------------------------------- | ------------------------------- |
| Public entity/lifecycle DTOs          | `packages/shared/src/entity-types.ts`, `lifecycle-types.ts` | Persistence repositories        |
| Conversation/message DTOs             | `packages/shared/src/conversation-contract-types.ts`        | Provider adapters               |
| SSE frames and parsing                | `conversation-stream-contract-types.ts`, `sse.ts`           | UI state modules                |
| Knowledge/retrieval DTOs              | `knowledge-contract-types.ts`                               | Memory repositories             |
| Runtime inspection DTOs               | `runtime-inspector-types.ts`, `runtime-types.ts`            | Database row serializers        |
| Voice/audio DTOs                      | `voice-contract-types.ts`                                   | Provider-specific config        |
| Raw exchange DTOs                     | `raw-exchange-contract-types.ts`                            | Evaluation-only report models   |
| Avatar prompt/context policy          | Core domain/application                                     | Shared package and API handlers |
| GM output parsing/reduction           | Core Game Master domain/application                         | API and UI                      |
| Memory selection/maintenance          | Core memory domain/application                              | Static knowledge ingestion      |
| Vector query and repository filtering | Core knowledge application/infrastructure                   | Clients and prompts             |

## Projection rule

Runtime inspection may show bounded `conversationState` and `retrievedContext` sections together, but
they remain distinct. Conversation state contains exchanges, working memory, episodic memory, and
user facts. Retrieved context contains only scenario static knowledge and provenance.

## Boundary rules

- `@gami/shared` owns public names, validation-facing unions, and DTOs used by more than one client.
- Core owns internal entities, ports, policies, and orchestration state.
- API/application mappers are the only place to translate between internal and public shapes.
- Persistence schemas are infrastructure details; never make them the public contract by convenience.
- Evaluation reports and viewer models stay in `tools/conversation-evaluation`.
- Admin and console views consume canonical routes; they do not create compatibility read paths.

## Anti-duplication checklist

Before adding a type, identify its consumer and owner. Reuse an existing shared DTO when the wire
shape is the same. If internal and public needs differ, keep two explicit types and add a mapper.
Do not add aliases for removed contracts, flattened context projections, provider-shaped fields, or
static `memory` knowledge.

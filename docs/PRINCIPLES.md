# Principles

These rules govern architecture and product decisions. If a change conflicts with one, document
the trade-off explicitly before implementing it. When in doubt, build the simplest system that can
deliver a coherent, evolving, measurable experience — everything else is secondary.

1. **Experience over technology.** Optimize for coherent, useful guided experiences, not model novelty.
2. **Orchestration over generation.** State, context selection, progression, and policy belong to the platform; prompts do not hide product rules.
3. **Productize AI, don't hand-craft prompts.** Prefer editable configuration, explicit rules, reusable variables, and stable contracts over long handcrafted prompts. Decision quality comes from a balance of reasoning, policy rules, progression state, and constraints — not one giant prompt. If a behavior cannot be inspected and configured, it is not product-ready.
4. **Context is the product.** Select, structure, retrieve, update, and compact context deliberately. More context is not automatically better — most information is noise.
5. **Keep Core small.** Core orchestrates the experience. UI, authoring, media rendering, and product-specific behavior stay outside it.
6. **API is the interface.** External clients use explicit, stable contracts. Do not leak persistence rows, provider fields, or internal state.
7. **Stay provider-neutral.** Provider SDKs are infrastructure details behind application ports. Runtime logic owns roles and policy, not vendor APIs; any provider must be replaceable and different roles may use different models.
8. **Separate thinking from speaking.** The Game Master plans asynchronously; the Avatar speaks directly to the user. These are different intelligence modes and should not be merged by habit.
9. **Async by default.** Do not delay the user-facing turn for GM work, memory maintenance, logging, or other non-essential work. Only block when it materially improves the current exchange.
10. **Event-driven over polling.** When async orchestration changes session/world state, notify clients through explicit runtime events plus lightweight state snapshots for reconnect — not hidden state only discovered on the next user message, and not mandatory high-frequency polling.
11. **Prefer the simplest viable design.** Use a modular monolith and deterministic policies until measurable pain justifies more infrastructure. Expect new models, interfaces, and media formats — flexibility beats premature completeness, but complexity is still earned, not assumed.
12. **Make important behavior observable.** Record bounded latency, usage, failures, retrieval/context decisions, and runtime events without secrets or raw prompts. Trace/metric tools (e.g. Langfuse) show what the LLM did, not what the session, GM, memory, or ingestion pipeline are doing — admin endpoints and inspection tools are a separate, necessary layer, not a nice-to-have.
13. **Design for learning speed.** Favor inspectable seams, safe resets/replays, experiments, and reversible decisions. Admin/operational tooling is core work, not something added after features — every session we can't inspect, replay, or reset costs debugging time and confidence.
14. **Memory must be useful, not complete.** Keep bounded, user-relevant state; do not preserve complete transcripts or unverified claims by default. Memory is a tool for continuity, not an archive.
15. **Guide, don't just generate.** Open-ended chat is not the goal — the system should actively support role fidelity, progression, pacing, and objective coverage. Each turn should be evaluated by what it moves forward (understanding, discovery, narrative, scenario objectives); if nothing progresses, orchestration failed.
16. **Content and engine stay decoupled.** Scenario content is configuration/data; orchestration and lifecycle rules remain in Core, so experiences and avatars evolve without rewriting the engine.
17. **If it cannot be inspected, it is not production-ready.** Operators need safe snapshots, diagnostics, and recovery actions without database access.
18. **Build for real use, not demos.** The system must survive long sessions, noisy input, cost constraints, multiple scenarios, imperfect content, and operator mistakes — not just a clean demo path.

## Non-negotiables

- Keep the `API -> Application -> Domain -> Infrastructure` layering.
- Validate external input at the API boundary.
- Never call a provider SDK from Domain or Application code.
- Do not add LangChain/LangGraph, microservices, or a dedicated vector database without a measured need.
- No backward compatibility during prototyping: every deploy wipes and recreates the database, so
  there is no persisted data or shipped contract to preserve across releases. Do not add migrations,
  compatibility shims, versioned/optional fields, or deprecated-but-kept paths to ease a transition —
  change shapes freely and update docs/tests in the same change. Revisit only once a phase requires
  durable user data or an external integration across deploys.

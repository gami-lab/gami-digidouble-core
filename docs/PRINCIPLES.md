# Principles

These rules govern architecture and product decisions. If a change conflicts with one, document
the trade-off explicitly before implementing it.

1. **Experience over technology.** Optimize for coherent, useful guided experiences, not model novelty.
2. **Orchestration over generation.** State, context selection, progression, and policy belong to the platform; prompts do not hide product rules.
3. **Context is the product.** Select, structure, retrieve, update, and compact context deliberately. More context is not automatically better.
4. **Keep Core small.** Core orchestrates the experience. UI, authoring, media rendering, and product-specific behavior stay outside it.
5. **API is the interface.** External clients use explicit, stable contracts. Do not leak persistence rows, provider fields, or internal state.
6. **Stay provider-neutral.** Provider SDKs are infrastructure details behind application ports. Runtime logic owns roles and policy, not vendor APIs.
7. **Separate thinking from speaking.** The Game Master plans asynchronously; the Avatar speaks directly to the user.
8. **Async by default.** Do not delay the user-facing turn for GM work, memory maintenance, logging, or other non-essential work.
9. **Prefer the simplest viable design.** Use a modular monolith and deterministic policies until measurable pain justifies more infrastructure.
10. **Make important behavior observable.** Record bounded latency, usage, failures, retrieval/context decisions, and runtime events without secrets or raw prompts.
11. **Design for learning speed.** Favor inspectable seams, safe resets/replays, experiments, and reversible decisions.
12. **Memory must be useful.** Keep bounded, user-relevant state; do not preserve complete transcripts or unverified claims by default.
13. **Content and engine stay decoupled.** Scenario content is configuration/data; orchestration and lifecycle rules remain in Core.
14. **If it cannot be inspected, it is not production-ready.** Operators need safe snapshots, diagnostics, and recovery actions without database access.

## Non-negotiables

- Keep the `API -> Application -> Domain -> Infrastructure` layering.
- Validate external input at the API boundary.
- Never call a provider SDK from Domain or Application code.
- Do not add LangChain/LangGraph, microservices, or a dedicated vector database without a measured need.
- Preserve backward compatibility only when it is an explicit product requirement; the current Phase A deployment is a clean-slate contract.

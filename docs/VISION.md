# Vision

Gami DigiDouble Core is a headless engine for guided interactive experiences: conversations that
remember what matters, adapt to the user, and progress toward scenario goals.

Core is a reusable platform layer, not an application. It coordinates:

- **Avatar** — the direct conversational actor.
- **Game Master** — the asynchronous director of progression, routing, and guidance.
- **Context** — bounded conversation state, scenario content, and retrieved knowledge.
- **Operations** — inspection, diagnostics, and human recovery tools.

Clients and products consume Core through HTTP/SSE contracts. Web, admin, console, voice, and media
delivery remain separate layers.

## Product direction

Phase A validates the loop:

`user input -> context assembly -> Avatar response -> asynchronous GM/memory work`

The next increments should improve guided progression, real-scenario quality, operator recovery,
and response reliability only when they preserve the Core boundaries and remain measurable.

## Success criteria

- Conversations remain coherent over time without replaying unbounded history.
- Scenario content and Avatar behavior can evolve without code changes to orchestration.
- Operators can understand and recover runtime behavior safely.
- Multiple clients and products can reuse the same Core contracts.

# Epics

`PROJECT_STATUS.md` is the current capability snapshot. This file keeps only the product history
needed to understand scope and the small open backlog; implementation prompts and audit history do
not belong in the development context.

## Shipped

- **1.1–1.2 Foundations:** pnpm/Turborepo monorepo, local infrastructure, modular Core, LLM and observability boundaries.
- **2.1–2.8 Conversation and operator surfaces:** Avatar runtime, lifecycle, persistence, console, admin CRUD, GM inspection, and runtime inspector.
- **3.1–3.2 Operations:** dependency health and canonical session inspection.
- **4.1–4.5 Runtime:** async GM, model configuration, layered memory, multi-Avatar navigation, runtime state/events, and performance instrumentation.
- **5.1–5.3 Knowledge and context:** typed RAG, Avatar visibility, embeddings/reindexing, vector retrieval, context engine, and streaming UX.
- **5.5–7.1 Product surfaces:** user persona, scenario builder, and public web app.
- **8.1–8.6 Refinement/evaluation:** prepared Avatar traits, structured context, GM and memory prompt contracts, and scripted conversation evaluation.
- **9.1–9.2 Voice:** optional speech input, transient text-to-speech delivery, browser playback, and safe fallback.
- **10.1 Clean-slate contracts:** removed compatibility paths, aligned fresh schema/content, and made current contracts strict.

## Open backlog

### 3.3 Replay and recovery tools

Complete operator recovery as a coherent, audited capability: safe replay-last-turn semantics,
explicit reset boundaries, and action audit history/permissions.

### 5.1e Retrieval quality hardening

Fix the gaps found by `docs/RAG_SYSTEM_AUDIT.md`: raise embedding fidelity off its current
16-dimension floor, cap/overlap chunking correctly, remove redundant/dead retrieval selection and
diagnostics code, and add a lexical fallback plus a small recall@k harness to prove it actually
improved answer grounding. See `docs/implementation-prompts/epic-5-1e-retrieval-quality-hardening/`.

### 5.4 Guided progression engine

Make scenario objectives, pacing, milestones, recommendations, and role-fidelity constraints
explicit and inspectable rather than relying only on GM heuristics.

### 5.6/6.4 Hybrid response optimization

Evaluate deterministic/cached/retrieval-backed response paths with live generation fallback. Add
only after response-path quality, latency, and cost can be measured.

### 6.2 Real-scenario validation

Run a representative AVA scenario through authoring, operator, and multi-session quality workflows.
Capture concrete product gaps rather than adding speculative platform features.

### 6.3 Prototype delivery

Package a stakeholder-ready scenario, Core, back-office workflow, deployment path, and handoff guide.

## Backlog rules

- A new epic must be a coherent, testable product increment with a user-facing outcome.
- Merge overlapping backlog items instead of creating parallel names.
- Move completed detail to code/tests and keep this file at milestone level.

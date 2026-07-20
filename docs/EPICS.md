# EPICS

## Purpose

Compact roadmap and delivery ledger for major product increments.

- `ARCHITECTURE.md` defines structural boundaries.
- `PROJECT_STATUS.md` describes the current shipped platform.
- Contract details belong in `API_CONTRACT.md`, `GAME_MASTER_CONTRACT.md`, and `MEMORY_SYSTEM_SPEC.md`.

As of 2026-07-20, the Phase A core roadmap is complete through EPIC 8.4.

## Shipped EPICS

### Foundations

- `1.1 Core Platform Bootstrap`: monorepo, Docker runtime, Postgres + pgvector + Redis, strict TypeScript, CI, base module boundaries.
- `1.2 First LLM Loop + Observability`: provider abstraction, `/v1/exchange`, request tracing, latency/token metrics.

### Core Conversation Runtime

- `2.1 Avatar Agent v1`: direct avatar replies with persona-driven multi-turn conversation.
- `2.1b Avatar Agent v2`: persona, memory, and retrieval-aware avatar context.
- `2.2 Scenario & Session Lifecycle v1`: scenarios, avatars, sessions, conversations, history, reset flow.
- `2.2b Conversation Lifecycle v2`: explicit conversation end plus memory-compaction trigger.
- `2.3 Persistence Layer v1`: durable Postgres repositories and migrations for core entities.
- `2.4 Manual Test Console v1`: initial internal UI for scenario/avatar/session testing.
- `2.5 Admin CRUD + Console Integration`: full admin CRUD flows for scenarios, avatars, and sessions.
- `2.6 GM Debug Panel v1 + Observability APIs`: safe GM inspection endpoints and runtime debugging UI.
- `2.7 Runtime Inspector v2`: unified inspection for context, memory, events, transitions, and metrics.
- `2.8 Console Debugging Redesign`: consolidated debugging shell and clearer operator workflows.

### Operations And Runtime Control

- `3.1 Operational Health & Dependency Monitoring`: dependency probes and admin health surface.
- `3.2 Inspector Consolidation & Contract Cleanup`: canonical inspector DTO ownership and route consolidation.

### Orchestration, Memory, And Runtime State

- `4.1 Async Game Master v1`: non-blocking GM execution, unlock logic, routing decisions, safe observability.
- `4.1c Multi-Model Runtime Configuration`: global, role, scenario, and avatar model selection with deterministic precedence.
- `4.2 Memory Layer v1`: user memory facts plus prompt injection.
- `4.2b Memory System v2`: working memory and async maintenance pipeline.
- `4.2c Memory System v3`: episodic memory, hydration, deterministic memory selection, debug visibility.
- `4.3 Performance Baseline`: per-turn latency/token metrics and admin metrics reporting.
- `4.4 Multi-Avatar Navigation v1`: unlockable avatars, switching, and session-scoped availability.
- `4.5 Runtime State & World Events`: session runtime-state endpoint and SSE event stream.

### Knowledge And Context

- `5.1 Multi-Layer Knowledge & RAG System v1`: typed knowledge ingestion, chunking, retrieval, and admin diagnostics.
- `5.1b Avatar-Scoped Knowledge Visibility`: avatar-filtered retrieval with GM omniscience and visibility diagnostics.
- `5.2 Context Engine v2`: deterministic context assembly, precedence rules, trimming, and trace output.
- `5.5 User Persona System`: persisted user persona injected into avatar and GM flows.

### Authoring And User Surfaces

- `6.1 Scenario Builder v1`: scenario/avatar editors, knowledge-source authoring, visibility policy, model selection, audit remediation.
- `7.1 Public User Web App v1`: browser-owned identity, scenario discovery, available-avatar chat flow, SSE-driven updates.

### Phase A Refinements

- `8.1 Avatar Trait Structuring`: explicit scenario-scoped avatar-trait preparation and canonical `computedTraits`.
- `8.2 Runtime Context Assembly Refactoring`: structured runtime context sections and trait-aware avatar prompt assembly.
- `8.3 Game Master Prompt Refinement`: explicit GM prompt structure and stronger decision-policy guidance.
- `8.4 Working Memory Prompt Refinement`: structured working memory with `coveredTopics` and aligned operator surfaces.

## Remaining Backlog

- `3.3 Replay & Recovery Tools`: partially covered by GM replay, memory refresh/clear, and audit/error endpoints; not closed as a standalone milestone.
- `5.3 Streaming UX Layer`: runtime SSE exists for state changes, but token streaming for avatar replies is not shipped.
- `5.4 Guided Progression Engine v1`: no standalone progression engine yet beyond GM heuristics and scenario goals.
- `5.6 Hybrid Response System v2` and `6.4 Hybrid Response Optimization v1`: still open; should be merged if implemented.
- `6.2 AVA Scenario Validation`: real-scenario validation milestone is not recorded complete.
- `6.3 Summer Prototype Delivery`: delivery/demo milestone is not recorded complete.

## Superseded Or Absorbed Items

- `4.1b Game Master Context Awareness Upgrade`: do not reopen as a separate epic unless the scope changes. Its intended outcome is already covered by `5.1`, `5.1b`, `5.2`, `8.3`, and `8.4`.

## Future-Use Rules

- Use a new epic only for a coherent, testable product increment.
- Keep execution details out of this file; implementation history belongs in commits, PRs, and focused design docs.
- When an epic is absorbed by later work, mark it as such instead of duplicating the same scope under multiple headings.

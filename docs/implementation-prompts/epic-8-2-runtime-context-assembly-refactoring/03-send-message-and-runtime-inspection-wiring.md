# Wire Runtime Assembly Through Send Message And Inspection

# Context

The production Avatar turn path is coordinated by `SendMessageUseCase`: it loads the Avatar, scenario, user persona, selected memory, typed retrieval, and GM notes; passes them through `ContextEngine`; then builds the LLM system prompt.

EPIC 8.2 is incomplete if the prompt service works in isolation but the normal send-message path does not provide `computedTraits`, world context, or the structured runtime sections consistently. Existing runtime inspection and event projections must also remain truthful and must not leak prompt content.

# Scope

Implement now:

- wire the EPIC 8.2 context output into the normal `SendMessageUseCase` path;
- ensure the loaded Avatar runtime config carries the canonical `computedTraits` value from EPIC 8.1;
- pass the selected context sections to the single prompt assembly path;
- preserve bounded selection, retrieval visibility, GM background execution, and response latency behavior;
- update existing runtime inspector/event mappings only as needed to explain the new selected sections or trait presence.

Out of scope:

- new HTTP endpoints;
- changes to session lifecycle or Game Master decisions;
- changes to memory maintenance or retrieval algorithms;
- raw prompt storage in event logs or admin responses;
- new editable trait or prompt UI.

# Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`
- `apps/core/src/application/use-cases/send-message/send-message.use-case.ts`
- `apps/core/src/application/use-cases/send-message/send-message.context-engine.ts`
- `apps/core/src/application/use-cases/send-message/send-message.context-selection.ts`
- `apps/core/src/application/services/runtime-inspector-event-context.ts`
- `apps/core/src/application/services/runtime-inspector-event-context.test.ts`
- `packages/shared/src/runtime-inspector-types.ts`
- `apps/console/src/api/runtime-inspector.ts`
- `apps/console/src/components/RuntimeInspector.tsx`

# Implementation Guidance

- Trace the complete production path from `SendMessageUseCase.buildTurnPromptContext` to `buildSendMessageLlmRequest`. Remove any parallel prompt input construction introduced by the refactor.
- Load and pass `computedTraits` from the canonical Avatar repository/domain type. Do not read it from an ad-hoc `config` key if EPIC 8.1 provides a dedicated field.
- Keep the scenario snapshot as the source of scenario-level world context and objectives. Do not use the Avatar trait object as a substitute for scenario data.
- Ensure absent traits are represented consistently at the internal boundary (`undefined` where internal optionality is established) and mapped to the existing fallback behavior at prompt assembly.
- Preserve retrieval inputs exactly as selected by `ContextEngine`, including avatar visibility filtering, typed memory/world/media grouping, and the separate unrestricted GM projection.
- Preserve the non-blocking background dispatch of GM and memory maintenance. The Avatar response must not wait for EPIC 8.2 diagnostics or trait work.
- If runtime trace contracts change, expose only bounded metadata such as section presence, selected/trimmed segment IDs, counts, and trait availability. Never add raw system prompt, trait content, provider credentials, or hidden retrieval text to events.
- Update console/admin adapters only when shared DTOs require it. Keep them consumer-only and reuse canonical shared types.

# Constraints

Respect:

- API -> Application -> Domain -> Infrastructure boundaries;
- existing latency and async guarantees;
- existing event envelope and nullability conventions;
- no prompt content leakage through observability;
- no new API route and no stack-e2e file unless implementation unexpectedly introduces an endpoint, in which case the endpoint-owning slice must create its required stack-e2e coverage.

# Deliverables

- end-to-end send-message wiring for structured runtime context and traits;
- updated internal/shared runtime inspection contracts only where necessary;
- updated mapping and adapter tests;
- proof that the standard Avatar turn uses traits when present and fallback data when absent;
- proof that trace/event payloads remain bounded and content-safe.

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs move together.

# Acceptance Criteria

- [ ] The normal send-message path supplies computed traits to prompt assembly when available.
- [ ] The normal send-message path still works for avatars without computed traits.
- [ ] World, retrieved, user, memory, and directive inputs remain sourced from their existing canonical paths.
- [ ] Context selection and prompt assembly remain deterministic and bounded.
- [ ] GM and memory background work remains asynchronous and non-blocking.
- [ ] Runtime traces and events expose bounded selection metadata without raw prompt or sensitive content.
- [ ] Existing admin/console runtime inspection tests remain green or are updated to the intentional contract change.
- [ ] Documentation is reviewed or updated before the slice is considered complete.

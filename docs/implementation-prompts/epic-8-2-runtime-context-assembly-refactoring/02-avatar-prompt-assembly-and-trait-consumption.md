# Refactor Avatar Prompt Assembly Around Runtime Priority

# Context

`apps/core/src/domain/avatar/persona-prompt.service.ts` currently emits a persona-first prompt and appends Response Rules and Director Notes near the end. This makes current-turn instructions compete with large static persona text.

EPIC 8.1 provides a fixed `computedTraits` structure. EPIC 8.2 must consume it as structured Avatar identity input while preserving a safe fallback for avatars whose traits are not prepared yet.

# Scope

Implement now:

- refactor Avatar prompt assembly to emit the target runtime order;
- consume `computedTraits` directly when available;
- render the seven trait fields as concise, stable, labeled sections;
- retain the existing authored `personaPrompt` as a compatibility fallback when traits are absent or null;
- preserve existing adjustments, tone/name behavior, Avatar awareness, memory, user persona, world context, and typed retrieval semantics unless their placement changes under the EPIC order.

Out of scope:

- generating, validating, editing, or scoring traits;
- changing the EPIC 8.1 trait field names or array/object shape;
- rewriting the authored persona source;
- changing RAG retrieval or memory maintenance;
- introducing a second prompt builder or provider-specific behavior.

# Relevant Docs

- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`
- `apps/core/src/domain/avatar/persona-prompt.service.ts`
- `apps/core/src/domain/avatar/persona-prompt.service.test.ts`
- `apps/core/src/domain/avatar/avatar.types.ts`
- `apps/core/src/domain/avatar/avatar-awareness.service.ts`

# Implementation Guidance

- Keep one canonical `assemblePersonaPrompt` path. Do not create separate legacy and traits builders that can drift.
- Assemble sections in this order:
  - `## Director Notes`
  - `## Response Rules`
  - `## Conversation State`
  - `## User Persona`
  - `## World Context`
  - `## Retrieved Context`
  - `## Avatar Traits`
- Omit empty optional sections rather than emitting misleading empty headings, except where an existing contract requires a stable section.
- Put working memory, current conversation summary, recent bounded exchanges, and any existing active-turn state under `Conversation State`. Do not replay the full transcript.
- Put scenario-level facts under `World Context`. Keep retrieved memory/world/media snippets under `Retrieved Context` with their existing typed labels.
- Render traits in the fixed order: Identity, Personality, Speaking Style, Background, Timeline, Current Situation, Behavioural Rules. Preserve concise array items; do not join them into an unbounded rewritten persona.
- When `computedTraits` exists, do not inject the full raw `personaPrompt` as an additional competing identity block. Preserve only compatibility metadata such as name/tone when it is not already represented, and keep Response Rules separate.
- When traits are absent or null, render the existing `personaPrompt` at the Avatar Traits/static identity position so older avatars continue to work. Keep the fallback behavior explicit in tests.
- Preserve the existing default response style rules and administrator adjustments in `Response Rules`, but do not let them be appended after Director Notes.
- Preserve Avatar awareness. Because it is not a separate target section, place it in the smallest semantically correct existing section and document the choice; never silently drop availability, scope, or locked-avatar behavior.
- Keep prompt assembly deterministic for identical inputs. Do not add LLM calls, randomization, or provider-specific formatting.

# Constraints

Respect:

- current domain ownership of prompt assembly;
- the fixed EPIC 8.1 trait schema;
- bounded context and no full transcript replay;
- no raw provider names, models, or credentials in domain code;
- compatibility for unprepared and legacy avatars;
- no behavior changes beyond section grouping/order and structured trait preference.

# Deliverables

- refactored `assemblePersonaPrompt` implementation;
- stable rendering for all seven computed trait fields;
- explicit null/missing-traits fallback;
- updated persona prompt unit tests covering exact section order, trait preference, fallback, optional sections, and deterministic output;
- any narrowly required type/fixture updates.

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

- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs move together.

# Acceptance Criteria

- [ ] Director Notes appear before Response Rules and static Avatar identity.
- [ ] Response Rules appear before Conversation State and Avatar Traits.
- [ ] Conversation State, User Persona, World Context, Retrieved Context, and Avatar Traits are visibly separate.
- [ ] Prepared avatars use `computedTraits` as the preferred identity input.
- [ ] Unprepared or legacy avatars still produce a valid prompt using `personaPrompt`.
- [ ] All seven trait fields are rendered in stable order without a large rewritten persona dump.
- [ ] Existing memory, retrieval, Avatar awareness, adjustments, and default response rules remain functional.
- [ ] Prompt assembly is deterministic and covered by focused unit tests.
- [ ] Documentation is reviewed or updated before the slice is considered complete.

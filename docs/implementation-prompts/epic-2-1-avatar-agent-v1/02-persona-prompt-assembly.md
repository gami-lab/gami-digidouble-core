# 02 — Persona Prompt Assembly Service

## Context

With `AvatarConfig` now defined (Prompt 01), the next step is building the domain service that turns a config into a runtime LLM system prompt.

This is pure, deterministic domain logic: given an `AvatarConfig`, produce a `string` that will be used as the `systemPrompt` for every LLM call in a session. No I/O. No side effects. Fully testable.

The service lives in `domain/avatar/` and is the single place where persona parameters become prompt text. It must never be bypassed.

## Scope

**In scope:**

- `PersonaPromptService` — a domain service (plain class or set of pure functions) that assembles a persona system prompt from `AvatarConfig`
- Clear rules for how each field contributes: `personaPrompt` is the base; `tone` is appended as a behavioral modifier; `name` is referenced for self-identification; optional persona adjustments from `config`
- Exported assembly function usable by the application layer
- Unit tests covering all assembly rules and edge cases

**Out of scope:**

- Dynamic prompt modification based on conversation history (EPIC 4.2 — Context Manager)
- Game Master directive injection into the prompt (EPIC 2.2)
- Few-shot examples embedded in the prompt (not needed for MVP)
- Prompt versioning or template systems

## Relevant Docs

- `docs/ARCHITECTURE.md` — domain layer rules; no infrastructure imports allowed
- `docs/PRINCIPLES.md` — principle 7: "System Prompt is a First-Class Product Asset"; prompt assembly is not incidental code
- `docs/DATA_MODEL.md` — Avatar entity and config JSONB shape
- `docs/TECH_STACK.md` — TypeScript strict mode, ESLint limits

## Implementation Guidance

### Location: `src/domain/avatar/persona-prompt.service.ts`

The service takes an `AvatarConfig` and returns a `string`.

**Assembly rules (implement in this order):**

1. **Base persona**: `config.personaPrompt` is the starting block — it defines who the avatar is, their role, their knowledge scope, and behavioral rules. It is used as-is; do not wrap or reformat it.

2. **Name identification**: Optionally append a short statement so the model knows how to refer to itself: `"Your name is ${config.name}."` — only if the personaPrompt does not already reference the name.

3. **Tone modifier**: If `config.tone` is set, append a directive: `"Your tone is ${config.tone}."` This must appear after the base persona so it cannot override core behavioral rules.

4. **Language/style rule**: Append a consistent rule about response behavior — e.g., avoid breaking character, stay concise. Keep this short and general. Do not over-specify.

5. **Future extension point**: Leave a clear comment noting where Game Master directives will be injected (EPIC 2.2) — after tone, before closing rule.

**Important:** The resulting prompt must be a single coherent string. No JSON, no XML, no special delimiters. The LLM receives it as the `system` role message.

### What to export

Export a `PersonaPromptService` class with a single `assemble(config: AvatarConfig): string` method, or equivalently a standalone `assemblePersonaPrompt(config: AvatarConfig): string` function. Prefer the function form if the service has no state — a stateless class adds no value.

### Unit test expectations

Tests must cover:

- `personaPrompt` always appears in the output
- `name` appears in the output when provided
- `tone` appears in the output when provided
- output is a single non-empty string (not JSON, not undefined)
- output with minimal config (only `personaPrompt` set) does not throw
- output with full config is stable (deterministic — same input = same output)
- no infrastructure imports leak into the service

## Constraints

- Zero imports from `application/`, `infrastructure/`, or external libraries
- Zero I/O — this function must be callable synchronously
- TypeScript strict: return type must be `string`, explicitly declared
- Output must be deterministic — no timestamps, no random elements, no calls to `Date.now()`
- `max-lines-per-function` ≤ 50 — split into sub-functions if assembly grows too long
- If `personaPrompt` is an empty string, treat it as a domain invariant violation — throw an appropriate descriptive error, not a silent fallback

## Deliverables

- `src/domain/avatar/persona-prompt.service.ts` (or `.ts` function file — name clearly)
- Unit tests: `src/domain/avatar/persona-prompt.service.test.ts`
- All assembly rules tested independently

## Mandatory Final Step — Documentation Update

After implementation, verify:

- `docs/PROJECT_STATUS.md` — confirm EPIC 2.1 / Prompt 02 progress noted
- `docs/PRINCIPLES.md` — confirm principle about system prompt as first-class asset is still accurate relative to the implementation

## Acceptance Criteria

- [ ] `assemblePersonaPrompt(config)` (or equivalent) exists and returns a string
- [ ] `personaPrompt` content always appears verbatim in the output
- [ ] `name` and `tone` fields, when present, influence the output in predictable, testable ways
- [ ] Empty `personaPrompt` throws a clear domain error
- [ ] Function is deterministic: same config → same output
- [ ] No imports from outside `domain/`
- [ ] All unit tests pass
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass

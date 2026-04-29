You are an expert TypeScript architect reviewing a strict TypeScript modular monolith.

Context:
The project is API-first, headless, TypeScript-only, and uses a layered architecture:

- api/ for HTTP routes, validation, DTO mapping
- application/ for use cases and ports
- domain/ for business/domain types
- infrastructure/ for adapters/repositories
- apps/console as an external HTTP API consumer
- packages/shared exists and may contain reusable API/shared types

Problem:
A recent field addition (`availabilityKey` on Avatar) required touching many duplicated type definitions:

- API request/response DTOs
- application input/output types
- domain Avatar / AvatarConfig types
- console API client types
- fixtures / seed scenario definitions
  This suggests contract duplication and DRY violations.

Task:
Create a new audit document:

docs/implementation-prompts/refactor-prompts/TYPE_CONTRACT_AUDIT.md

The audit must identify duplicated or drifting TypeScript model contracts across the codebase.

Scope:
Audit at least these models:

- Avatar
- Scenario
- Session
- Conversation
- Message
- GameMasterInput / GameMasterOutput
- Admin session inspection / events if relevant

Instructions:

1. Search the codebase for repeated type/interface definitions representing the same entity or API shape.
2. For each model, list:
   - files where related types are defined
   - duplicated fields
   - fields that differ by name, optionality, literal union, or nullability
   - whether the duplication is legitimate boundary mapping or unnecessary duplication
   - risk level: low / medium / high
3. Pay special attention to create/update/list/get response types.
4. Identify whether `packages/shared` is currently underused.
5. Recommend a source-of-truth strategy:
   - domain-first types
   - shared API contract types
   - schema-first with Zod
   - or a hybrid approach
6. Do not refactor code yet.
7. Do not introduce new dependencies yet unless the audit strongly justifies them.
8. Keep the audit practical and actionable.
9. Include a prioritized refactoring plan:
   - Phase 1: safest/highest impact
   - Phase 2: broader cleanup
   - Phase 3: optional tooling/automation
10. Add acceptance criteria for the future refactor.

Constraints:

- Preserve clean architecture boundaries.
- Do not make the API layer depend on infrastructure.
- Do not make the console import backend internals directly.
- Prefer boring predictable structure over clever abstractions.
- Keep KISS/YAGNI.
- All changes after the audit must be compatible with:
  pnpm format:check
  pnpm lint
  pnpm typecheck
  pnpm test

Output:
Only create/update docs/implementation-prompts/refactor-prompts/TYPE_CONTRACT_AUDIT.md.
Do not modify implementation files.

# Create Modular Monolith Skeleton and Layer Boundaries

## Context

EPIC 1.1 is not complete without a concrete code skeleton aligned to the target architecture. This prompt creates the baseline module structure so future implementation work lands in the right place from day one.

## Scope

What must be implemented now:
- Create initial `src/` structure aligned with API, Application, Domain, Infrastructure layers.
- Add placeholder module directories for conversation, avatar, game-master, memory, context, knowledge, and scenario.
- Add minimal interface contracts (ports) to demonstrate dependency direction.
- Add a basic Fastify bootstrap entrypoint wired to health endpoint only.

What is out of scope:
- Full endpoint implementations.
- Real business logic for avatars or game master.
- Provider-specific LLM integrations.
- Complex eventing or background job infrastructure.

## Relevant Docs

- `docs/ARCHITECTURE.md` (target layer and module map)
- `docs/EPICS.md` (EPIC 1.1 base module structure)
- `docs/TECH_STACK.md` (Fastify, TypeScript strict)
- `docs/GAME_MASTER_CONTRACT.md` (future domain boundary awareness)
- `docs/API_CONTRACT.md` (future API envelope awareness)
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Mirror the architecture module map directly in folders to reduce ambiguity.
- Enforce one-way dependencies:
  - API -> Application -> Domain -> Infrastructure.
- Add minimal placeholder types/interfaces demonstrating infrastructure abstraction (for example repository and llm ports).
- Add simple health endpoint in API layer to prove bootstrap wiring.
- Add startup-time configuration loading with validation for required env values.
- Include skeleton-level tests (or smoke tests) validating app boot and health endpoint response.

Avoid fake domain behavior; placeholders should be clearly intentional and minimal.

## Constraints

Respect:
- Layer isolation and explicit interfaces.
- KISS and YAGNI (no speculative complexity).
- DRY naming and folder conventions.
- Backward compatibility with planned EPIC 1.2 and 2.x flows.
- Explicit contracts and strict typing.

## Deliverables

- Base `src/` layered directory structure.
- Initial Fastify app bootstrap with health route.
- Placeholder domain/application interfaces for future extension.
- Minimal smoke test verifying service boots.

## Mandatory Final Step — Documentation Update

After implementation, review and update:
- `docs/PROJECT_STATUS.md`
- Any impacted outdated docs, especially:
  - `docs/ARCHITECTURE.md`
  - `docs/API_CONTRACT.md` (if health endpoint or envelope assumptions were added)
  - `docs/TECH_STACK.md`
  - `README.md`

If no doc changes are needed, explicitly verify docs are still accurate.

## Acceptance Criteria

- Layered folders exist and match architecture map.
- Dependency direction is enforceable by structure and imports.
- Service starts and serves a health endpoint.
- Placeholder interfaces are explicit and compile under strict TypeScript.
- Smoke test passes locally.
- Documentation is synchronized with actual skeleton.

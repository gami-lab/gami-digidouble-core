# Build the Evaluation Tool Foundation

## Context

EPIC 8.6 needs a repeatable local command, not a UI or a new Core runtime module. The repository is
a pnpm/Turborepo TypeScript monorepo, so the evaluator should be an isolated workspace tool that
can reuse shared wire contracts while keeping its report format owned by the tool.

The original EPIC leaves JSON versus YAML open. Choose JSON for v1: it is already supported by the
runtime, requires no new parser dependency, is easy to version, and keeps the first evaluation loop
small.

## Scope

In scope:

- create a dedicated `tools/conversation-evaluation` workspace package and register `tools/*` in
  `pnpm-workspace.yaml` if required by the chosen layout;
- define strict TypeScript types and runtime validation for a JSON test definition;
- implement CLI/environment configuration for definition path, Avatar API base URL, API key,
  optional judge base URL, output path, timeout, and optional user ID;
- document the model fields as declared/expected model metadata, not request-level overrides;
- generate a unique run-scoped user ID by default so repeated runs do not unintentionally share
  memory, while allowing an explicit user ID for controlled continuity tests;
- expose a small foundation API that later prompts can use without coupling to CLI parsing.

Out of scope:

- HTTP calls or LLM judge execution;
- report aggregation beyond the types needed by later prompts;
- YAML support or new UI surfaces;
- changing Core model resolution or API contracts.

## Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`
- `docs/CONTEXT_CONTRACT_OWNERSHIP_MAP.md`
- `docs/implementation-prompts/epic-8-6-scripted-conversation-response-evaluation/00-contract-cleanup.md`

## Implementation Guidance

- Use the existing workspace conventions and strict compiler settings. Reuse the existing `tsx`
  approach used by repository scripts rather than adding a new runtime framework.
- Keep the definition readable and versionable. It should contain at least `name`, `scenarioId`,
  one initial-avatar selector (`initialAvatarId` or unique `initialAvatarName`), an optional model
  declaration, optional `judgeModel`, and an ordered non-empty `questions` array.
- Each question should contain `question` and `expectedResponse`. Preserve the expected response
  as criteria text; do not interpret it as an exact string.
- Validate unknown top-level fields, empty strings, empty question arrays, duplicate/ambiguous
  initial-avatar selectors, and malformed model metadata before any network request.
- Keep secrets out of JSON definitions. Resolve API keys from a CLI flag or environment variable,
  and make error messages safe to print.
- Define report/status types now so later slices can distinguish `completed`, `api_error`, and
  `judge_error` without treating every non-pass as a quality failure.
- Keep declared model metadata separate from observed model metadata. The tool may warn or record a
  mismatch, but it must not mutate server configuration.

## Constraints

- TypeScript strict mode; no `any` and no provider SDK imports.
- No YAML dependency for v1.
- No direct database, Redis, Langfuse, or Core-internal repository access.
- No new HTTP endpoint.
- Keep the package standalone and usable from a local shell.
- Follow KISS/YAGNI: no plugin system, schema registry, dashboard, or historical database.

## Deliverables

- `tools/conversation-evaluation/package.json` and workspace registration as needed.
- Strict definition/config/report type modules and runtime validation.
- A documented CLI entry point with safe configuration loading.
- Unit tests for valid definitions, missing fields, invalid selectors, duplicate questions if
  disallowed by the chosen contract, and secret-safe configuration errors.
- Package-level README or usage section sufficient for prompt 04 to expand.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: test definition, evaluation report, and consumed shared API DTOs.
2. Search for duplicated type definitions, repeated inline response shapes, local copies in
   console/client code, inconsistent optionality/nullability, and field-name drift.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible; keep evaluation-only types local to the tool.
5. If no canonical owner exists, create one before adding another shape.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required
- `docs/ARCHITECTURE.md` if the new tool workspace needs a boundary entry
- `docs/TECH_STACK.md` if workspace/runtime tooling changed
- `docs/TEST_STRATEGY.md` and `docs/TEST_COVERAGE_PLAN.md` if a new test package/tier is introduced
- `docs/API_CONTRACT.md` only if consumed contract facts changed
- `docs/DATA_MODEL.md` only if persisted data semantics changed
- `docs/EPICS.md` only if the EPIC status/scope changed

If no doc changes are needed beyond `PROJECT_STATUS.md`, explicitly verify that the current docs
remain accurate. Code, tests, and docs move together.

## Acceptance Criteria

- [ ] A JSON definition can be loaded and validated without network access.
- [ ] The definition has a deterministic initial-avatar selector.
- [ ] API keys are never required in the definition file or printed in validation errors.
- [ ] Model declarations are metadata/verification inputs, not hidden runtime overrides.
- [ ] Report types distinguish quality failures from API/judge errors.
- [ ] The tool package follows the repository's strict TypeScript and pnpm conventions.
- [ ] Foundation tests and quality checks pass.
- [ ] Documentation accuracy is explicitly verified.

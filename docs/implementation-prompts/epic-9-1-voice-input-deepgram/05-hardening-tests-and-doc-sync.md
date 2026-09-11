# Harden Voice Input, Verify Boundaries, And Synchronize Documentation

## Context

Voice input crosses untrusted binary input, an external provider, conversation persistence, SSE
streaming, observability, and existing async GM/memory behavior. The final slice turns the feature
definition into release evidence and removes any contract, security, or documentation drift left by
Prompts 01–04.

## Scope

Perform a focused end-to-end audit and make only the fixes required to satisfy Epic 9.1.

Cover:

- exact-once user-turn behavior under repeated utterance IDs and concurrent duplicate requests;
- no partial persistence or GM/memory scheduling after transcription or stream cancellation;
- invalid audio, unsupported media, byte/duration/transcript limits, provider timeout/failure, malformed result, and unavailable-voice behavior;
- safe observability assertions for audio duration, latency, outcome, failure category, and correlation IDs, with no raw audio, transcript, credentials, or provider payloads;
- sync and stream contract compatibility, including existing text routes;
- deterministic unit, route/integration, and stack-E2E test coverage with environment-gated live Deepgram checks;
- typecheck, lint, formatting, build, targeted tests, and the repository's full applicable test commands;
- documentation and Epic status sync based on what is actually implemented, not what was planned.

Out of scope:

- new voice output, full-duplex, barge-in, recording retention, UI microphone capture, or unrelated refactors;
- changing provider, model, or persistence architecture without evidence from the verification pass.

## Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`
- all Epic 9.1 prompt files in this directory

## Implementation Guidance

- Start with a read-only diff and contract audit. Confirm no duplicate `Message`, session, conversation, Avatar, Scenario, or response types were introduced in shared, Core, console, web, admin, or evaluation code.
- Exercise the real application composition with deterministic fakes first. Run the live stack-E2E suite when the app stack is available; record environment limitations rather than weakening mandatory test files.
- Add a requirements-to-tests checklist if the feature has multiple independent failure categories. Keep it focused on Epic 9.1 and do not create a broad audit document without need.
- Verify that any new errors use the standard `ApiResponse` envelope and existing error-code vocabulary. Ensure status mapping does not expose provider details.
- Inspect logs, event payloads, observability calls, and thrown errors for audio bytes, transcript content, API keys, SDK response bodies, and unbounded metadata. Add redaction tests at the actual consumer boundary.
- Verify text fallback semantics: the existing text routes remain operational when Deepgram is disabled, unconfigured, timed out, or temporarily unavailable. Do not invent a transcript fallback.
- Update documentation only after the implementation and tests establish the final behavior. Mark Epic 9.1 complete only if every definition-of-done item is proven.

## Constraints

- Keep changes surgical and directly traceable to Epic 9.1.
- Preserve the Core's headless/product-agnostic boundary; do not add browser or audio playback code.
- Preserve existing Avatar, Game Master, memory, and streaming contracts.
- Do not commit secrets or modify real `.env` credentials.
- Treat a skipped live provider or unavailable stack as an explicit environment limitation, never as a passing success-path claim.

## Deliverables

- Any final hardening fixes required by the audit.
- Complete deterministic test matrix and required stack-E2E coverage.
- Verification results for targeted tests, typecheck, lint, format, build, and applicable integration/stack suites.
- Accurate updates to all impacted source-of-truth docs.
- A concise final test/limitation note in the implementation handoff or commit context if the repository convention supports it.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify every touched entity/contract and compare the final implementation against the canonical Message, Session, Conversation, Avatar, Scenario, GM, and admin DTO owners.
2. Search for duplicated type definitions, repeated inline response shapes, local copies in console/client/evaluation code, inconsistent optionality/nullability, and field-name drift across layers.
3. Identify the canonical owner of each remaining contract and remove only duplication introduced by Epic 9.1.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one; do not add a second local copy.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` (always required)
- `docs/API_CONTRACT.md` for final routes, headers, limits, response/error/cancellation behavior
- `docs/ARCHITECTURE.md` for final port, adapter, application, and API ownership
- `docs/DATA_MODEL.md` if any idempotency or other persistence was introduced
- `docs/TECH_STACK.md` and deployment docs for Deepgram dependency/configuration
- `docs/TEST_STRATEGY.md` and `docs/TEST_COVERAGE_PLAN.md` for voice and stack-E2E obligations
- `docs/EPICS.md` to record Epic 9.1 progress/completion accurately
- `docs/GAME_MASTER_CONTRACT.md` or `docs/MEMORY_SYSTEM_SPEC.md` only if their behavior or ownership changed; otherwise verify they still state the correct unchanged semantics

If no doc changes are needed beyond `PROJECT_STATUS.md`, explicitly verify that each impacted doc is still accurate. Code, tests, and docs move together.

## Acceptance Criteria

- [ ] All Epic 9.1 definition-of-done items are mapped to passing tests or an explicit environment limitation.
- [ ] No duplicate contract or inline response shape remains from the voice implementation.
- [ ] Existing text, sync, stream, GM, memory, and persistence regression tests pass.
- [ ] New voice unit/route/integration/stack-E2E tests cover success, auth, validation, not-found, cancellation, duplicates, limits, typed failures, and redaction.
- [ ] Typecheck, lint, formatting, build, and applicable test suites pass; skipped live checks are clearly reported.
- [ ] No raw audio, transcript, credential, or provider payload is present in diagnostics.
- [ ] Text interaction continues to work without voice configuration.
- [ ] All required documentation is synchronized with the final implementation.

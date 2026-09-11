# Title

Implement The Text-To-Speech Port And Gradium Adapter

# Context

The Core accesses external providers through infrastructure adapters. EPIC 9.2 needs Gradium
support without coupling Avatar, Scenario, API, or web code to a provider SDK or provider-native
payloads.

This slice owns the replaceable TTS boundary, provider configuration, typed failures, bounded
audio validation, and deterministic fakes. It must work independently from message persistence and
turn orchestration.

# Scope

Implement now:

- an application port such as `ITextToSpeechAdapter` with a provider-neutral synthesis request and
  bounded audio result
- typed synthesis failures covering invalid request/configuration, unavailable provider,
  timeout, quota/rate limit, cancellation, unsupported format, and invalid provider output
- a `GradiumTextToSpeechAdapter` under infrastructure using the current official Gradium API/SDK
  contract; verify that contract at implementation time and document the chosen dependency
- provider-to-domain error mapping that excludes raw payloads and credentials
- AbortSignal propagation, request timeout, bounded response-size checks, and cleanup of provider
  response/body resources
- deterministic null/fake adapter wiring for unit, route, and stack-e2e tests without live
  Gradium credentials
- startup configuration for credentials, endpoint/adapter selection, timeout, and maximum output
  bytes using the repository's existing config patterns

Out of scope:

- Avatar/Scenario CRUD changes
- message lookup or audio route behavior
- browser playback
- audio persistence, transcoding, voice cloning, or lip synchronization

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`
- `docs/TEST_COVERAGE_PLAN.md`

# Implementation Guidance

- Keep the port in `apps/core/src/application/ports/**`; put Gradium implementation and provider
  request mapping in `apps/core/src/infrastructure/**`.
- The adapter input should contain only normalized cleaned text, resolved provider-neutral voice
  settings, requested output format, request identity, and cancellation/timeout context.
- Resolve the official Gradium request/response format before choosing a package. If no suitable
  maintained SDK is already allowed by `docs/TECH_STACK.md`, use a narrow infrastructure HTTP
  client rather than adding a broad dependency. Update package manifests and `TECH_STACK.md` when
  a dependency is genuinely required.
- Prefer a browser-compatible bounded format supported directly by Gradium. Do not add a new
  transcoding stack for the first increment.
- Validate content type, non-empty bytes, declared/observed size, and any duration/format metadata
  needed by the public delivery contract. Never pass raw provider JSON or audio payloads into logs.
- Use the existing observability port for safe synthesis outcome, latency, duration, byte count,
  format, and failure-category metadata. Do not include the full text by default.
- Add adapter tests with injected HTTP/SDK fakes for exact downstream fields, successful bytes,
  each mapped failure, timeout, abort, oversized output, malformed output, and cleanup.

# Constraints

- No provider SDK calls outside the Gradium infrastructure adapter.
- No Gradium names in domain contracts or web code.
- No raw credentials, provider payloads, or unnecessary response text in errors/logs/traces.
- Preserve the existing LLM adapter and text response flows.
- Do not make synthesis a prerequisite for text persistence or post-turn work.
- TypeScript strict mode; no `any`.

# Deliverables

- `ITextToSpeechAdapter` and provider-neutral request/result/error types
- Gradium adapter plus deterministic null/fake adapter
- configuration and composition-root wiring
- timeout, cancellation, byte-bound, and failure mapping tests
- dependency/config documentation updates required by the chosen implementation

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
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/API_CONTRACT.md` if adapter-visible public behavior is now documented
- `docs/TEST_STRATEGY.md` and `docs/TEST_COVERAGE_PLAN.md` if new provider/fake coverage rules are needed

If no doc changes are needed, explicitly verify that the docs are still accurate. Code, tests, and
docs move together.

# Acceptance Criteria

- [ ] All synthesis calls go through `ITextToSpeechAdapter`.
- [ ] Gradium request mapping is isolated and tested with explicit downstream field assertions.
- [ ] Typed failures distinguish timeout, quota/rate limit, unavailable provider, cancellation,
      unsupported format, and malformed/oversized output.
- [ ] Abort and timeout release provider/transport resources.
- [ ] Default tests run without Gradium credentials.
- [ ] Observability is bounded and secret-safe.
- [ ] Documentation has been reviewed and updated where needed.

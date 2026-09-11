# Implement The Deepgram Speech-To-Text Adapter

## Context

The Core now needs a replaceable production speech provider. Deepgram must be an infrastructure
detail behind the provider-neutral port from Prompt 01, with credentials and provider payloads
kept out of domain/application contracts and diagnostics.

## Scope

Implement the Deepgram adapter, configuration, production composition, and deterministic adapter
tests.

Include:

- the official Deepgram SDK or a narrowly scoped official HTTP client integration, selected after checking `docs/TECH_STACK.md` and existing dependency conventions;
- configuration for the Deepgram credential, model, timeout, accepted/default language behavior, and limits, with startup validation that matches the repository's `Config` pattern;
- provider request construction from the bounded port input, including MIME type, language, final utterance semantics, and cancellation signal where supported;
- validation of response shape, final transcript presence, transcript length, and provider-reported duration when available;
- translation to the finite provider-neutral failure model, including timeout/rate limit/provider rejection/malformed response without raw payloads;
- safe bounded observability for provider, model, audio duration, byte count, latency, outcome, and failure category only;
- production and test composition through `ServerAdapters` or the existing composition root, with a deterministic fake path that does not require credentials;
- focused unit tests using an injected fake Deepgram client/transport, plus an opt-in live smoke test only if the repository pattern supports it.

Out of scope:

- conversation persistence or turn orchestration;
- public route definitions;
- raw audio storage or logging;
- exposing Deepgram-specific options in shared/domain contracts;
- continuous streaming transcription, full duplex, or voice output.

## Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/TECH_STACK.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/PROJECT_STATUS.md`
- `docs/EPICS.md` (Epic 9.1)
- `apps/core/src/config.ts`
- `apps/core/src/infrastructure/llm/index.ts`
- `apps/core/src/infrastructure/knowledge/openai-embedding.adapter.ts`

## Implementation Guidance

- Follow the existing adapter factory and observed-adapter patterns, but do not force speech through `ILlmAdapter` or chat model selection.
- Keep the provider client injectable. Tests must assert the exact downstream request fields the provider needs and prove that cancellation reaches the client/transport.
- Use a bounded timeout and translate errors by category. Error messages returned to callers must be generic and safe; detailed provider diagnostics may be retained only as bounded category/status metadata.
- Treat Deepgram's finalized transcript as the only application result. If interim callbacks are supported, expose them only through an explicit optional internal callback/stream and prove they cannot reach message persistence.
- Never put API keys in shared types, logs, event payloads, thrown messages, or test fixtures. Update `.env.example`, Docker/Coolify configuration docs, and secret handling only as required; never modify or commit real `.env` secrets.

## Constraints

- Provider SDK calls exist only in Infrastructure.
- No hard-coded credentials, provider model IDs, or provider-specific branches in domain logic.
- No silent fallback from Deepgram to an invented transcript or an LLM.
- Preserve deterministic tests and existing null/provider composition behavior.
- Do not add a dependency without documenting why the current stack cannot provide the needed capability.

## Deliverables

- Deepgram adapter implementing the Prompt 01 port.
- Config fields/defaults and production factory wiring.
- Safe adapter error and observability mapping.
- Unit tests for request construction, success, empty/non-final response, malformed response, timeout, provider failure, cancellation, and secret/payload redaction.
- Optional environment-gated live smoke test, clearly skipped without credentials.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts, especially any transcript result that may be mapped to `Message` or `SendMessageResponse`.
2. Search for duplicated type definitions, repeated inline response shapes, local copies in console/client/evaluation code, inconsistent optionality/nullability, and field-name drift across layers.
3. Identify the canonical owner of each contract: shared HTTP DTOs, Core domain messages, application speech port, and infrastructure provider client.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one; do not add a second local copy.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/TECH_STACK.md` for the Deepgram dependency/provider boundary
- deployment/environment documentation and `.env.example` for new non-secret configuration
- `docs/ARCHITECTURE.md` if the adapter/composition map changed
- `docs/API_CONTRACT.md` only if the adapter changes a public contract
- `docs/TEST_STRATEGY.md` or `docs/TEST_COVERAGE_PLAN.md` if provider-test obligations changed
- `docs/EPICS.md` if the Epic status or delivered scope changed

If no additional documentation changes are needed, explicitly verify that the docs remain accurate.
Code, tests, and docs move together.

## Acceptance Criteria

- [ ] Production composition creates the Deepgram adapter only through Infrastructure and fails safely when required configuration is absent.
- [ ] The adapter sends bounded, validated inputs and returns only a validated finalized transcript.
- [ ] Timeout, cancellation, provider errors, malformed responses, and empty transcripts map to typed safe failures.
- [ ] No raw audio, transcript payload, credential, SDK error body, or secret appears in logs, traces, or event payloads.
- [ ] Tests use an injected fake transport/client and pass without Deepgram credentials or network access.
- [ ] Existing text/LLM provider composition remains unchanged.
- [ ] Documentation was reviewed and updated before declaring the slice complete.

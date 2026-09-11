# Title

Harden Voice Output And Synchronize The Repository

# Context

The EPIC is complete only when audio is a safe additive delivery capability, not merely when a
Gradium request succeeds once. This final slice closes the failure, cancellation, concurrency,
observability, compatibility, and documentation gaps across Core and web.

# Scope

Implement now:

- full deterministic coverage for cleaned-text fidelity, message association, text-first
  persistence, no audio persistence, provider failure fallback, repeated/concurrent synthesis,
  timeout, quota, cancellation, client disconnect, and provider-resource cleanup
- route contract coverage for binary headers, JSON error envelopes, auth, validation, not-found,
  bounded output, and backward-compatible text endpoints
- Gradium adapter fake/contract coverage without live credentials; keep any opt-in live smoke test
  clearly separated from the default suite
- observability assertions for synthesis latency, duration, format, byte count, outcome, and
  failure category, proving raw text/provider payloads/credentials are excluded
- configuration regression coverage for missing voice config, Avatar-over-Scenario resolution,
  supported formats, invalid values, and old records
- web regression coverage for text fallback, stale requests, aborts, object URL cleanup, and
  playback rejection
- lint, typecheck, focused tests, and the relevant integration/stack-e2e suites
- final documentation synchronization and EPIC ledger update

Out of scope:

- audio asset library, caching, CDN, video, lip sync, voice cloning, or a new media platform
- unrelated cleanup or refactoring
- changing the existing text turn semantics to wait for speech

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

- Review every changed contract from the consumer inward: what must the browser, route consumer,
  adapter, operator, and test harness observe? Assert those fields explicitly at each boundary.
- Verify that the canonical cleaned Avatar response is used exactly. Add a regression containing
  stage directions and presentation-only labels, and assert the adapter receives dialogue only.
- Verify failure isolation: a completed text turn remains persisted and usable when TTS fails;
  no partial audio or provider payload is written to message state or event logs.
- Verify iterator/body/reader/AbortSignal cleanup on all success, failure, timeout, cancellation,
  and disconnect paths. Verify concurrent requests do not share mutable buffers or stale UI state.
- Verify API error mapping is stable and recoverable, including quota/rate-limit and timeout
  statuses, while preserving the standard `ApiResponse` envelope.
- Inspect logs/traces/events manually or through tests for secret/raw-payload leakage. Keep only
  bounded synthesis diagnostics and correlation IDs.
- Re-run the repository's standard formatting, lint, typecheck, unit, integration, web, and stack-
  e2e commands appropriate to the changed packages. Do not weaken existing tests to accommodate
  voice output.
- Update `docs/EPICS.md` to mark `9.2 Voice Output Integration with Gradium` complete only if
  every definition-of-done item is actually met. If any provider or deployment prerequisite is
  intentionally deferred, record it as an explicit open item instead.

# Constraints

- No silent contract drift.
- No provider-specific leakage outside infrastructure.
- No raw credentials, raw provider payloads, or unbounded transcript/audio diagnostics.
- Existing text-only clients and routes remain unchanged.
- Keep the implementation small and removable if the provider changes.
- TypeScript strict mode; no `any`.

# Deliverables

- final focused hardening/regression tests across shared, Core, and web
- verified required `conversation-message-audio.stack-e2e.test.ts`
- clean lint/typecheck/test results or precise documented environmental blockers
- synchronized architecture/API/data-model/stack/testing/status/EPIC documentation
- updated `docs/PROJECT_STATUS.md` describing the shipped voice-output boundary and known limits

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md` if roadmap progress changed

If no change is needed in any listed document, explicitly verify that it remains accurate. Code,
tests, and docs move together. Do not call the EPIC complete while documentation is stale.

# Acceptance Criteria

- [ ] Text-first and failure-isolation invariants are proven by deterministic tests.
- [ ] Cancellation/disconnect/timeout paths clean up provider and browser resources.
- [ ] Concurrent/repeated requests are deterministic and do not cross-associate audio.
- [ ] Observability is useful, bounded, correlated, and secret-safe.
- [ ] New endpoint stack-e2e coverage meets the auth, validation, not-found, and success/TODO rule.
- [ ] Existing text-only route, stream, persistence, GM, memory, and web regressions pass.
- [ ] All required docs accurately describe the shipped system and known limits.
- [ ] EPIC 9.2 is marked complete only when the full definition of done is satisfied.

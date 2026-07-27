# EPIC 8.6 — Scripted Conversation Response Evaluation

## Objective

Add a small TypeScript command-line tool for repeatable, sequential evaluation of Avatar
conversations. A versioned JSON definition drives one session, an LLM judge evaluates each response
semantically through an existing API boundary, and the tool writes a machine-readable report plus a
human-readable summary.

This pack is aligned with the current repository rather than the original EPIC assumptions:

- the test definition selects an initial Avatar explicitly by ID or unique name because the current
  session API requires an Avatar to start a conversation;
- model selection remains owned by the server's existing avatar/scenario/global precedence, so the
  tool records and verifies effective models instead of adding a request-level override;
- current APIs expose latency and token counts, while cost is nullable and must remain explicitly
  unavailable when no API field supplies it;
- the judge uses the authenticated `/v1/exchange` boundary and never imports provider SDKs.

## Generated

July 27, 2026

## Prompt Files

| #   | File                                                                           | What it delivers                                                                         | Depends on |
| --- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ---------- |
| 00  | [00-contract-cleanup.md](00-contract-cleanup.md)                               | Contract ownership audit and cleanup for the API/client metrics boundary                 | —          |
| 01  | [01-tool-foundation-and-definitions.md](01-tool-foundation-and-definitions.md) | Evaluation workspace, JSON definition contract, validation, and CLI configuration        | 00         |
| 02  | [02-sequential-conversation-runner.md](02-sequential-conversation-runner.md)   | Authenticated Core API client and ordered single-conversation execution                  | 00, 01     |
| 03  | [03-judge-and-reporting.md](03-judge-and-reporting.md)                         | Semantic judge integration, result normalization, persistence, and console summary       | 01, 02     |
| 04  | [04-tests-fixtures-and-doc-sync.md](04-tests-fixtures-and-doc-sync.md)         | Full deterministic coverage, real-scenario example, hardening, and documentation closure | 00–03      |

## Suggested Execution Order

Execute `00 → 01 → 02 → 03 → 04`. Do not start runner or judge work until prompt 00 has
confirmed the canonical shared HTTP types and the cost-availability behavior.

Prompt 02 must finish before prompt 03 because the judge/report layer consumes the runner's
per-question execution records. Prompt 04 is last because it verifies the composed tool and closes
all documentation gaps.

## Dependencies

- Existing authenticated routes: `POST /v1/sessions`, `GET /v1/scenarios/{scenarioId}/avatars`,
  `POST /v1/sessions/{sessionId}/conversations`, `POST /v1/conversations/{conversationId}/messages`,
  and `POST /v1/exchange`.
- Canonical shared contracts in `packages/shared/src/`, especially `ApiResponse`,
  `SendMessageResponse`, `MessageMetadata`, `ScenarioSummary`, and `AvatarSummary`.
- Existing model-resolution behavior documented in `docs/API_CONTRACT.md`.
- Existing seeded scenario `murder-party-villa-miralac` and its initial Avatar name
  `Clara Whitcombe`.

No new HTTP endpoint is introduced by this EPIC. If implementation changes an existing route's
wire shape, the same EPIC must update that route's existing tests and stack-E2E coverage.

## Definition of Done

- [ ] A documented local command loads and validates a JSON test definition.
- [ ] The runner creates a fresh session, resolves the configured initial Avatar, and executes at
      least three questions sequentially through one conversation.
- [ ] Avatar API responses are parsed through canonical contracts and retain model, latency, token,
      and nullable cost metadata.
- [ ] The judge uses the existing authenticated raw-exchange boundary and returns validated,
      machine-readable semantic results.
- [ ] API failures, judge failures, and quality failures remain distinguishable.
- [ ] Partial reports are persisted without losing completed results.
- [ ] A readable console summary and a real seeded-scenario example exist.
- [ ] Unit/integration-style tests cover ordering, same-session reuse, paraphrase acceptance,
      missing facts, contradictions, malformed judge output, API errors, partial reports, and missing cost.
- [ ] `pnpm lint`, `pnpm typecheck`, relevant tests, and formatting checks pass.
- [ ] Code, tests, and docs move together; `docs/PROJECT_STATUS.md` and all impacted docs are accurate.

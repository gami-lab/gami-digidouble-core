# Conversation Evaluation

This package is the standalone local tooling boundary for EPIC 8.6 scripted conversation
evaluation. It owns definitions, semantic judge results, and local JSON reports, while Core HTTP
DTOs remain owned by `@gami/shared`.

## Definition format

Definitions are versioned JSON files. The v1 shape is:

```json
{
  "version": 1,
  "name": "Villa baseline",
  "scenarioId": "scenario_villa_miralac",
  "initialAvatarName": "Clara Whitcombe",
  "model": "openai/gpt-5.4",
  "judgeModel": "openai/gpt-5.4-mini",
  "questions": [
    {
      "question": "Avec qui es-tu monté au chalet ?",
      "expectedResponse": "Avec Emma, Léo et Ava.",
      "requiredFacts": [
        "Emma a participé au voyage",
        "Léo a participé au voyage",
        "Ava a participé au voyage"
      ],
      "acceptedAlternatives": [
        "Avec ma compagne Emma et mes enfants Léo et Ava",
        "Avec Emma et nos deux enfants Léo et Ava"
      ],
      "forbiddenClaims": ["Mona a participé au voyage vers le chalet"]
    }
  ]
}
```

To compare several Avatar models with the same questions, replace `model` with a `models` array:

```json
{
  "version": 1,
  "name": "Model comparison",
  "scenarioId": "scenario_villa_miralac",
  "initialAvatarName": "Clara Whitcombe",
  "models": ["openai/gpt-5.4", "openai/gpt-5.4-mini", "xai/grok-4.3"],
  "judgeModel": "openai/gpt-5.4-mini",
  "questions": [
    {
      "question": "Avec qui es-tu monté au chalet ?",
      "expectedResponse": "Avec Emma, Léo et Ava."
    }
  ]
}
```

Use exactly one of `initialAvatarId` or `initialAvatarName`. Exact duplicate question text is
rejected. `expectedResponse` is criteria text for a later semantic judge, not an exact-match
answer. `model` records the expected Avatar model for a single run. `models` is an explicit
comparison list; the evaluator runs the same definition once per provider/model selector and sends
that selector to Core for each Avatar request. Use `provider/model` notation such as
`openai/gpt-5.4`, `anthropic/claude-sonnet-4-6`, `mistral/mistral-small-4`, or `xai/grok-4.3`.
`model` and `models` cannot be used together. `judgeModel` selects the judge
model used for the raw exchange request; use `provider/model` notation such as
`openai/gpt-5.4-mini`, or a model name to use the Core-configured provider. If the observed response
reports a different effective model, the report retains that mismatch. API keys and other secrets
are not valid definition fields.

The three structured criteria fields are optional per question and are evaluated semantically:
`requiredFacts` lists the essential facts the answer must convey, `acceptedAlternatives` lists
equivalent answer forms where any one acceptable alternative is sufficient, and `forbiddenClaims`
lists explicit factual claims that must not appear. They are sent to the LLM judge as criteria, not
matched as exact strings. Missing required facts and forbidden claims are retained in the question's
judge diagnostics.

## Supported model selectors

The evaluator accepts `provider/model` selectors for the providers below. These entries are also
the models covered by the built-in token-cost estimate table as of `2026-08-01`:

| Provider  | Supported selector                     | Estimated pricing |
| --------- | -------------------------------------- | ----------------- |
| OpenAI    | `openai/gpt-5.6-sol`                   | Yes               |
| OpenAI    | `openai/gpt-5.6-terra`                 | Yes               |
| OpenAI    | `openai/gpt-5.6-luna`                  | Yes               |
| OpenAI    | `openai/gpt-5.6` (Sol alias)           | Yes               |
| OpenAI    | `openai/gpt-5.5`                       | Yes               |
| OpenAI    | `openai/gpt-5.4`                       | Yes               |
| OpenAI    | `openai/gpt-4o`                        | Yes               |
| OpenAI    | `openai/gpt-4o-mini`                   | Yes               |
| OpenAI    | `openai/gpt-5.4-mini`                  | Yes               |
| OpenAI    | `openai/gpt-5.4-nano`                  | Yes               |
| Anthropic | `anthropic/claude-fable-5`             | Yes               |
| Anthropic | `anthropic/claude-opus-5`              | Yes               |
| Anthropic | `anthropic/claude-opus-4-8`            | Yes               |
| Anthropic | `anthropic/claude-opus-4-7`            | Yes               |
| Anthropic | `anthropic/claude-opus-4-6`            | Yes               |
| Anthropic | `anthropic/claude-opus-4-5-20251101`   | Yes               |
| Anthropic | `anthropic/claude-sonnet-5`            | Yes               |
| Anthropic | `anthropic/claude-sonnet-4-6`          | Yes               |
| Anthropic | `anthropic/claude-sonnet-4-5-20250929` | Yes               |
| Anthropic | `anthropic/claude-haiku-4-5`           | Yes               |
| Anthropic | `anthropic/claude-haiku-4-5-20251001`  | Yes               |
| Mistral   | `mistral/mistral-medium-3.5`           | Yes               |
| Mistral   | `mistral/mistral-small-4`              | Yes               |
| Mistral   | `mistral/mistral-large-3`              | Yes               |
| Mistral   | `mistral/ministral-3b`                 | Yes               |
| xAI       | `xai/grok-4.3`                         | Yes               |
| xAI       | `xai/grok-build-0.1`                   | Yes               |

The following aliases are normalized to a priced entry: `openai/gpt-5.6`,
`openai/gpt-4o-mini-2024-07-18`, `anthropic/claude-haiku-4-5-20251001`, `mistral/mistral-medium-3-5`, and
`xai/grok-4.3-latest`. Other provider/model selectors may still be accepted by Core, but their
`costEstimate` is `null` until a price entry is added. Provider credentials and model availability
are environment-dependent.

## Configuration and validation command

Run the foundation command from the repository root:

```sh
pnpm --filter @gami/conversation-evaluation evaluate \
  --definition ./path/to/definition.json \
  --avatar-api-base-url http://localhost:3000 \
  --api-key "$API_KEY"
```

The command validates the definition before making requests, then creates one session and one
conversation, sends questions in order, and judges each returned Avatar response through the
authenticated `POST /v1/exchange` route. The API key is accepted only through `--api-key`,
`EVALUATION_API_KEY`, or `API_KEY` and is never printed. Other options can be supplied by flag or
environment variable:

| Option                  | Environment                       | Default                          |
| ----------------------- | --------------------------------- | -------------------------------- |
| `--definition`          | `EVALUATION_DEFINITION_PATH`      | required                         |
| `--avatar-api-base-url` | `AVATAR_API_BASE_URL`             | required                         |
| `--api-key`             | `EVALUATION_API_KEY` or `API_KEY` | required                         |
| `--judge-base-url`      | `JUDGE_API_BASE_URL`              | omitted                          |
| `--output`              | `EVALUATION_OUTPUT_PATH`          | `reports/evaluation-report.json` |
| `--timeout-ms`          | `EVALUATION_TIMEOUT_MS`           | `30000`                          |
| `--user-id`             | `EVALUATION_USER_ID`              | unique run-scoped ID             |

The generated user ID prevents repeated runs from unintentionally sharing memory. Set
`--user-id` when deliberately testing continuity across runs. `--judge-base-url` defaults to the
Avatar API base URL; it changes the judge target only and never changes Core model configuration.

The default output path is `reports/evaluation-report.json` relative to the
`tools/conversation-evaluation` package. Use
`--output` or `EVALUATION_OUTPUT_PATH` to place the report elsewhere. Reports contain one record per
attempted question, including the Avatar response, observed model, latency, tokens, judge result,
judge model and judge latency/token metrics, and error classification. Error records include the
failing evaluation phase when known. `passRate` uses only successfully judged questions as its denominator;
`api_error` and `judge_error` are not quality failures. Reports are written atomically after setup
and after every attempted question, so a stopped run remains readable and preserves completed work.
The CLI prints progress for setup, each Avatar request, judging, and question completion. It waits
five seconds between questions so asynchronous Game Master and memory work can settle before the
next scripted turn; an API failure stops without waiting.

When `models` is present, the command writes one report per model next to the configured output,
for example `evaluation-report.openai-gpt-5-4.json`, and maintains the configured output as a
comparison report. The comparison report is updated after each model, so an interrupted run keeps
completed model results.

Judge transport, contract, and malformed-output failures are retried up to three total attempts per
question. Each retry and final failure is printed in progress logs. A model run with a final
`judge_error` or `api_error` is retained in the comparison report, and the evaluator continues with
the next model. Comparison stops only after three consecutive model runs end with one of those
infrastructure failures; valid quality failures do not count toward this threshold.

## Local report viewer

Start a local browser viewer with the command run from the repository root. Paths passed to this
filtered command are resolved relative to the `tools/conversation-evaluation` package:

```sh
pnpm --filter @gami/conversation-evaluation view \
  --report ./reports/evaluation-report.json
```

Open the printed `http://127.0.0.1:4173` URL. The viewer shows the run summary, pass/partial/fail
counts, model and token metrics, expected versus actual responses, structured criteria, judge
diagnostics, provider and model comparison tables. Provider rows aggregate all selected models for
each provider, while model rows retain the individual result. Click any model-comparison column
header to sort it; click again to reverse the order. For comparison reports, use the model
selector to inspect the full question details for any completed model. Use **Print current model** to
print the selected model, or **Print all models** to print the comparison summary followed by the
complete overview and question details for every model. In the browser print dialog, choose **Save as
PDF** to share the report. It refreshes every two seconds, so it can display incremental report snapshots while
an evaluation is running. The server binds to `127.0.0.1` by default and serves only the selected
report; use `--host` and `--port` to change the local binding. Press `Ctrl+C` to stop it.

The package API exposes `validateTestDefinition`, `loadTestDefinition`, `loadEvaluationConfig`,
`CoreApiClient`, and `runSequentialConversation` from `src/index.ts`. The runner creates one
session, starts one conversation, and awaits each JSON Avatar response before sending the next
question. It never polls Game Master or memory work. Message failures are retained as partial
`api_error` results and stop the run conservatively because a timed-out request may have been
committed by Core.

The client decodes only the standard `ApiResponse<T>` envelope, sends `x-api-key`, validates
consumed successful response payloads at runtime, bounds surfaced error messages, and supports
request timeout and caller abort signals. Missing `costUsd` is
normalized to `null`; total tokens are derived only from input plus output tokens when the API
omits the optional total.

The judge sends bounded JSON evidence containing the question, expected criteria, and actual Avatar
response. It requires a strict machine-readable result with `passed`, a 1–5 integer `score`, a
non-empty `reason`, and string arrays for `missingElements` and `contradictions`; one deterministic
fenced-JSON form is accepted for compatibility. Invalid or unavailable judge responses are
reported as `judge_error`, while valid scores become quality outcomes: 4–5 are `passed`, 3 is
`partial`, and 1–2 are `failed`. Structured `requiredFacts`, `acceptedAlternatives`, and
`forbiddenClaims` are included as explicit judge criteria when provided. The judge rubric explicitly
distinguishes essential facts, acceptable alternatives, omissions, contradictions, harmless extra
detail, and the required score/`passed` consistency rules. Reports retain the judge reason, missing
facts, and contradictions for each evaluated question, and the console summary displays them.

Each report includes a `costEstimate` for Avatar, judge, and total cost when the model is in the
tool's manually maintained public-price table. The estimate is calculated as
`inputTokens / 1,000,000 * inputPrice + outputTokens / 1,000,000 * outputPrice` using standard
short-context list pricing, with no cache, batch, long-context, or provider-specific discount
adjustments. Every estimate records its pricing source and `pricingAsOf` date. Unknown models make
the affected estimate, and therefore the total, `null` while listing `unavailableModels`; this is
intentional because the API may expose token usage without a public price entry. Judge latency and
token totals are retained for operational comparison. The console summary shows statuses, scores,
models, bounded Avatar/judge metrics, and estimated cost without printing prompts or secrets. A completed run exits
successfully; setup, API, judge, or interrupted runs return a non-zero exit code. The package has no
Core-internal, database, Redis, Langfuse, provider SDK, YAML, or new HTTP endpoint dependency.

## Opt-in Villa Miralac example

The readable, versioned example at
`tools/conversation-evaluation/definitions/murder-party-villa-miralac.json` uses the stable seed
identifier `murder-party-villa-miralac` and resolves the initial Avatar by the exact name
`Clara Whitcombe`. It is opt-in: default tests never execute it or contact a provider.

First seed a Core environment using the documented API bootstrap, then run the evaluator explicitly:

```sh
MURDER_PARTY_API_BASE_URL=http://localhost:3000 \
MURDER_PARTY_API_KEY="$API_KEY" \
pnpm seed:murder-party:api

EVALUATION_API_KEY="$API_KEY" \
pnpm --filter @gami/conversation-evaluation evaluate \
  --definition ./definitions/murder-party-villa-miralac.json \
  --avatar-api-base-url http://localhost:3000 \
  --output ./reports/evaluation-report.json
```

Before a live run, Core must be running, the scenario and Avatar seed must exist, and the server's
provider credentials must support every selected model. Definition `model` remains single-run
metadata; `models` sends explicit Avatar model selections, and `judgeModel` is sent as an explicit
raw exchange model selection, so declared models are requested rather than silently replaced by
Core defaults. Real execution is intentionally separate from the deterministic package and
integration-style fake-HTTP tests.

Quality checks for this package are:

```sh
pnpm --filter @gami/conversation-evaluation test
pnpm --filter @gami/conversation-evaluation test:integration-style
pnpm --filter @gami/conversation-evaluation typecheck
pnpm --filter @gami/conversation-evaluation lint
pnpm format:check
```

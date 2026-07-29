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
      "question": "What happened in the winter garden?",
      "expectedResponse": "Mention the death and storm; wording may differ."
    }
  ]
}
```

Use exactly one of `initialAvatarId` or `initialAvatarName`. Exact duplicate question text is
rejected. `expectedResponse` is criteria text for a later semantic judge, not an exact-match
answer. `model` and `judgeModel` are declared/expected metadata for comparison and verification;
they never override Core's server-side model resolution. API keys and other secrets are not valid
definition fields.

## Configuration and validation command

Run the foundation command from the repository root:

```sh
pnpm --filter @gami/conversation-evaluation evaluate -- \
  --definition ./path/to/definition.json \
  --avatar-api-base-url http://localhost:3000 \
  --api-key "$API_KEY"
```

The command validates the definition before making requests, then creates one session and one
conversation, sends questions in order, and judges each returned Avatar response through the
authenticated `POST /v1/exchange` route. The API key is accepted only through `--api-key`,
`EVALUATION_API_KEY`, or `API_KEY` and is never printed. Other options can be supplied by flag or
environment variable:

| Option                  | Environment                       | Default                  |
| ----------------------- | --------------------------------- | ------------------------ |
| `--definition`          | `EVALUATION_DEFINITION_PATH`      | required                 |
| `--avatar-api-base-url` | `AVATAR_API_BASE_URL`             | required                 |
| `--api-key`             | `EVALUATION_API_KEY` or `API_KEY` | required                 |
| `--judge-base-url`      | `JUDGE_API_BASE_URL`              | omitted                  |
| `--output`              | `EVALUATION_OUTPUT_PATH`          | `evaluation-report.json` |
| `--timeout-ms`          | `EVALUATION_TIMEOUT_MS`           | `30000`                  |
| `--user-id`             | `EVALUATION_USER_ID`              | unique run-scoped ID     |

The generated user ID prevents repeated runs from unintentionally sharing memory. Set
`--user-id` when deliberately testing continuity across runs. `--judge-base-url` defaults to the
Avatar API base URL; it changes the judge target only and never changes Core model configuration.

The package API exposes `validateTestDefinition`, `loadTestDefinition`, `loadEvaluationConfig`,
`CoreApiClient`, and `runSequentialConversation` from `src/index.ts`. The runner creates one
session, starts one conversation, and awaits each JSON Avatar response before sending the next
question. It never polls Game Master or memory work. Message failures are retained as partial
`api_error` results and stop the run conservatively because a timed-out request may have been
committed by Core.

The client decodes only the standard `ApiResponse<T>` envelope, sends `x-api-key`, bounds surfaced
error messages, and supports request timeout and caller abort signals. Missing `costUsd` is
normalized to `null`; total tokens are derived only from input plus output tokens when the API
omits the optional total.

The judge sends bounded JSON evidence containing the question, expected criteria, and actual Avatar
response. It requires a strict machine-readable result with `passed`, a 1–5 integer `score`, a
non-empty `reason`, and string arrays for `missingElements` and `contradictions`; one deterministic
fenced-JSON form is accepted for compatibility. Invalid or unavailable judge responses are
reported as `judge_error`, while valid `passed: false` results are quality `failed` results.

Reports are written atomically after the initial setup and after every attempted question. A partial
run remains valid JSON, and total cost is `null` unless every successful Avatar response in the
completed run supplied cost data. The console summary shows statuses, scores, models, and bounded
metrics without printing prompts or secrets. The package has no Core-internal, database, Redis,
Langfuse, provider SDK, YAML, or new HTTP endpoint dependency.

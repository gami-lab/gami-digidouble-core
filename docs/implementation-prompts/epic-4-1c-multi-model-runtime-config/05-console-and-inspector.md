# 05 — Console Editing & Inspector Integration

## Context

Prompts 01–04 delivered the full backend: domain types, resolution service, persistence, admin
API, avatar overrides, and runtime wiring. Operators currently have no UI to view or change the
model configuration without making raw API calls.

This prompt adds:

1. A **Model Config editor** in the admin console (global default + role overrides)
2. **Avatar form updates** to expose the `llmOverride` field
3. **Runtime inspector** extension to display effective models per session

---

## Scope

**In scope:**

- Console page or settings section for editing global/role model config
- Avatar create/edit form fields for `llmOverride`
- Runtime inspector: `effectiveModels` display (read-only)
- `GET /v1/admin/sessions/{sessionId}/inspect` response extended with `effectiveModels`

**Out of scope:**

- Backend model config logic (already done in prompts 01–04)
- New stack-e2e tests for the inspect endpoint extension (it already has coverage; add a
  shape assertion for `effectiveModels` to existing tests)

---

## Relevant Docs

- `docs/API_CONTRACT.md` — `GET /v1/admin/model-config`, `PUT /v1/admin/model-config`,
  `AvatarSummary`, admin session inspect endpoint
- `packages/shared/src/` — `ModelConfigResponse` (from prompt 02), `AvatarSummary` (from 03)
- `apps/console/src/` — existing page/component structure; follow existing conventions
- `apps/core/src/api/routes/` — admin session inspect route

---

## Implementation Guidance

### Admin Session Inspect — `effectiveModels`

Extend the `GET /v1/admin/sessions/{sessionId}/inspect` response with an `effectiveModels`
snapshot:

```ts
effectiveModels: {
  avatar: {
    provider: string
    model: string
  }
  gameMaster: {
    provider: string
    model: string
  }
  memory: {
    provider: string
    model: string
  }
}
```

To compute this:

1. Load current `ModelConfig` from the repository (use `DEFAULT_MODEL_CONFIG` if absent)
2. Load the active avatar for the session (from `session.activeAvatarId`)
3. Call `ModelResolutionService.resolve()` for each role
4. The avatar's `llmOverride` is used for the `avatar` role

This is a computed field — do not persist it. Add it to the inspect use case / handler.

Update the `InspectSessionResponse` shared DTO in `packages/shared/src/` to include
`effectiveModels`. This is an additive change.

Update existing stack-e2e tests for the inspect endpoint to assert the `effectiveModels` shape
exists and is an object (do not assert specific provider values since they vary by environment).

### Console — Model Config Editor

Create a settings page (or section within an existing admin settings area) accessible from
the console sidebar. If a settings/admin page already exists, add a "Model Configuration"
panel there rather than creating a new top-level route.

The editor must show:

- Global default: provider (dropdown) + model (text input)
- Per-role overrides: one row per role (`Avatar`, `Game Master`, `Memory`), each with
  optional provider dropdown and model text input
- A "Reset to Default" action per role override (sends `PUT` with that role's override removed)
- Save button: calls `PUT /v1/admin/model-config`
- Read on mount: calls `GET /v1/admin/model-config`
- Validation feedback: display API `VALIDATION_ERROR` details inline

Provider dropdown values must match the known `ProviderName` set:
`openai`, `anthropic`, `mistral`, `xai`, `null`.

Do not hardcode this list in the component — import it from a shared constant or derive it from
the type. If the console cannot import domain types directly, define the list once as a console
constant and add a comment referencing the canonical `ProviderName` type.

### Console — Avatar Form

In the avatar create/edit form, add an optional "Model Override" section (collapsed by default):

- Provider override: dropdown (blank = inherit)
- Model override: text input (blank = inherit)

On save, pass `llmOverride: { provider, model }` if either field is filled, or `llmOverride: null`
if both are blank (to clear any existing override).

Read `avatar.llmOverride` from the `AvatarSummary` response to pre-populate the fields.

### Console — Runtime Inspector

In the runtime inspector (Session Inspector view), add an `Effective Models` section showing
the three roles and their resolved provider/model for the current session. This reads from the
`effectiveModels` field added to the inspect response.

Display as a simple read-only table. No edit actions here — editing is done via the Model
Config editor.

---

## Constraints

- Console must use the `ModelConfigResponse` shared DTO from `packages/shared/` — do not
  inline the shape
- The console must not call the model config endpoints on every navigation — load once per
  page mount
- Runtime inspector `effectiveModels` is read-only in the inspector
- Do not build a model comparison or benchmarking UI — this is configuration, not evaluation

---

## Deliverables

- `apps/console/src/` — Model Config editor page or panel
- `apps/console/src/` — Avatar form updated with `llmOverride` fields
- `apps/console/src/` — Runtime inspector updated with `effectiveModels` section
- `apps/core/src/api/routes/admin-inspect.ts` (or equivalent) — extended with `effectiveModels`
- `packages/shared/src/` — `InspectSessionResponse` extended with `effectiveModels` (additive)
- Existing inspect stack-e2e test updated to assert `effectiveModels` shape

---

## Mandatory Pre-Implementation Check

Before coding:

1. Read `apps/console/src/` directory structure to understand routing and component conventions.
2. Find the existing admin session inspect API route and shared DTO to know the exact file/type
   to update.
3. Search for existing "settings" or "config" page in the console — extend it rather than
   creating a new one if it exists.
4. Read the existing avatar form component to understand how `config` or `adjustments` fields
   are currently handled.

---

## Mandatory Final Step — Documentation Update

After implementation, update:

- `docs/API_CONTRACT.md` — document the `effectiveModels` addition to the inspect endpoint
  response
- `docs/PROJECT_STATUS.md` — mark prompt 05 complete under EPIC 4.1c

---

## Acceptance Criteria

- [ ] `GET /v1/admin/sessions/{sessionId}/inspect` includes `effectiveModels` field
- [ ] `InspectSessionResponse` shared DTO includes `effectiveModels` (additive)
- [ ] Existing inspect stack-e2e test asserts `effectiveModels` shape
- [ ] Console Model Config editor loads current config and saves updates
- [ ] Console editor validation shows API error details inline
- [ ] Avatar form exposes `llmOverride` fields (collapsed by default)
- [ ] Setting and clearing avatar `llmOverride` from the form works end-to-end
- [ ] Runtime inspector displays `effectiveModels` for the active session
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass

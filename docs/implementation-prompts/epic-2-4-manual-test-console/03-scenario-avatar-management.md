# 03 — Scenario & Avatar Management

## Context

Before a test session can start, the operator needs to create a scenario and attach an avatar
to it. This prompt builds the first two data-entry pages of the console.

The flow is strictly sequential:

```
[Create Scenario] → scenarioId stored in page state
       ↓
[Create Avatar]  → picks up scenarioId automatically
       ↓
[Session & Chat — Prompt 04]
```

No routing library is introduced unless already present. A simple page switcher (enum-based
state or a `useState<Page>`) is sufficient for this internal tool.

---

## Scope

**In scope**

- `ScenarioPage` component — create a scenario
- `AvatarPage` component — create an avatar under the active scenario
- App-level context object: `{ scenarioId, avatarId }` passed as props or lifted to `App.tsx`
- Navigation: "Next →" button revealed after successful creation, advancing to the next page
- Error messages rendered near the triggering form field or at the top of the form

**Out of scope**

- Listing / browsing existing scenarios or avatars
- Editing or deleting scenarios/avatars
- Pagination
- Slug auto-generation from name (keep slug as a separate text input)

---

## Relevant Docs

- `docs/API_CONTRACT.md` — `POST /v1/scenarios`, `POST /v1/scenarios/:id/avatars`
- `apps/console/src/api/scenarios.ts` — `createScenario`, `createAvatar` (from Prompt 02)

---

## Implementation Guidance

### Page state model

In `App.tsx`, maintain a flat context object for the active test session:

```ts
interface TestContext {
  scenarioId: string | null
  avatarId: string | null
  sessionId: string | null // filled by Prompt 04
}
```

Pass setters as props to each page component. Pages stay simple (no hooks outside React
built-ins, no state management library).

### `ScenarioPage`

Fields:

- `name` (required, text)
- `slug` (required, text, lowercase letters digits and hyphens only)
- `status` (optional, select: `draft` | `active` | `archived`, default `active`)

On submit:

1. Call `createScenario({ name, slug, status })`
2. On success: show a green success banner with the created `scenarioId`; enable "Next →" button
3. On error: show `ApiError.code + ': ' + ApiError.message` in red near the submit button
4. Disable the form after successful creation (prevent accidental re-submit)

### `AvatarPage`

Fields:

- `name` (required, text)
- `slug` (required, text)
- `personaPrompt` (required, textarea, multi-line)
- `tone` (optional, text, e.g. "friendly", "formal")
- `description` (optional, text)

On submit:

1. Call `createAvatar(scenarioId, { name, slug, personaPrompt, tone, description })`
2. On success: show success banner with `avatarId`; enable "Next →"
3. On error: display error message

### Minimal navigation

```ts
type Page = 'scenario' | 'avatar' | 'session'

const [page, setPage] = useState<Page>('scenario')
```

Breadcrumb-style header showing: `Scenario → Avatar → Session` with current page highlighted.
No back-navigation needed for EPIC 2.4 — the operator restarts from scratch if needed.

### Styling

No external CSS library. Use a minimal inline style or CSS module approach:

- Form fields are block-level inputs with labels above
- Success state: green border / text
- Error state: red border / text
- Disabled inputs have `opacity: 0.6`

---

## Constraints

- No routing library unless already bootstrapped in Prompt 01
- No global state management library (Redux, Zustand, etc.)
- All API calls go through `src/api/index.ts` — no raw `fetch`
- TypeScript strict — no `any`

---

## Deliverables

- `apps/console/src/pages/ScenarioPage.tsx`
- `apps/console/src/pages/AvatarPage.tsx`
- `apps/console/src/App.tsx` updated with page state, TestContext, and breadcrumb navigation

---

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/PROJECT_STATUS.md` — note scenario/avatar management pages complete

---

## Acceptance Criteria

- [ ] Submitting a valid scenario creates it and shows the `scenarioId` in the UI
- [ ] The avatar form is only accessible after a scenario has been created (or `scenarioId` is set)
- [ ] Both forms show a clear error message on API failure (not a silent failure in the console)
- [ ] Both forms are disabled after a successful creation (idempotency in UX)
- [ ] Page state advances from `scenario` → `avatar` → `session` only after each step succeeds
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes

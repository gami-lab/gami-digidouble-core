# Title

Add Minimal Admin Trigger And Trait Inspection Flow

# Context

The EPIC’s user increment is for administrators, not just API consumers. Operators need a minimal way to trigger preparation and inspect the resulting traits from the existing admin scenario workflow.

This should stay intentionally lightweight: one explicit trigger and a read-only inspection surface. No editable trait UI.

# Scope

Implement now:

- add an admin API client wrapper for the preparation action
- add a trigger in the existing scenario detail flow
- expose read-only computed trait inspection in the admin experience
- add focused admin tests for the new flow

Out of scope:

- editable trait forms
- bulk workflow dashboards
- advanced preparation history or job monitoring
- any public web UI changes

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Use `apps/admin`, not `apps/console`, for this slice.
- Reuse the existing scenario detail workflow and keep the trigger where operators already manage avatars and knowledge sources.
- Add one explicit action such as `Prepare avatar traits` on the scenario detail page.
- Provide clear UI states:
  - idle
  - preparing
  - success refresh
  - failure message
- Keep inspection read-only.
- Practical minimal inspection options:
  - show a `Prepared` / `Not prepared` signal in the avatar list
  - show the seven trait sections in a read-only block in the avatar detail/edit panel when traits exist
- Do not add inline trait editing, scoring, approval toggles, or manual override fields.
- After success, refresh scenario avatars from the API instead of mutating local state ad hoc.
- Reuse shared `AvatarSummary` types end-to-end.
- Add admin tests for:
  - API client call shape
  - button loading state
  - success refresh behavior
  - failure message rendering
  - read-only trait display when `computedTraits` exists

# Constraints

Respect:

- current architecture
- KISS
- YAGNI
- DRY
- no complex trait editing surface
- no app-local DTO duplication

# Deliverables

- admin API client wrapper for scenario preparation
- scenario detail trigger UI
- read-only computed trait display
- focused admin tests proving the flow

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Admin users can trigger avatar trait preparation from the scenario detail flow.
- [ ] The UI exposes a clear preparing/success/error path.
- [ ] Computed traits are visible in a read-only admin surface when present.
- [ ] No editable trait UI is introduced.
- [ ] Shared avatar DTOs are reused end-to-end.
- [ ] Admin tests cover the trigger and inspection flow.
- [ ] `docs/PROJECT_STATUS.md` and impacted docs are reviewed or updated.

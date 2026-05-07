# EPIC 2.7 — Runtime Inspector & Console v2

## Objective

Turn the existing Scenario Test Bench and admin inspection APIs into a coherent runtime-inspection
tool for orchestration, memory, live events, context, metrics, and safe operational actions.

This EPIC is not greenfield. The backend already exposes:

- GM session inspection (`/v1/admin/sessions/{sessionId}/inspect`)
- memory inspection (`/v1/admin/sessions/{sessionId}/memory`, `/memory-layers`)
- session events (`/v1/admin/sessions/{sessionId}/events`)
- runtime SSE + runtime-state (`/v1/sessions/{sessionId}/events/stream`, `/runtime-state`)
- session metrics (`/v1/admin/sessions/{sessionId}/metrics`)
- user persona CRUD (`/v1/users/{userId}/persona`)

EPIC 2.7 should consolidate those surfaces into one operator-grade runtime inspector without
duplicating contracts across Core and the console.

This EPIC is primarily a console EPIC. Backend work is only justified when it:

- removes endpoint fragmentation that would otherwise force console fan-out
- exposes a capability the console cannot reasonably derive from existing APIs
- replaces duplicated or drift-prone admin contracts with one canonical shape

Because the admin plane is still local/dev-only, backward compatibility is not a goal here. Prefer
one clean admin surface over keeping old and new inspector endpoints alive in parallel.

## Generated

May 6, 2026

## Prompt Files — Ordered Execution List

| #   | File                                  | Description                                                                        | Depends On |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------- | ---------- |
| 0   | `00-contract-cleanup.md`              | Centralize runtime-inspector DTO ownership before new inspector behavior           | —          |
| 1   | `01-runtime-inspector-query-model.md` | Consolidate fragmented admin read APIs into the cleanest runtime-inspector surface | 0          |
| 2   | `02-context-inspection-api.md`        | Add safe assembled Avatar + GM context inspection for operators                    | 0          |
| 3   | `03-admin-runtime-actions.md`         | Add auditable admin actions for GM replay and memory operations                    | 0          |
| 4   | `04-console-runtime-inspector-v2.md`  | Upgrade the console into a live runtime inspector using the new and existing APIs  | 1, 2, 3    |
| 5   | `05-hardening-doc-sync.md`            | Close test gaps, stack-e2e coverage, and documentation drift across the full EPIC  | 1–4        |

## Dependencies Between Prompts

- Prompt 0 is mandatory because the console already owns local copies of runtime-inspector DTOs.
- Prompts 1, 2, and 3 are backend slices that can proceed in parallel after prompt 0.
- Prompt 4 depends on the canonical contracts from prompt 0 and the backend surfaces from prompts
  1–3.
- Prompt 5 is last. It hardens behavior, closes stack-e2e gaps, and updates docs after all
  implementation slices land.

## Suggested Execution Order

0 → 1 → 2 → 3 → 4 → 5

## Definition of Done (Full EPIC)

- [ ] Runtime-inspector HTTP contracts have one canonical owner and the console does not redefine
      structurally identical admin DTOs locally.
- [ ] The console can load a coherent runtime-inspector view for one session without ad hoc API
      fan-out and without preserving redundant admin read endpoints.
- [ ] Operators can inspect runtime state, memory layers, GM state, transition history, unlock
      progression, metrics, and user persona from one runtime-inspector flow.
- [ ] Operators can inspect safe assembled Avatar and Game Master context without exposing raw
      prompt internals, secrets, provider credentials, or unbounded transcript replay.
- [ ] Operators can watch live runtime SSE events in the console for the selected session.
- [ ] Safe operational actions exist for the missing EPIC 2.7 debug actions: - replay GM - clear session-scoped working memory - trigger memory refresh - reset session reuses existing behavior instead of being reimplemented
- [ ] Every resulting HTTP endpoint introduced or retained by this EPIC has route tests and, when
      it is new, a matching `*.stack-e2e.test.ts` file covering auth, validation, and not-found
      behavior.
- [ ] Admin actions are auditable and do not silently mutate cross-session user memory.
- [ ] `docs/API_CONTRACT.md`, `docs/PROJECT_STATUS.md`, and any other impacted docs remain
      accurate.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:coverage` pass.

## EPIC Framing Notes

- Prefer consolidation over additive layering: EPIC 2.6, 4.2b, 4.3, 4.5, and 5.5 already shipped
  most of the backend primitives.
- The main missing value is operator coherence: canonical contracts, a minimal clean admin read
  surface, context inspection, auditable actions, and a console that uses them intentionally.
- Existing admin endpoints are not sacred. If a consolidated runtime-inspector surface fully
  replaces fragmented reads, remove or retire the superseded routes instead of keeping both.
- Keep the admin plane safe. Inspection APIs are allowed to be rich, but they must stay bounded,
  deterministic, and free of secret or provider-specific leakage.

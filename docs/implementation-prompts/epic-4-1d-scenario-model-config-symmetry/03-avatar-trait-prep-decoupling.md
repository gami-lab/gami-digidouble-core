# Decouple Avatar Trait Preparation From Avatar Role

# Context

This is the behavioral heart of EPIC `4.1d`. Avatar trait preparation
(`apps/core/src/application/use-cases/prepare-scenario-avatar-traits/prepare-scenario-avatar-traits.use-case.ts`,
`callTraitPreparationLlm`, ~lines 116-154) currently calls `resolveRoleLlmCall({ role: 'avatar',
avatarOverride: args.avatar.llmOverride, scenarioModelSelection: args.scenario.modelSelection,
... })` — the exact same resolution path used by live conversation turns in
`send-message.use-case.ts` (~lines 171-195). That means today, tiering the avatar model for cheap
live conversation also tiers the one-time, more-expensive-tolerant trait preparation step, and
vice versa. Prompt `01` added a scenario/global-default-only resolution primitive specifically so
this use case can resolve independently: scenario `defaultProfile` → global `globalDefault`,
bypassing `config.roleOverrides.avatar`, the Avatar entity's own `llmOverride`, and the scenario
`avatarOverride` added in prompt `01`.

# Scope

In scope:

- Change `callTraitPreparationLlm` to resolve its adapter/model via the new
  scenario-or-global-default primitive from prompt `01` instead of `resolveRoleLlmCall({ role:
'avatar', ... })`.
- Preserve the existing adapter-resolution mechanics (`llmAdapterRegistry`, `defaultAdapter`
  fallback) — only the _selection_ of provider/model changes, not how an adapter instance is
  obtained for a given provider.
- Update the `logResolvedLlmCall` call site accordingly (role label for logging — decide whether to
  keep `role: 'avatar'` for log continuity or introduce a distinct label; prefer keeping the log
  shape stable unless it would be misleading, since operators may filter logs by role).
- Tests proving: a scenario with `avatarOverride` set but a different `defaultProfile` causes trait
  prep to use `defaultProfile`, not `avatarOverride`; a scenario with no `modelSelection` at all
  causes trait prep to use the global default, not the global `avatar` role override; an Avatar
  entity's own `llmOverride` has no effect on trait prep.

Out of scope:

- Any change to `send-message.use-case.ts` — live conversation keeps using `role: 'avatar'`
  unchanged, and automatically benefits from prompt `01`'s new `avatarOverride` branch with no code
  change here.
- Game Master or memory resolution paths.

# Relevant Docs

- `docs/EPICS.md` (`4.1d`, `8.1` — trait preparation's original EPIC)
- `docs/GAME_MASTER_CONTRACT.md` only if it references trait preparation's model resolution
  (verify; likely not, since `8.1` is avatar-scoped, not GM-scoped)

# Implementation Guidance

- Look at how `resolveRoleLlmCall` in
  `apps/core/src/application/services/model-resolution-runtime.service.ts` resolves an adapter from
  a provider name via `resolveAdapterOrThrow(args.llmAdapterRegistry, resolved.provider,
args.role)`. Add a parallel, smaller function (e.g. `resolveScenarioOrGlobalDefaultLlmCall`) in
  the same file, built on prompt `01`'s primitive, that performs the same
  `modelConfigRepository`/`llmAdapterRegistry` undefined-fallback and adapter-resolution steps but
  sources provider/model from the new scenario-or-global-default function instead of
  `ModelResolutionService.resolve`.
- This keeps `prepare-scenario-avatar-traits.use-case.ts`'s call site shape close to its current
  form (same `defaultAdapter`/`modelConfigRepository`/`llmAdapterRegistry`/
  `modelConfigFallback`/`scenarioModelSelection` args), just calling a different top-level function
  and dropping `avatarOverride`/`role`.
- Do not thread a `role` concept through the new function at all — it has exactly one behavior, not
  role-dependent branching, so a `role` parameter would be misleading.
- Verify `prepare-scenario-avatar-traits.use-case.ts` doesn't rely on `role: 'avatar'` anywhere else
  (e.g. in trace/metrics tagging) before removing it — check the full file, not just the quoted
  call site.

# Constraints

- KISS: resist making this a generalized "resolve for any role bypassing overrides" function with a
  role parameter — the EPIC calls for exactly one such path (avatar trait prep), so keep it
  concrete.
- Backward compatibility: scenarios/avatars already relying on trait prep picking up
  `scenarioModelSelection.defaultProfile` (today's accidental behavior when no
  `avatarOverride`/`requestOverride`/`avatar.llmOverride` is set) must see no change in resolved
  model, since the new path still falls back through `defaultProfile` → global default.
- The only intended behavior change is for scenarios/avatars that _do_ have `avatar.llmOverride`, a
  global `avatar` role override, or (after prompt `01`) a scenario `avatarOverride` set — those
  must no longer affect trait prep.

# Deliverables

- `callTraitPreparationLlm` resolves via the new scenario-or-global-default path.
- New runtime-service function (e.g. `resolveScenarioOrGlobalDefaultLlmCall`) built on prompt
  `01`'s domain primitive.
- Tests proving the decoupling, as described in Scope.

# Mandatory Pre-Implementation Check

1. Touched entities/contracts: `prepare-scenario-avatar-traits.use-case.ts`'s LLM-call
   construction; no DTOs or persisted contracts change here.
2. Search `prepare-scenario-avatar-traits.use-case.ts` fully for any other `role`-dependent logic
   beyond `callTraitPreparationLlm` before assuming this is the only call site.
3. Canonical owner of resolution primitives: `model-resolution.service.ts` (domain) and
   `model-resolution-runtime.service.ts` (application) — reuse prompt `01`'s primitive rather than
   re-deriving scenario/global fallback logic inline in the use case.
4. Reuse the existing adapter-resolution helper (`resolveAdapterOrThrow`) rather than duplicating it
   in a new function.
5. N/A.

# Mandatory Final Step — Documentation Update

After implementation, update:

- `docs/API_CONTRACT.md` — add the avatar-trait-preparation resolution rule (scenario default →
  global default, independent of the `avatar` role) next to the `/prepare-avatar-traits` endpoint
  documentation, if the full precedence rewrite isn't already covered by prompt `04` at the time
  this prompt runs; otherwise flag it for prompt `04`.
- `docs/PROJECT_STATUS.md` if it describes trait preparation's model behavior.

# Acceptance Criteria

- [ ] Avatar trait preparation no longer passes `role: 'avatar'`/`avatarOverride:
args.avatar.llmOverride` to resolve its model
- [ ] Trait prep resolves via scenario `defaultProfile` → global default only, verified by tests
- [ ] Avatar entity `llmOverride`, global avatar role override, and scenario `avatarOverride` are
      all confirmed to have no effect on trait prep via tests
- [ ] Live conversation (`send-message.use-case.ts`) behavior and tests are unchanged
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass
- [ ] Docs reviewed/updated or explicitly deferred to prompt `04`

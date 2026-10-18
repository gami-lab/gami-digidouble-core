# Title

Consolidate Authentication Wiring, Trim Public Projections, And Inventory Routes

# Context

EPIC 12.1 changes who may call what. Today the shared API-key check is attached in at least four
different ways (`preHandler` hooks per plugin, `preValidation` in `knowledge.ts`, `onRequest` in
`conversation-message-audio.ts`, per-route options in `exchange.ts` and `voice-messages.ts`). Adding
a second credential type to that spread would multiply drift. The public avatar projection also
leaks authoring data (`AvailableAvatarSummary` includes `personaPrompt`). This slice removes that
debt before any tier or credential work starts, with no behavior change for callers.

# Scope

Implement now:

- one exported authentication entry point in `apps/core/src/api/hooks/` that every route plugin
  uses, attached at a single, documented lifecycle stage (pick the stage that still lets voice and
  multipart routes reject unauthenticated callers before reading the body)
- remove the per-file variants so `authenticateApiKey` is referenced in exactly one place
- a written route inventory (in this prompt pack's working notes or the PR description, not a new
  doc): method, path, plugin file, current callers (`web`, `admin`, `console`,
  `tools/conversation-evaluation`), intended tier (`public` / `admin` / `open`)
- trim `AvailableAvatarSummary` and any other player-facing projection to fields a player needs;
  `personaPrompt`, `adjustments`, raw `config`, and model/voice internals stay admin-only
- check the web client still renders after trimming (update its types/tests)

Out of scope:

- tier enforcement, route moves, new credentials (prompts `01`–`03`)
- rate limits and CORS (prompt `04`)

# Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md` (12.1)
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Start from `rg "authenticateApiKey" apps/core/src` and `server.ts` route registration.
- Note why `knowledge.ts` uses `preValidation` and `conversation-message-audio.ts` uses
  `onRequest` before collapsing them: multipart/binary bodies must not be parsed for an
  unauthenticated caller. Keep that guarantee and cover it with a test.
- The shared hook should take a credential verifier, so prompts `02`/`03` add verifiers instead of
  new hooks.
- For projections: the canonical owner is `packages/shared/src/conversation-contract-types.ts`
  (`AvailableAvatarSummary`) and `entity-types.ts`. Build the public projection with an explicit
  field pick in the API mapper; do not spread domain objects.
- Grep `apps/web/src` and `apps/console/src` for local copies of avatar/session shapes and replace
  them with the shared types.

# Constraints

- No externally visible behavior change other than the trimmed projection.
- KISS: one hook, one verifier interface; no plugin framework.
- TypeScript strict; no `any`; no new dependency.

# Deliverables

- single authentication hook entry point used by every plugin
- route inventory with intended tiers and callers
- trimmed public avatar projection with updated shared type, mapper, and web usage
- tests: unauthenticated multipart/voice/binary requests are rejected before body processing;
  public avatar projection contains no authoring fields

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (Avatar, Session, Conversation, public avatar projection).
2. Search for duplicated type definitions in `apps/web`, `apps/console`, `apps/admin`, and tools.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/API_CONTRACT.md` (public projection rule)
- `docs/ARCHITECTURE.md` if the hook placement rule is documented there

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] `authenticateApiKey` (or its successor) is wired from one place.
- [ ] Unauthenticated voice, upload, and audio requests are rejected without reading the body.
- [ ] `AvailableAvatarSummary` contains no `personaPrompt`, adjustments, or raw config.
- [ ] Route inventory with intended tiers is complete and attached to the change.
- [ ] Existing tests pass; new tests cover the consolidated hook.
- [ ] Documentation reviewed and updated where needed.

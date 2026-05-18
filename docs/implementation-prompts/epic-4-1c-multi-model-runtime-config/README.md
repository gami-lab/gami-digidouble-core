# EPIC 4.1c — Multi-Model Runtime Configuration

## Objective

Allow the platform to use different LLM providers and models depending on runtime
responsibility (Avatar speaking, Game Master orchestration, Memory compaction), while
preserving the existing provider abstraction layer and deterministic orchestration behavior.

**Generated:** 2026-05-18

---

## Ordered Execution List

| #   | File                              | Title                                        | Depends On |
| --- | --------------------------------- | -------------------------------------------- | ---------- |
| 1   | `01-model-config-domain.md`       | Model Config Domain & Resolution Service     | —          |
| 2   | `02-persistence-and-admin-api.md` | Persistence Layer & Admin API                | 01         |
| 3   | `03-avatar-model-override.md`     | Per-Avatar Model Override                    | 01, 02     |
| 4   | `04-runtime-wiring.md`            | Runtime Wiring & Observability               | 01, 02, 03 |
| 5   | `05-console-and-inspector.md`     | Console Editing & Inspector Integration      | 02, 03, 04 |
| 6   | `06-hardening-and-docs.md`        | Hardening, Backward Compatibility & Doc Sync | 01–05      |

---

## Dependencies Between Prompts

- **01** is purely domain-layer: types, resolution logic, unit tests. No infrastructure.
- **02** depends on 01 for the domain type. Adds persistence + admin API endpoints.
- **03** depends on 01 (resolution service must handle avatar overrides). Adds avatar-level
  override support stored in `avatar.config.llmOverride`.
- **04** depends on 01–03. Wires resolved (provider, model) into each runtime role's LLM call.
- **05** depends on 02–04 for stable API shapes before building UI.
- **06** is a hardening and sync pass — run last.

---

## Definition of Done (Full EPIC)

- [ ] One global default provider/model is persisted and applied to all roles when no override exists
- [ ] Role-specific overrides (`avatar`, `gameMaster`, `memory`) override the global default
- [ ] Per-avatar `llmOverride` overrides the role default for that avatar's speaking turns
- [ ] Resolution order is deterministic: avatar override → role override → global default
- [ ] `GET /v1/admin/model-config` returns the current config with applied defaults
- [ ] `PUT /v1/admin/model-config` replaces global + role overrides; invalid provider/model rejected
- [ ] Avatar `PATCH` endpoint accepts `llmOverride` and persists it in `config.llmOverride`
- [ ] `AvatarSummary` exposes `llmOverride` when set
- [ ] Runtime use cases (`SendMessage`, `RunGameMaster`, memory compaction) call the adapter
      resolved for their role
- [ ] Observability trace metadata includes `effectiveProvider` and `effectiveModel` per call
- [ ] Runtime inspector exposes `effectiveModels` snapshot for the session
- [ ] Console has an editor for global/role model config
- [ ] Console avatar form exposes `llmOverride` fields
- [ ] Console runtime inspector displays effective model per role
- [ ] Existing sessions continue working without migration issues (backward-compatible defaults)
- [ ] Invalid provider or empty model names are rejected with `VALIDATION_ERROR`
- [ ] Server restart with an existing config row preserves settings
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass
- [ ] `docs/PROJECT_STATUS.md`, `docs/DATA_MODEL.md`, `docs/API_CONTRACT.md` updated

# 01 — Health Domain Model

## Context

EPIC 3.1 introduces a dependency health surface. Before writing any probe or endpoint code, the domain types must be defined so all subsequent prompts share a single, consistent vocabulary.

This prompt establishes the probe result model, the probe interface, and the overall health report type that the endpoint will return.

## Scope

**In scope:**

- `HealthStatus` union type: `'healthy' | 'degraded' | 'unknown'`
- `DependencyProbeResult` type: `{ name, status, latencyMs?, message? }`
- `HealthReport` type: `{ status: HealthStatus, dependencies: DependencyProbeResult[], checkedAt: string }`
- `IDependencyProbe` interface: `probe(): Promise<DependencyProbeResult>`
- Place types in `apps/core/src/domain/health/health.types.ts`
- Place the probe interface in `apps/core/src/application/ports/IDependencyProbe.ts`

**Out of scope:**

- Probe implementations (prompt 02)
- HTTP endpoint (prompt 03)
- Tests (prompt 04)

## Relevant Docs

- `docs/ARCHITECTURE.md` — 4-layer structure; types belong in `domain/`, interfaces in `application/ports/`
- `docs/PRINCIPLES.md` — KISS; no over-engineering
- `docs/DATA_MODEL.md` — for naming conventions

## Implementation Guidance

**`apps/core/src/domain/health/health.types.ts`**

Define:

- `HealthStatus = 'healthy' | 'degraded' | 'unknown'`
- `DependencyProbeResult`:
  - `name: string` — human-readable dependency name (`'postgres'`, `'redis'`, `'llm'`)
  - `status: HealthStatus`
  - `latencyMs?: number` — round-trip latency of the probe call
  - `message?: string` — optional detail (error message when degraded)
- `HealthReport`:
  - `status: HealthStatus` — aggregate: `'healthy'` if all deps healthy, else `'degraded'`
  - `dependencies: DependencyProbeResult[]`
  - `checkedAt: string` — ISO 8601 UTC timestamp

**`apps/core/src/application/ports/IDependencyProbe.ts`**

A single-method interface:

```ts
export interface IDependencyProbe {
  probe(): Promise<DependencyProbeResult>
}
```

This interface is what the health use case depends on — not the concrete probe implementations.

**Aggregate status rule:**

```ts
const overallStatus = results.every((r) => r.status === 'healthy') ? 'healthy' : 'degraded'
```

Keep this rule in the use case (prompt 03), not in the domain types.

## Constraints

- No infrastructure imports in domain types or application ports
- Types must be exported from `apps/core/src/domain/health/index.ts` and `apps/core/src/application/ports/IDependencyProbe.ts`
- Follow existing naming conventions: `PascalCase` types, `I`-prefixed interfaces

## Deliverables

- `apps/core/src/domain/health/health.types.ts`
- `apps/core/src/domain/health/index.ts` (re-exports)
- `apps/core/src/application/ports/IDependencyProbe.ts`

## Mandatory Final Step — Documentation Update

After implementation, verify:

- `docs/PROJECT_STATUS.md` — no update needed at this stage (implementation not yet user-visible)
- Confirm the type names chosen here are consistent with `docs/DATA_MODEL.md` naming conventions; if new terms are introduced, note them in DATA_MODEL.md

## Acceptance Criteria

- [ ] `HealthStatus`, `DependencyProbeResult`, `HealthReport` types exist and are exported
- [ ] `IDependencyProbe` interface exists in `application/ports/`
- [ ] No infrastructure imports in domain or ports
- [ ] `pnpm typecheck` passes

import type { CoreApiClient, CoreApiRequestOptions } from './core-api-client.js'
import type { RuntimeRoleUsage, RuntimeUsageStatus } from './contracts.js'

export type RuntimeUsage = {
  status: RuntimeUsageStatus
  gameMaster: RuntimeRoleUsage
  memory: RuntimeRoleUsage
}

export function emptyRuntimeUsage(status: RuntimeUsageStatus): RuntimeUsage {
  return {
    status,
    gameMaster: emptyRoleUsage(),
    memory: emptyRoleUsage(),
  }
}

export async function collectRuntimeUsage(
  client: CoreApiClient,
  sessionId: string,
  options?: CoreApiRequestOptions,
): Promise<RuntimeUsage> {
  const response = await client.listSessionEvents(sessionId, options)
  const usage = emptyRuntimeUsage('complete')
  let complete = true

  for (const event of response.events) complete = addEventUsage(usage, event) && complete

  usage.status = complete ? 'complete' : 'unavailable'
  return usage
}

function emptyRoleUsage(): RuntimeRoleUsage {
  return {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    observedModels: [],
  }
}

function hasTokenUsage(payload: unknown): payload is RuntimeUsagePayload {
  if (!isRecord(payload)) return false
  return typeof payload.inputTokens === 'number' && typeof payload.outputTokens === 'number'
}

function addUsage(usage: RuntimeRoleUsage, payload: unknown): boolean {
  if (!hasTokenUsage(payload)) return false
  usage.calls += 1
  usage.inputTokens += payload.inputTokens
  usage.outputTokens += payload.outputTokens
  usage.totalTokens += payload.inputTokens + payload.outputTokens
  const model = qualifyModel(payload.provider, payload.model)
  if (model !== undefined && !usage.observedModels.includes(model)) {
    usage.observedModels.push(model)
  }
  return model !== undefined
}

function addEventUsage(usage: RuntimeUsage, event: { type: string; payload: unknown }): boolean {
  switch (event.type) {
    case 'gm_triggered':
      return addUsage(usage.gameMaster, event.payload)
    case 'gm_error':
      return addFailedUsage(usage.gameMaster, event.payload)
    case 'memory_refresh_succeeded':
      return addUsage(usage.memory, event.payload)
    case 'memory_refresh_failed':
      return true
    default:
      return true
  }
}

function addFailedUsage(usage: RuntimeRoleUsage, payload: unknown): boolean {
  if (!isRecord(payload)) return true
  const hasInputTokens = typeof payload.inputTokens === 'number'
  const hasOutputTokens = typeof payload.outputTokens === 'number'
  if (!hasInputTokens && !hasOutputTokens) return true
  return addUsage(usage, payload)
}

type RuntimeUsagePayload = {
  provider?: string
  model?: string
  inputTokens: number
  outputTokens: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function qualifyModel(provider: string | undefined, model: string | undefined): string | undefined {
  if (model === undefined || model.trim().length === 0) return undefined
  const normalizedModel = model.trim()
  if (normalizedModel.includes('/') || provider === undefined || provider === 'legacy') {
    return normalizedModel
  }
  return `${provider}/${normalizedModel}`
}

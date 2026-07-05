import type { KnowledgeFormat, KnowledgeType } from './setup-via-api.seed.js'

export type ApiEnvelope<T> = {
  data: T | null
  error: {
    code: string
    message: string
    details?: unknown
  } | null
}

export type ScenarioAvatarAvailability = {
  initialAvatarIds: string[]
  unlockableAvatarIds?: string[]
}

export type ScenarioSummary = {
  scenarioId: string
  name: string
  status: 'draft' | 'active' | 'archived'
  objectives: string[]
  worldContext: string
  avatarAvailability: ScenarioAvatarAvailability
  config: Record<string, unknown>
}

export type AvatarSummary = {
  avatarId: string
  scenarioId: string
  name: string
  status: 'draft' | 'active' | 'archived'
  personaPrompt: string
  tone?: string
  description?: string
  config: Record<string, unknown>
}

export type KnowledgeSourceDto = {
  sourceId: string
  scenarioId: string
  name: string
  knowledgeType: KnowledgeType
  format: KnowledgeFormat
  uriOrPath: string
  status: 'pending' | 'ready' | 'error'
  metadata?: Record<string, unknown>
  visibleToAvatarIds?: string[]
}

export type IngestionJobDto = {
  ingestionJobId: string
  sourceId: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  errorMessage?: string
}

export type CliOptions = {
  baseUrl: string
  apiKey: string
  scenarioName: string
  pollIntervalMs: number
  pollTimeoutMs: number
  reingestExisting: boolean
}

function toNumberString(value: number): string {
  return String(value)
}

async function parseEnvelope<T>(response: Response): Promise<ApiEnvelope<T> | null> {
  try {
    return (await response.json()) as ApiEnvelope<T>
  } catch {
    return null
  }
}

function assertStatus(
  response: Response,
  envelope: ApiEnvelope<unknown> | null,
  acceptedStatuses: number[],
  method: string,
  path: string,
): void {
  if (acceptedStatuses.includes(response.status)) return
  const message = envelope?.error?.message ?? 'Unknown API error'
  const code = envelope?.error?.code ?? 'UNKNOWN'
  throw new Error(
    `HTTP ${toNumberString(response.status)} on ${method} ${path}: ${code} ${message}`,
  )
}

function assertEnvelopeData<T>(
  envelope: ApiEnvelope<T> | null,
  response: Response,
  method: string,
  path: string,
): T {
  if (envelope === null) {
    throw new Error(
      `HTTP ${toNumberString(response.status)} on ${method} ${path} with non-JSON response.`,
    )
  }
  if (envelope.error !== null) {
    throw new Error(`${envelope.error.code} on ${method} ${path}: ${envelope.error.message}`)
  }
  if (envelope.data === null) {
    throw new Error(`Empty data payload on ${method} ${path}.`)
  }
  return envelope.data
}

export class ApiClient {
  constructor(private readonly options: CliOptions) {}

  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    body?: unknown,
    acceptedStatuses: number[] = [200],
  ): Promise<T> {
    const response = await fetch(`${this.options.baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.options.apiKey,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })

    const envelope = await parseEnvelope<T>(response)
    assertStatus(response, envelope, acceptedStatuses, method, path)
    return assertEnvelopeData(envelope, response, method, path)
  }

  listScenarios(): Promise<{ scenarios: ScenarioSummary[] }> {
    return this.request('GET', '/v1/scenarios')
  }

  createScenario(input: {
    name: string
    status: 'draft' | 'active' | 'archived'
    objectives?: string[]
    worldContext?: string
    avatarAvailability?: ScenarioAvatarAvailability
    config: Record<string, unknown>
  }): Promise<{ scenario: ScenarioSummary }> {
    return this.request('POST', '/v1/scenarios', input, [201])
  }

  updateScenario(
    scenarioId: string,
    input: Partial<{
      name: string
      status: 'draft' | 'active' | 'archived'
      objectives: string[]
      worldContext: string
      avatarAvailability: ScenarioAvatarAvailability
      config: Record<string, unknown>
    }>,
  ): Promise<{ scenario: ScenarioSummary }> {
    return this.request('PATCH', `/v1/scenarios/${scenarioId}`, input)
  }

  listAvatars(scenarioId: string): Promise<{ avatars: AvatarSummary[] }> {
    return this.request('GET', `/v1/scenarios/${scenarioId}/avatars`)
  }

  createAvatar(
    scenarioId: string,
    input: {
      name: string
      personaPrompt: string
      tone: string
      description: string
      status: 'draft' | 'active' | 'archived'
      config: Record<string, unknown>
    },
  ): Promise<{ avatar: AvatarSummary }> {
    return this.request('POST', `/v1/scenarios/${scenarioId}/avatars`, input, [201])
  }

  updateAvatar(
    avatarId: string,
    input: Partial<{
      name: string
      personaPrompt: string
      tone: string
      description: string
      status: 'draft' | 'active' | 'archived'
      config: Record<string, unknown>
    }>,
  ): Promise<{ avatar: AvatarSummary }> {
    return this.request('PATCH', `/v1/avatars/${avatarId}`, input)
  }

  listKnowledgeSources(scenarioId: string): Promise<{ sources: KnowledgeSourceDto[] }> {
    return this.request('GET', `/v1/scenarios/${scenarioId}/knowledge-sources`)
  }

  createKnowledgeSource(input: {
    scenarioId: string
    name: string
    knowledgeType: KnowledgeType
    format: KnowledgeFormat
    uriOrPath: string
    metadata: Record<string, unknown>
    visibleToAvatarIds?: string[]
  }): Promise<{ source: KnowledgeSourceDto }> {
    return this.request('POST', '/v1/knowledge-sources', input, [201])
  }

  triggerIngestion(
    sourceId: string,
  ): Promise<{ ingestionJob: IngestionJobDto; scheduled: boolean }> {
    return this.request('POST', `/v1/knowledge-sources/${sourceId}/ingest`, {}, [202])
  }

  getIngestionJob(ingestionJobId: string): Promise<{ ingestionJob: IngestionJobDto }> {
    return this.request('GET', `/v1/ingestion-jobs/${ingestionJobId}`)
  }
}

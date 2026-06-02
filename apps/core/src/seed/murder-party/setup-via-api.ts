import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

type ApiEnvelope<T> = {
  data: T | null
  error: {
    code: string
    message: string
    details?: unknown
  } | null
}

type ScenarioSummary = {
  scenarioId: string
  name: string
  status: 'draft' | 'active' | 'archived'
  config: Record<string, unknown>
}

type AvatarSummary = {
  avatarId: string
  scenarioId: string
  name: string
  status: 'draft' | 'active' | 'archived'
  personaPrompt: string
  tone?: string
  description?: string
  config: Record<string, unknown>
}

type KnowledgeType = 'memory' | 'world' | 'media'
type KnowledgeFormat = 'pdf' | 'text' | 'markdown' | 'url' | 'media'

type KnowledgeSourceDto = {
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

type IngestionJobDto = {
  ingestionJobId: string
  sourceId: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  errorMessage?: string
}

type CliOptions = {
  baseUrl: string
  apiKey: string
  scenarioName: string
  pollIntervalMs: number
  pollTimeoutMs: number
  reingestExisting: boolean
}

type AvatarSlug = 'clara' | 'elias' | 'margot' | 'thomas'

type AvatarSeed = {
  slug: AvatarSlug
  name: string
  tone: string
  description: string
  personaPrompt: string
  initiallyUnlocked: boolean
}

type SourceSeed = {
  slug: string
  fileName: string
  name: string
  knowledgeType: KnowledgeType
  format: KnowledgeFormat
  visibility:
    | 'public'
    | 'gm-only'
    | 'avatar-clara'
    | 'avatar-elias'
    | 'avatar-margot'
    | 'avatar-thomas'
}

const SCENARIO_SEED_SLUG = 'murder-party-villa-miralac'
const GM_ONLY_SENTINEL = '__GM_ONLY__'

const AVATAR_SEEDS: AvatarSeed[] = [
  {
    slug: 'clara',
    name: 'Clara Whitcombe',
    tone: 'careful, polite, observant, restrained',
    description: 'Housekeeper, witness, and initial avatar.',
    personaPrompt:
      'You are Clara Whitcombe, the housekeeper of Villa Miralac. You are observant, precise, and discreet. You are not the murderer. Help the investigator with concrete facts and careful reasoning. Mention other suspects when useful and avoid dramatic accusations without evidence.',
    initiallyUnlocked: true,
  },
  {
    slug: 'elias',
    name: 'Dr. Elias Moreau',
    tone: 'precise, composed, aristocratic, defensive',
    description: 'Physician and primary suspect.',
    personaPrompt:
      'You are Dr. Elias Moreau, physician and old friend of Lionel Ardent. You are controlled and analytical. Do not confess unless confronted with a strong chain of evidence. Keep responses grounded, avoid theatrical behavior, and protect your interests under pressure.',
    initiallyUnlocked: false,
  },
  {
    slug: 'margot',
    name: 'Margot Vale',
    tone: 'witty, anxious, emotional, defensive',
    description: 'Niece of the victim, false lead with hidden secret.',
    personaPrompt:
      "You are Margot Vale, Lionel Ardent's niece. You are sharp, emotionally reactive, and under financial pressure. You are not the murderer. You may hide compromising details at first, then reveal them when pressed with specific evidence.",
    initiallyUnlocked: false,
  },
  {
    slug: 'thomas',
    name: 'Thomas Reed',
    tone: 'nervous, intense, idealistic, slightly arrogant',
    description: 'Journalist and key timeline witness.',
    personaPrompt:
      'You are Thomas Reed, a journalist and former protege of Lionel Ardent. You are not the murderer. You initially protect your source and your reputation, but become more transparent under focused timeline questioning.',
    initiallyUnlocked: false,
  },
]

const SOURCE_SEEDS: SourceSeed[] = [
  {
    slug: 'scenario-world',
    fileName: 'scenario.md',
    name: 'Murder Party Scenario',
    knowledgeType: 'world',
    format: 'markdown',
    visibility: 'public',
  },
  {
    slug: 'places-world',
    fileName: 'places.md',
    name: 'Villa Miralac Places',
    knowledgeType: 'world',
    format: 'markdown',
    visibility: 'public',
  },
  {
    slug: 'crime-scene-world',
    fileName: 'crime-scene.md',
    name: 'Crime Scene Facts',
    knowledgeType: 'world',
    format: 'markdown',
    visibility: 'public',
  },
  {
    slug: 'shared-clues-world',
    fileName: 'shared-clues.md',
    name: 'Shared Clues',
    knowledgeType: 'world',
    format: 'markdown',
    visibility: 'public',
  },
  {
    slug: 'clara-memory',
    fileName: 'avatar-clara.md',
    name: 'Clara Private Memory',
    knowledgeType: 'memory',
    format: 'markdown',
    visibility: 'avatar-clara',
  },
  {
    slug: 'elias-memory',
    fileName: 'avatar-elias.md',
    name: 'Elias Private Memory',
    knowledgeType: 'memory',
    format: 'markdown',
    visibility: 'avatar-elias',
  },
  {
    slug: 'margot-memory',
    fileName: 'avatar-margot.md',
    name: 'Margot Private Memory',
    knowledgeType: 'memory',
    format: 'markdown',
    visibility: 'avatar-margot',
  },
  {
    slug: 'thomas-memory',
    fileName: 'avatar-thomas.md',
    name: 'Thomas Private Memory',
    knowledgeType: 'memory',
    format: 'markdown',
    visibility: 'avatar-thomas',
  },
  {
    slug: 'gm-truth',
    fileName: 'gm-truth.md',
    name: 'GM Truth Sheet',
    knowledgeType: 'world',
    format: 'markdown',
    visibility: 'gm-only',
  },
]

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === undefined) continue
    if (!token.startsWith('--')) continue
    const next = argv[index + 1]
    if (next === undefined || next.startsWith('--')) {
      args[token.slice(2)] = 'true'
      continue
    }
    args[token.slice(2)] = next
    index += 1
  }
  return args
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function loadOptions(args: Record<string, string>): CliOptions {
  const baseUrlRaw =
    args['base-url'] ?? process.env['MURDER_PARTY_API_BASE_URL'] ?? process.env['BASE_URL']
  const apiKey = args['api-key'] ?? process.env['MURDER_PARTY_API_KEY'] ?? process.env['API_KEY']

  if (baseUrlRaw === undefined || baseUrlRaw.trim().length === 0) {
    throw new Error(
      'Missing API base URL. Use --base-url or MURDER_PARTY_API_BASE_URL environment variable.',
    )
  }
  if (apiKey === undefined || apiKey.trim().length === 0) {
    throw new Error('Missing API key. Use --api-key or MURDER_PARTY_API_KEY environment variable.')
  }

  return {
    baseUrl: baseUrlRaw.replace(/\/$/, ''),
    apiKey,
    scenarioName: args['scenario-name'] ?? 'The Last Glass at Villa Miralac',
    pollIntervalMs: parseNumber(
      args['poll-interval-ms'] ?? process.env['MURDER_PARTY_POLL_MS'],
      300,
    ),
    pollTimeoutMs: parseNumber(
      args['poll-timeout-ms'] ?? process.env['MURDER_PARTY_POLL_TIMEOUT_MS'],
      180_000,
    ),
    reingestExisting: parseBoolean(
      args['reingest-existing'] ?? process.env['MURDER_PARTY_REINGEST_EXISTING'],
      true,
    ),
  }
}

function printHelp(): void {
  console.log('Murder Party API setup script')
  console.log('')
  console.log('Required options (flag or env):')
  console.log('  --base-url <url>    or MURDER_PARTY_API_BASE_URL')
  console.log('  --api-key <key>     or MURDER_PARTY_API_KEY')
  console.log('')
  console.log('Optional flags:')
  console.log('  --scenario-name <name>')
  console.log('  --poll-interval-ms <number>')
  console.log('  --poll-timeout-ms <number>')
  console.log('  --reingest-existing <true|false>')
  console.log('  --help')
}

function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex')
}

function readStringField(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

class ApiClient {
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

    let payload: ApiEnvelope<T> | null = null
    try {
      payload = (await response.json()) as ApiEnvelope<T>
    } catch {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} on ${method} ${path} with non-JSON response.`)
      }
    }

    if (!acceptedStatuses.includes(response.status)) {
      const message = payload?.error?.message ?? 'Unknown API error'
      const code = payload?.error?.code ?? 'UNKNOWN'
      throw new Error(`HTTP ${response.status} on ${method} ${path}: ${code} ${message}`)
    }

    if (payload === null) {
      throw new Error(`No response payload on ${method} ${path}.`)
    }
    if (payload.error !== null) {
      throw new Error(`${payload.error.code} on ${method} ${path}: ${payload.error.message}`)
    }
    if (payload.data === null) {
      throw new Error(`Empty data payload on ${method} ${path}.`)
    }
    return payload.data
  }

  listScenarios(): Promise<{ scenarios: ScenarioSummary[] }> {
    return this.request('GET', '/v1/scenarios')
  }

  createScenario(input: {
    name: string
    status: 'draft' | 'active' | 'archived'
    config: Record<string, unknown>
  }): Promise<{ scenario: ScenarioSummary }> {
    return this.request('POST', '/v1/scenarios', input, [201])
  }

  updateScenario(
    scenarioId: string,
    input: Partial<{
      name: string
      status: 'draft' | 'active' | 'archived'
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

  listKnowledgeSources(scenarioId: string): Promise<{
    sources: KnowledgeSourceDto[]
  }> {
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

async function readSeedFile(fileName: string): Promise<string> {
  const content = await readFile(new URL(fileName, import.meta.url), 'utf8')
  return content.trim()
}

function getScenarioBaseConfig(): Record<string, unknown> {
  return {
    seedSlug: SCENARIO_SEED_SLUG,
    genre: 'agatha-christie-prototype',
    initialAvatarKey: 'clara',
    progressionMilestones: [
      'intro',
      'suspects_unlocked',
      'crime_scene_established',
      'timeline_started',
      'motive_layer_open',
      'poison_clue_found',
      'contradiction_found',
      'final_accusation_ready',
      'solved',
    ],
    solution: {
      murdererAvatarKey: 'elias',
      requiredEvidenceCount: 3,
    },
  }
}

async function ensureScenario(client: ApiClient, options: CliOptions): Promise<ScenarioSummary> {
  const listed = await client.listScenarios()
  const existing = listed.scenarios.find(
    (scenario) =>
      readStringField(scenario.config['seedSlug']) === SCENARIO_SEED_SLUG ||
      scenario.name === options.scenarioName,
  )

  const config = getScenarioBaseConfig()

  if (existing !== undefined) {
    const updated = await client.updateScenario(existing.scenarioId, {
      name: options.scenarioName,
      status: 'active',
      config: {
        ...existing.config,
        ...config,
      },
    })
    return updated.scenario
  }

  const created = await client.createScenario({
    name: options.scenarioName,
    status: 'active',
    config,
  })
  return created.scenario
}

async function ensureAvatars(
  client: ApiClient,
  scenarioId: string,
): Promise<Record<AvatarSlug, AvatarSummary>> {
  const listed = await client.listAvatars(scenarioId)
  const bySlug = new Map<string, AvatarSummary>()
  const byName = new Map<string, AvatarSummary>()

  for (const avatar of listed.avatars) {
    const slug = readStringField(avatar.config['seedSlug'])
    if (slug !== null) bySlug.set(slug, avatar)
    byName.set(avatar.name, avatar)
  }

  const result: Partial<Record<AvatarSlug, AvatarSummary>> = {}

  for (const seed of AVATAR_SEEDS) {
    const existing = bySlug.get(seed.slug) ?? byName.get(seed.name)
    const payload = {
      name: seed.name,
      status: 'active' as const,
      personaPrompt: seed.personaPrompt,
      tone: seed.tone,
      description: seed.description,
      config: {
        seedSlug: seed.slug,
        initiallyUnlocked: seed.initiallyUnlocked,
        role: seed.slug,
        isMurderer: seed.slug === 'elias',
      },
    }

    if (existing !== undefined) {
      const updated = await client.updateAvatar(existing.avatarId, payload)
      result[seed.slug] = updated.avatar
      continue
    }

    const created = await client.createAvatar(scenarioId, payload)
    result[seed.slug] = created.avatar
  }

  return result as Record<AvatarSlug, AvatarSummary>
}

function toVisibilityIds(
  seed: SourceSeed,
  avatarIds: Record<AvatarSlug, AvatarSummary>,
): string[] | undefined {
  if (seed.visibility === 'public') return undefined
  if (seed.visibility === 'gm-only') return [GM_ONLY_SENTINEL]
  if (seed.visibility === 'avatar-clara') return [avatarIds.clara.avatarId]
  if (seed.visibility === 'avatar-elias') return [avatarIds.elias.avatarId]
  if (seed.visibility === 'avatar-margot') return [avatarIds.margot.avatarId]
  if (seed.visibility === 'avatar-thomas') return [avatarIds.thomas.avatarId]
  return undefined
}

async function waitForJob(
  client: ApiClient,
  ingestionJobId: string,
  options: CliOptions,
): Promise<IngestionJobDto> {
  const start = Date.now()
  while (Date.now() - start <= options.pollTimeoutMs) {
    const response = await client.getIngestionJob(ingestionJobId)
    const job = response.ingestionJob
    if (job.status === 'completed' || job.status === 'failed') return job
    await new Promise((resolve) => setTimeout(resolve, options.pollIntervalMs))
  }
  throw new Error(
    `Timed out waiting for ingestion job ${ingestionJobId} after ${options.pollTimeoutMs}ms.`,
  )
}

async function ensureKnowledgeSources(
  client: ApiClient,
  options: CliOptions,
  scenarioId: string,
  avatarIds: Record<AvatarSlug, AvatarSummary>,
): Promise<{ warnings: string[]; sourceIds: string[] }> {
  const warnings: string[] = []
  const sourceIds: string[] = []
  const listed = await client.listKnowledgeSources(scenarioId)

  const bySlug = new Map<string, KnowledgeSourceDto>()
  for (const source of listed.sources) {
    const slug = readStringField(source.metadata?.['seedSlug'])
    if (slug !== null) bySlug.set(slug, source)
  }

  for (const seed of SOURCE_SEEDS) {
    const content = await readSeedFile(seed.fileName)
    const contentHash = hashContent(content)
    const existing = bySlug.get(seed.slug)

    const visibility = toVisibilityIds(seed, avatarIds)
    let source = existing

    if (existing === undefined) {
      const created = await client.createKnowledgeSource({
        scenarioId,
        name: seed.name,
        knowledgeType: seed.knowledgeType,
        format: seed.format,
        uriOrPath: `seed://murder-party/${seed.fileName}`,
        metadata: {
          seedSlug: seed.slug,
          seedFileName: seed.fileName,
          contentSha256: contentHash,
          inlineText: content,
        },
        ...(visibility !== undefined ? { visibleToAvatarIds: visibility } : {}),
      })
      source = created.source
    } else {
      const existingHash = readStringField(existing.metadata?.['contentSha256'])
      if (existingHash !== null && existingHash !== contentHash) {
        warnings.push(
          `Knowledge source ${seed.slug} exists with different content hash. API currently has no update/delete endpoint for knowledge sources, so content was not replaced.`,
        )
      }
    }

    if (source === undefined) {
      warnings.push(`Skipping ${seed.slug}: unable to resolve source record.`)
      continue
    }

    sourceIds.push(source.sourceId)

    if (existing !== undefined && !options.reingestExisting) {
      continue
    }

    const trigger = await client.triggerIngestion(source.sourceId)
    const finalJob = await waitForJob(client, trigger.ingestionJob.ingestionJobId, options)
    if (finalJob.status === 'failed') {
      throw new Error(
        `Ingestion failed for source ${source.sourceId}: ${finalJob.errorMessage ?? 'unknown error'}`,
      )
    }
  }

  return { warnings, sourceIds }
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args['help'] === 'true') {
    printHelp()
    return
  }
  const options = loadOptions(args)
  const client = new ApiClient(options)

  console.log('[murder-party-seed] Starting setup via API...')
  console.log(`[murder-party-seed] Target base URL: ${options.baseUrl}`)

  const scenario = await ensureScenario(client, options)
  const avatars = await ensureAvatars(client, scenario.scenarioId)

  const avatarAvailability = {
    initialAvatarIds: AVATAR_SEEDS.filter((seed) => seed.initiallyUnlocked).map(
      (seed) => avatars[seed.slug].avatarId,
    ),
    unlockableAvatarIds: AVATAR_SEEDS.filter((seed) => !seed.initiallyUnlocked).map(
      (seed) => avatars[seed.slug].avatarId,
    ),
  }

  await client.updateScenario(scenario.scenarioId, {
    config: {
      ...scenario.config,
      ...getScenarioBaseConfig(),
      avatarAvailability,
    },
  })

  const knowledge = await ensureKnowledgeSources(client, options, scenario.scenarioId, avatars)

  const result = {
    scenarioId: scenario.scenarioId,
    avatarIds: Object.fromEntries(
      Object.entries(avatars).map(([slug, avatar]) => [slug, avatar.avatarId]),
    ),
    sourceCount: knowledge.sourceIds.length,
    warnings: knowledge.warnings,
    notes: [
      'Knowledge content is sent via metadata.inlineText for environment portability.',
      'If source content changes, current API cannot replace existing knowledge source content in-place.',
    ],
  }

  console.log(JSON.stringify(result, null, 2))
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[murder-party-seed] Failed: ${message}`)
    process.exitCode = 1
  })
}

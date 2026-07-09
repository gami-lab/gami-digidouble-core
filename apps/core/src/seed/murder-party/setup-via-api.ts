import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import {
  ApiClient,
  type AvatarSummary,
  type CliOptions,
  type IngestionJobDto,
  type KnowledgeSourceDto,
  type KnowledgeVisibilityPolicy,
  type ScenarioSummary,
} from './setup-via-api.api.js'
import {
  AVATAR_SEEDS,
  type AvatarSlug,
  getScenarioBaseConfig,
  SCENARIO_OBJECTIVES,
  SCENARIO_SEED_SLUG,
  SCENARIO_WORLD_CONTEXT,
  SOURCE_SEEDS,
  type SourceSeed,
  type SourceVisibility,
} from './setup-via-api.seed.js'

type SetupOutcome = {
  scenarioId: string
  avatarIds: Record<AvatarSlug, string>
  sourceCount: number
  warnings: string[]
  notes: string[]
}

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === undefined || !token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[index + 1]
    if (next === undefined || next.startsWith('--')) {
      args[key] = 'true'
      continue
    }
    args[key] = next
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

function resolveRequired(
  args: Record<string, string>,
  argName: string,
  envName: string,
  errorMessage: string,
): string {
  const value = args[argName] ?? process.env[envName]
  if (value === undefined || value.trim().length === 0) {
    throw new Error(errorMessage)
  }
  return value
}

function loadOptions(args: Record<string, string>): CliOptions {
  const baseUrlRaw = resolveRequired(
    args,
    'base-url',
    'MURDER_PARTY_API_BASE_URL',
    'Missing API base URL. Use --base-url or MURDER_PARTY_API_BASE_URL environment variable.',
  )
  const apiKey = resolveRequired(
    args,
    'api-key',
    'MURDER_PARTY_API_KEY',
    'Missing API key. Use --api-key or MURDER_PARTY_API_KEY environment variable.',
  )

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

async function readSeedFile(fileName: string): Promise<string> {
  const content = await readFile(new URL(fileName, import.meta.url), 'utf8')
  return content.trim()
}

function resolveVisibility(
  visibility: SourceVisibility,
  avatars: Record<AvatarSlug, AvatarSummary>,
): { visibilityPolicy?: KnowledgeVisibilityPolicy; visibleToAvatarIds?: string[] } {
  if (visibility === 'public') return {}
  if (visibility === 'gm-only') return { visibilityPolicy: 'none' }

  const map: Record<Exclude<SourceVisibility, 'public' | 'gm-only'>, AvatarSlug> = {
    'avatar-clara': 'clara',
    'avatar-elias': 'elias',
    'avatar-margot': 'margot',
    'avatar-thomas': 'thomas',
  }
  return {
    visibilityPolicy: 'avatars',
    visibleToAvatarIds: [avatars[map[visibility]].avatarId],
  }
}

async function ensureScenario(client: ApiClient, options: CliOptions): Promise<ScenarioSummary> {
  const listed = await client.listScenarios()
  const existing = listed.scenarios.find(
    (scenario) =>
      readStringField(scenario.config['seedSlug']) === SCENARIO_SEED_SLUG ||
      scenario.name === options.scenarioName,
  )

  const scenarioConfig = getScenarioBaseConfig()
  if (existing === undefined) {
    const created = await client.createScenario({
      name: options.scenarioName,
      status: 'active',
      worldContext: SCENARIO_WORLD_CONTEXT,
      objectives: SCENARIO_OBJECTIVES,
      config: scenarioConfig,
    })
    return created.scenario
  }

  const updated = await client.updateScenario(existing.scenarioId, {
    name: options.scenarioName,
    status: 'active',
    worldContext: SCENARIO_WORLD_CONTEXT,
    objectives: SCENARIO_OBJECTIVES,
    config: {
      ...existing.config,
      ...scenarioConfig,
    },
  })
  return updated.scenario
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

    if (existing === undefined) {
      const created = await client.createAvatar(scenarioId, payload)
      result[seed.slug] = created.avatar
      continue
    }

    const updated = await client.updateAvatar(existing.avatarId, payload)
    result[seed.slug] = updated.avatar
  }

  return result as Record<AvatarSlug, AvatarSummary>
}

function buildAvatarAvailability(avatars: Record<AvatarSlug, AvatarSummary>): {
  initialAvatarIds: string[]
  unlockableAvatarIds: string[]
} {
  return {
    initialAvatarIds: AVATAR_SEEDS.filter((seed) => seed.initiallyUnlocked).map(
      (seed) => avatars[seed.slug].avatarId,
    ),
    unlockableAvatarIds: AVATAR_SEEDS.filter((seed) => !seed.initiallyUnlocked).map(
      (seed) => avatars[seed.slug].avatarId,
    ),
  }
}

async function waitForJob(
  client: ApiClient,
  ingestionJobId: string,
  options: CliOptions,
): Promise<IngestionJobDto> {
  const startedAt = Date.now()
  while (Date.now() - startedAt <= options.pollTimeoutMs) {
    const response = await client.getIngestionJob(ingestionJobId)
    const job = response.ingestionJob
    if (job.status === 'completed' || job.status === 'failed') return job
    await new Promise((resolve) => setTimeout(resolve, options.pollIntervalMs))
  }
  throw new Error(
    `Timed out waiting for ingestion job ${ingestionJobId} after ${String(options.pollTimeoutMs)}ms.`,
  )
}

function hasHashDrift(existing: KnowledgeSourceDto, newHash: string): boolean {
  const existingHash = readStringField(existing.metadata?.['contentSha256'])
  return existingHash !== null && existingHash !== newHash
}

function toCreateSourcePayload(args: {
  scenarioId: string
  seed: SourceSeed
  content: string
  contentHash: string
  visibilityPolicy?: KnowledgeVisibilityPolicy
  visibleToAvatarIds?: string[]
}): {
  scenarioId: string
  name: string
  knowledgeType: SourceSeed['knowledgeType']
  format: SourceSeed['format']
  uriOrPath: string
  metadata: Record<string, unknown>
  visibilityPolicy?: KnowledgeVisibilityPolicy
  visibleToAvatarIds?: string[]
} {
  return {
    scenarioId: args.scenarioId,
    name: args.seed.name,
    knowledgeType: args.seed.knowledgeType,
    format: args.seed.format,
    uriOrPath: `seed://murder-party/${args.seed.fileName}`,
    metadata: {
      seedSlug: args.seed.slug,
      seedFileName: args.seed.fileName,
      contentSha256: args.contentHash,
      inlineText: args.content,
    },
    ...(args.visibilityPolicy !== undefined ? { visibilityPolicy: args.visibilityPolicy } : {}),
    ...(args.visibleToAvatarIds !== undefined
      ? { visibleToAvatarIds: args.visibleToAvatarIds }
      : {}),
  }
}

async function ensureOneKnowledgeSource(args: {
  client: ApiClient
  options: CliOptions
  scenarioId: string
  seed: SourceSeed
  existingBySlug: Map<string, KnowledgeSourceDto>
  avatars: Record<AvatarSlug, AvatarSummary>
  warnings: string[]
}): Promise<string | null> {
  const { client, options, scenarioId, seed, existingBySlug, avatars, warnings } = args
  const visibility = resolveVisibility(seed.visibility, avatars)
  const content = await readSeedFile(seed.fileName)
  const contentHash = hashContent(content)
  const existing = existingBySlug.get(seed.slug)

  let source = existing
  let contentReplaced = false

  if (existing === undefined) {
    const created = await client.createKnowledgeSource(
      toCreateSourcePayload({
        scenarioId,
        seed,
        content,
        contentHash,
        ...visibility,
      }),
    )
    source = created.source
  } else if (hasHashDrift(existing, contentHash)) {
    const updated = await client.updateKnowledgeSource(existing.sourceId, {
      metadata: {
        seedSlug: seed.slug,
        seedFileName: seed.fileName,
        contentSha256: contentHash,
        inlineText: content,
      },
    })
    source = updated.source
    contentReplaced = true
  }

  if (source === undefined) {
    warnings.push(`Skipping ${seed.slug}: unable to resolve source record.`)
    return null
  }

  if (existing !== undefined && !contentReplaced && !options.reingestExisting) {
    return source.sourceId
  }

  const trigger = await client.triggerIngestion(source.sourceId)
  const finalJob = await waitForJob(client, trigger.ingestionJob.ingestionJobId, options)
  if (finalJob.status === 'failed') {
    throw new Error(
      `Ingestion failed for source ${source.sourceId}: ${finalJob.errorMessage ?? 'unknown error'}`,
    )
  }

  return source.sourceId
}

async function ensureKnowledgeSources(
  client: ApiClient,
  options: CliOptions,
  scenarioId: string,
  avatars: Record<AvatarSlug, AvatarSummary>,
): Promise<{ warnings: string[]; sourceIds: string[] }> {
  const listed = await client.listKnowledgeSources(scenarioId)
  const existingBySlug = new Map<string, KnowledgeSourceDto>()
  const warnings: string[] = []
  const sourceIds: string[] = []

  for (const source of listed.sources) {
    const slug = readStringField(source.metadata?.['seedSlug'])
    if (slug !== null) existingBySlug.set(slug, source)
  }

  for (const seed of SOURCE_SEEDS) {
    const sourceId = await ensureOneKnowledgeSource({
      client,
      options,
      scenarioId,
      seed,
      existingBySlug,
      avatars,
      warnings,
    })
    if (sourceId !== null) sourceIds.push(sourceId)
  }

  return { warnings, sourceIds }
}

async function runSetup(options: CliOptions): Promise<SetupOutcome> {
  const client = new ApiClient(options)
  console.log('[murder-party-seed] Starting setup via API...')
  console.log(`[murder-party-seed] Target base URL: ${options.baseUrl}`)

  const scenario = await ensureScenario(client, options)
  const avatars = await ensureAvatars(client, scenario.scenarioId)

  await client.updateScenario(scenario.scenarioId, {
    config: {
      ...scenario.config,
      ...getScenarioBaseConfig(),
    },
    avatarAvailability: buildAvatarAvailability(avatars),
  })

  const knowledge = await ensureKnowledgeSources(client, options, scenario.scenarioId, avatars)

  return {
    scenarioId: scenario.scenarioId,
    avatarIds: {
      clara: avatars.clara.avatarId,
      elias: avatars.elias.avatarId,
      margot: avatars.margot.avatarId,
      thomas: avatars.thomas.avatarId,
    },
    sourceCount: knowledge.sourceIds.length,
    warnings: knowledge.warnings,
    notes: [
      'Knowledge content is sent via metadata.inlineText for environment portability.',
      'Sources with drifted content are replaced in-place via PATCH and re-ingested.',
    ],
  }
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args['help'] === 'true') {
    printHelp()
    return
  }

  const options = loadOptions(args)
  const outcome = await runSetup(options)
  console.log(JSON.stringify(outcome, null, 2))
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[murder-party-seed] Failed: ${message}`)
    process.exitCode = 1
  })
}

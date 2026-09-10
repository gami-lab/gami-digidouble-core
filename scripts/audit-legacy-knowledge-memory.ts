import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  classifyLegacyMemorySources,
  type LegacyMemoryAuditChunk,
  type LegacyMemoryAuditSource,
} from '../apps/core/src/domain/knowledge/legacy-memory-audit.js'
import type { KnowledgeVisibilityPolicy } from '../apps/core/src/domain/knowledge/knowledge.types.js'

type KnowledgeSourceRow = {
  id: string
  scenario_id: string
  knowledge_type: string
  visibility_policy: KnowledgeVisibilityPolicy | null
  visible_to_avatar_ids: string[] | null
  metadata: unknown
}

type KnowledgeChunkRow = {
  id: string
  source_id: string
  metadata: unknown
  visible_to_avatar_ids: string[] | null
}

type CliOptions = {
  inputPath?: string
  outputPath?: string
  databaseUrl?: string
}

type PostgresSqlClient = {
  <T>(strings: TemplateStringsArray, ...values: readonly unknown[]): Promise<T>
  end(): Promise<void>
}

type PostgresFactory = (databaseUrl: string, options: { max: number }) => PostgresSqlClient

type ParsedArgument = {
  nextIndex: number
  dryRun?: boolean
  inputPath?: string
  outputPath?: string
  databaseUrl?: string
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const sources =
    options.inputPath === undefined
      ? await loadFromDatabase(options.databaseUrl ?? process.env['DATABASE_URL'])
      : await loadFromInput(options.inputPath)
  const report = classifyLegacyMemorySources(sources)
  const serialized = `${JSON.stringify(report, null, 2)}\n`

  if (options.outputPath === undefined) {
    process.stdout.write(serialized)
  } else {
    await writeFile(options.outputPath, serialized, 'utf8')
  }
}

function parseArgs(args: readonly string[]): CliOptions {
  let inputPath: string | undefined
  let outputPath: string | undefined
  let databaseUrl: string | undefined
  let dryRun = false

  let index = 0
  while (index < args.length) {
    const parsed = parseArgument(args, index)
    index = parsed.nextIndex
    dryRun = dryRun || parsed.dryRun === true
    if (parsed.inputPath !== undefined) inputPath = parsed.inputPath
    if (parsed.outputPath !== undefined) outputPath = parsed.outputPath
    if (parsed.databaseUrl !== undefined) databaseUrl = parsed.databaseUrl
  }

  validateCliOptions(dryRun, inputPath, databaseUrl)

  return {
    ...(inputPath !== undefined ? { inputPath } : {}),
    ...(outputPath !== undefined ? { outputPath } : {}),
    ...(databaseUrl !== undefined ? { databaseUrl } : {}),
  }
}

function validateCliOptions(
  dryRun: boolean,
  inputPath: string | undefined,
  databaseUrl: string | undefined,
): void {
  if (!dryRun) {
    throw new Error('This audit is non-mutating; pass --dry-run explicitly.')
  }
  if (inputPath !== undefined && databaseUrl !== undefined) {
    throw new Error('Use either --input or --database-url, not both.')
  }
}

function parseArgument(args: readonly string[], index: number): ParsedArgument {
  switch (args[index]) {
    case '--dry-run':
      return { nextIndex: index + 1, dryRun: true }
    case '--input':
      return {
        nextIndex: index + 2,
        inputPath: requireArgument(args, index + 1, '--input'),
      }
    case '--output':
      return {
        nextIndex: index + 2,
        outputPath: requireArgument(args, index + 1, '--output'),
      }
    case '--database-url':
      return {
        nextIndex: index + 2,
        databaseUrl: requireArgument(args, index + 1, '--database-url'),
      }
    default:
      throw new Error(`Unknown argument: ${String(args[index])}`)
  }
}

function requireArgument(args: readonly string[], index: number, flag: string): string {
  const value = args[index]
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`)
  }
  return value
}

async function loadFromInput(inputPath: string): Promise<LegacyMemoryAuditSource[]> {
  const contents = await readFile(inputPath, 'utf8')
  const parsed: unknown = JSON.parse(contents)
  if (!isRecord(parsed) || !Array.isArray(parsed.sources)) {
    throw new Error('Audit input must be an object with a sources array.')
  }
  if (!parsed.sources.every(isAuditSource)) {
    throw new Error('Audit input contains an invalid source record.')
  }
  return parsed.sources
}

async function loadFromDatabase(
  databaseUrl: string | undefined,
): Promise<LegacyMemoryAuditSource[]> {
  if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
    throw new Error('Set DATABASE_URL or pass --input <path> when running the dry-run audit.')
  }

  const requireFromCore = createRequire(pathToFileURL(resolve(process.cwd(), 'package.json')))
  const postgres = requireFromCore('postgres') as unknown as PostgresFactory
  const sql = postgres(databaseUrl, { max: 1 })
  try {
    const sourceRows = await sql<KnowledgeSourceRow[]>`
      SELECT id, scenario_id, knowledge_type, visibility_policy, visible_to_avatar_ids, metadata
      FROM knowledge_sources
      WHERE knowledge_type = 'memory'
      ORDER BY id ASC
    `
    const chunkRows = await sql<KnowledgeChunkRow[]>`
      SELECT c.id, c.source_id, c.metadata, c.visible_to_avatar_ids
      FROM knowledge_chunks c
      JOIN knowledge_sources s ON s.id = c.source_id
      WHERE s.knowledge_type = 'memory'
      ORDER BY c.source_id ASC, c.chunk_index ASC, c.id ASC
    `
    const chunksBySource = new Map<string, LegacyMemoryAuditChunk[]>()
    for (const row of chunkRows) {
      const chunks = chunksBySource.get(row.source_id) ?? []
      chunks.push({
        chunkId: `knowledge_chunk_${row.id}`,
        metadata: row.metadata,
        visibleToAvatarIds: row.visible_to_avatar_ids,
      })
      chunksBySource.set(row.source_id, chunks)
    }

    return sourceRows.map((row) => ({
      sourceId: `knowledge_source_${row.id}`,
      scenarioId: `scenario_${row.scenario_id}`,
      knowledgeType: row.knowledge_type,
      visibilityPolicy: row.visibility_policy,
      visibleToAvatarIds: row.visible_to_avatar_ids,
      metadata: row.metadata,
      chunks: chunksBySource.get(row.id) ?? [],
    }))
  } finally {
    await sql.end()
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAuditSource(value: unknown): value is LegacyMemoryAuditSource {
  if (!isRecord(value)) return false
  return (
    typeof value['sourceId'] === 'string' &&
    typeof value['scenarioId'] === 'string' &&
    typeof value['knowledgeType'] === 'string' &&
    Array.isArray(value['chunks']) &&
    value['chunks'].every(isAuditChunk)
  )
}

function isAuditChunk(value: unknown): value is LegacyMemoryAuditChunk {
  return isRecord(value) && typeof value['chunkId'] === 'string'
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Legacy knowledge audit failed.'
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})

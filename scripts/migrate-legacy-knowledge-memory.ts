import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { writeFile } from 'node:fs/promises'
import { classifyLegacyMemorySources } from '../apps/core/src/domain/knowledge/legacy-memory-audit.js'
import {
  buildLegacyMemoryMigrationPlan,
  type LegacyMemoryMigrationPlan,
} from '../apps/core/src/domain/knowledge/legacy-memory-migration.js'
import { loadFromDatabase, loadFromInput } from './audit-legacy-knowledge-memory.js'

type CliOptions = {
  mode: 'dry-run' | 'apply'
  inputPath?: string
  outputPath?: string
  databaseUrl?: string
}

type ParsedArgument = {
  nextIndex: number
  mode?: CliOptions['mode']
  inputPath?: string
  outputPath?: string
  databaseUrl?: string
}

type ParsedOptions = {
  mode?: CliOptions['mode']
  inputPath?: string
  outputPath?: string
  databaseUrl?: string
}

type PostgresSqlClient = {
  <T>(strings: TemplateStringsArray, ...values: readonly unknown[]): Promise<T>
  begin<T>(callback: (transaction: PostgresSqlClient) => Promise<T>): Promise<T>
  end(): Promise<void>
}

type PostgresFactory = (databaseUrl: string, options: { max: number }) => PostgresSqlClient

type MigrationOutput = {
  report: ReturnType<typeof classifyLegacyMemorySources>
  plan: LegacyMemoryMigrationPlan
  applied: boolean
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const sources =
    options.inputPath === undefined
      ? await loadFromDatabase(options.databaseUrl ?? process.env['DATABASE_URL'])
      : await loadFromInput(options.inputPath)
  const report = classifyLegacyMemorySources(sources)
  const plan = buildLegacyMemoryMigrationPlan(report)

  if (options.mode === 'apply') {
    await applyPlan(plan, options.databaseUrl ?? process.env['DATABASE_URL'])
  }

  const output: MigrationOutput = { report, plan, applied: options.mode === 'apply' }
  const serialized = `${JSON.stringify(output, null, 2)}\n`
  if (options.outputPath === undefined) process.stdout.write(serialized)
  else await writeFile(options.outputPath, serialized, 'utf8')
}

function parseArgs(args: readonly string[]): CliOptions {
  const options: ParsedOptions = {}

  let index = 0
  while (index < args.length) {
    const parsed = parseArgument(args, index)
    index = parsed.nextIndex
    if (parsed.mode !== undefined && options.mode !== undefined && options.mode !== parsed.mode) {
      throw new Error('Choose one migration mode.')
    }
    Object.assign(options, parsed)
  }

  return validateOptions(options)
}

function validateOptions(options: ParsedOptions): CliOptions {
  const mode = requireMode(options.mode)
  validateModeRequirements(mode, options)
  return {
    mode,
    ...(options.inputPath !== undefined ? { inputPath: options.inputPath } : {}),
    ...(options.outputPath !== undefined ? { outputPath: options.outputPath } : {}),
    ...(options.databaseUrl !== undefined ? { databaseUrl: options.databaseUrl } : {}),
  }
}

function requireMode(mode: CliOptions['mode'] | undefined): CliOptions['mode'] {
  if (mode === undefined) throw new Error('Pass --dry-run or --apply.')
  return mode
}

function validateModeRequirements(mode: CliOptions['mode'], options: ParsedOptions): void {
  if (mode === 'dry-run' && options.inputPath === undefined && options.databaseUrl === undefined) {
    throw new Error('Set DATABASE_URL or pass --input <path> for a dry-run.')
  }
  if (mode === 'apply' && (options.databaseUrl ?? process.env['DATABASE_URL']) === undefined) {
    throw new Error('Set DATABASE_URL or pass --database-url for --apply.')
  }
  if (mode === 'apply' && options.inputPath !== undefined) {
    throw new Error('--input is supported only with --dry-run.')
  }
}

function parseArgument(args: readonly string[], index: number): ParsedArgument {
  const argument = args[index]
  switch (argument) {
    case '--dry-run':
      return { nextIndex: index + 1, mode: 'dry-run' }
    case '--apply':
      return { nextIndex: index + 1, mode: 'apply' }
    case '--input':
      return parseValueArgument(args, index, 'inputPath')
    case '--output':
      return parseValueArgument(args, index, 'outputPath')
    case '--database-url':
      return parseValueArgument(args, index, 'databaseUrl')
    default:
      throw new Error(`Unknown argument: ${String(argument)}`)
  }
}

function parseValueArgument(
  args: readonly string[],
  index: number,
  key: 'inputPath' | 'outputPath' | 'databaseUrl',
): ParsedArgument {
  const flag = args[index]
  const value = args[index + 1]
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${String(flag)} requires a value.`)
  }
  return { nextIndex: index + 2, [key]: value }
}

async function applyPlan(
  plan: LegacyMemoryMigrationPlan,
  databaseUrl: string | undefined,
): Promise<void> {
  if (databaseUrl === undefined || databaseUrl.trim().length === 0) {
    throw new Error('Set DATABASE_URL or pass --database-url for --apply.')
  }
  const requireFromCore = createRequire(pathToFileURL(resolve(process.cwd(), 'package.json')))
  const postgres = requireFromCore('postgres') as unknown as PostgresFactory
  const sql = postgres(databaseUrl, { max: 1 })
  try {
    await sql.begin(async (transaction) => {
      for (const action of plan.actions) {
        const sourceUuid = toSourceUuid(action.sourceId)
        if (action.quarantine) {
          await transaction`
            INSERT INTO knowledge_source_quarantines (
              source_id, original_knowledge_type, classification, reason, offending_key_names
            ) VALUES (
              ${sourceUuid}, 'memory', ${action.classification}, ${action.reason},
              ${action.offendingKeyNames}
            )
            ON CONFLICT (source_id) DO UPDATE SET
              classification = EXCLUDED.classification,
              reason = EXCLUDED.reason,
              offending_key_names = EXCLUDED.offending_key_names,
              quarantined_at = NOW()
          `
          await transaction`
            UPDATE knowledge_sources
            SET knowledge_type = ${action.targetKnowledgeType}, status = 'blocked', updated_at = NOW()
            WHERE id = ${sourceUuid} AND knowledge_type = 'memory'
          `
        } else {
          await transaction`
            UPDATE knowledge_sources
            SET knowledge_type = ${action.targetKnowledgeType}, updated_at = NOW()
            WHERE id = ${sourceUuid} AND knowledge_type = 'memory'
          `
        }
      }
      await transaction`ALTER TABLE knowledge_sources DROP CONSTRAINT IF EXISTS knowledge_sources_knowledge_type_check`
      await transaction`
        ALTER TABLE knowledge_sources ADD CONSTRAINT knowledge_sources_knowledge_type_check
        CHECK (knowledge_type IN ('avatar_knowledge', 'world', 'media'))
      `
    })
  } finally {
    await sql.end()
  }
}

function toSourceUuid(sourceId: string): string {
  const match = /^knowledge_source_([0-9a-f-]+)$/i.exec(sourceId)
  if (match?.[1] === undefined) throw new Error(`Unsafe source ID in migration plan: ${sourceId}`)
  return match[1]
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Legacy knowledge migration failed.'
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  })
}

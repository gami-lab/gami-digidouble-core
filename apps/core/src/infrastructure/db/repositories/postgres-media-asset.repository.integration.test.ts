import type { Sql } from 'postgres'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { CreateMediaAssetParams } from '../../../application/ports/IMediaAssetRepository.js'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresMediaAssetRepository } from './postgres-media-asset.repository.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'

const ASSET_A = 'media_0b5f1f0e-7a8e-4a57-9c64-4b1b4b0a0001'
const ASSET_B = 'media_0b5f1f0e-7a8e-4a57-9c64-4b1b4b0a0002'

describe.skipIf(!DB_AVAILABLE)('PostgresMediaAssetRepository', () => {
  let sql: Sql
  let repository: PostgresMediaAssetRepository
  let scenarios: PostgresScenarioRepository

  beforeAll(() => {
    sql = createTestSql()
    repository = new PostgresMediaAssetRepository(sql)
    scenarios = new PostgresScenarioRepository(sql)
  })

  afterEach(async () => {
    await truncateAllTables(sql)
  })

  afterAll(async () => {
    await sql.end()
  })

  function params(
    scenarioId: string,
    overrides: Partial<CreateMediaAssetParams> = {},
  ): CreateMediaAssetParams {
    return {
      assetId: ASSET_A,
      scenarioId,
      kind: 'image',
      source: 'upload',
      storageKey: ASSET_A.replace('media_', ''),
      url: null,
      mimeType: 'image/png',
      byteSize: 5_000_000_000,
      posterAssetId: null,
      durationMs: null,
      description: 'A lantern-lit hall',
      cueable: true,
      ...overrides,
    }
  }

  it('creates, finds, lists, and scopes assets by scenario', async () => {
    const scenario = await scenarios.create({ name: 'Media A' })
    const other = await scenarios.create({ name: 'Media B' })
    const created = await repository.create(params(scenario.scenarioId))
    await repository.create(
      params(other.scenarioId, {
        assetId: ASSET_B,
        source: 'url',
        storageKey: null,
        url: 'https://cdn.example.com/b.mp4',
        kind: 'video',
        mimeType: 'video/mp4',
        byteSize: null,
        durationMs: 1200,
      }),
    )

    expect(created).toMatchObject({ assetId: ASSET_A, byteSize: 5_000_000_000, cueable: true })
    await expect(repository.findById(ASSET_A)).resolves.toEqual(created)
    await expect(repository.findById('media_not-a-uuid')).resolves.toBeNull()
    await expect(repository.listByScenario(scenario.scenarioId)).resolves.toEqual([created])
    await expect(repository.findByIds(scenario.scenarioId, [ASSET_A, ASSET_B])).resolves.toEqual([
      created,
    ])
  })

  it('updates metadata, clears nullable fields, and nulls a deleted poster', async () => {
    const scenario = await scenarios.create({ name: 'Media C' })
    await repository.create(params(scenario.scenarioId))
    await repository.create(
      params(scenario.scenarioId, {
        assetId: ASSET_B,
        kind: 'video',
        mimeType: 'video/mp4',
        storageKey: 'b',
        posterAssetId: ASSET_A,
        durationMs: 500,
      }),
    )

    const updated = await repository.update(ASSET_B, { cueable: false, durationMs: null })
    expect(updated).toMatchObject({ cueable: false, durationMs: null, posterAssetId: ASSET_A })
    await expect(repository.update(ASSET_B, {})).resolves.toMatchObject({ assetId: ASSET_B })

    await repository.delete(ASSET_A)
    await expect(repository.findById(ASSET_B)).resolves.toMatchObject({ posterAssetId: null })
  })

  it('cascades asset rows when their scenario is deleted', async () => {
    const scenario = await scenarios.create({ name: 'Media D' })
    await repository.create(params(scenario.scenarioId))

    await scenarios.delete(scenario.scenarioId)

    await expect(repository.findById(ASSET_A)).resolves.toBeNull()
  })

  it('enforces the upload/url storage invariant', async () => {
    const scenario = await scenarios.create({ name: 'Media E' })

    await expect(
      repository.create(params(scenario.scenarioId, { source: 'url', url: null })),
    ).rejects.toThrow()
  })
})

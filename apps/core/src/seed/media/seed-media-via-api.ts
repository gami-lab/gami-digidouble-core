import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  ADMIN_SERVICE_KEY_HEADER,
  type ApiResponse,
  type GetScenarioResponse,
  type ListMediaAssetsResponse,
  type ListScenarioAvatarsResponse,
  type MediaAssetResponse,
  type MediaAssetSummary,
} from '@gami/shared'
import {
  findExistingAsset,
  mergeSlots,
  validateMediaSeedManifest,
  type MediaSeedAsset,
  type MediaSeedManifest,
} from './media-seed-manifest.js'

/**
 * Seeds a scenario's media library from a manifest through the admin API, then assigns slots and
 * triggers. Rerunnable: assets are matched by description.
 *
 *   pnpm --filter @gami/core seed:media -- --manifest src/seed/media/ava.media.json \
 *     --scenario-id scenario_... [--files-dir ./media] [--base-url http://localhost:3000]
 *
 * Requires ADMIN_SERVICE_KEY; MEDIA_SEED_API_BASE_URL may replace --base-url.
 */
type Options = { baseUrl: string; serviceKey: string; scenarioId: string; filesDir: string }

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const manifestPath = resolve(required(args['manifest'], '--manifest is required'))
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as MediaSeedManifest
  validateMediaSeedManifest(manifest)
  const options: Options = {
    baseUrl: (
      args['base-url'] ??
      process.env['MEDIA_SEED_API_BASE_URL'] ??
      'http://localhost:3000'
    ).replace(/\/$/, ''),
    serviceKey: required(process.env['ADMIN_SERVICE_KEY'], 'ADMIN_SERVICE_KEY is required'),
    scenarioId: required(args['scenario-id'], '--scenario-id is required'),
    filesDir: resolve(args['files-dir'] ?? dirname(manifestPath)),
  }
  const assetIdByKey = await seedAssets(options, manifest.assets)
  await assignScenarioSlots(options, manifest, assetIdByKey)
  await assignAvatarSlots(options, manifest, assetIdByKey)
  console.info(`Seeded ${String(assetIdByKey.size)} media asset(s) for ${options.scenarioId}.`)
}

async function seedAssets(
  options: Options,
  assets: readonly MediaSeedAsset[],
): Promise<Map<string, string>> {
  const existing = (
    await call<ListMediaAssetsResponse>(
      options,
      'GET',
      `/v1/admin/scenarios/${options.scenarioId}/media`,
    )
  ).assets
  const assetIdByKey = new Map<string, string>()
  for (const asset of assets) {
    const found = findExistingAsset(existing, asset)
    const created = found ?? (await createAsset(options, asset, assetIdByKey))
    assetIdByKey.set(asset.key, created.assetId)
    console.info(`${found === undefined ? 'created' : 'kept'} ${asset.key} -> ${created.assetId}`)
  }
  return assetIdByKey
}

async function createAsset(
  options: Options,
  asset: MediaSeedAsset,
  assetIdByKey: ReadonlyMap<string, string>,
): Promise<MediaAssetSummary> {
  const posterAssetId = asset.poster === undefined ? undefined : assetIdByKey.get(asset.poster)
  const metadata = {
    description: asset.description,
    cueable: asset.cueable ?? false,
    ...(posterAssetId !== undefined ? { posterAssetId } : {}),
    ...(asset.durationMs !== undefined ? { durationMs: asset.durationMs } : {}),
  }
  const path = `/v1/admin/scenarios/${options.scenarioId}/media`
  if ('url' in asset) {
    return (
      await call<MediaAssetResponse>(options, 'POST', path, {
        url: asset.url,
        mimeType: asset.mimeType,
        ...metadata,
      })
    ).asset
  }
  const query = new URLSearchParams(
    Object.entries(metadata).map(([key, value]): [string, string] => [key, String(value)]),
  )
  const body = await readFile(resolve(options.filesDir, asset.file))
  return (
    await call<MediaAssetResponse>(
      options,
      'POST',
      `${path}/upload?${query.toString()}`,
      body,
      asset.mimeType,
    )
  ).asset
}

async function assignScenarioSlots(
  options: Options,
  manifest: MediaSeedManifest,
  assetIdByKey: ReadonlyMap<string, string>,
): Promise<void> {
  if (manifest.scenario === undefined) return
  const { scenario } = await call<GetScenarioResponse>(
    options,
    'GET',
    `/v1/admin/scenarios/${options.scenarioId}`,
  )
  await call(options, 'PATCH', `/v1/admin/scenarios/${options.scenarioId}`, {
    presentation: mergeSlots(scenario.presentation, manifest.scenario, assetIdByKey),
  })
}

async function assignAvatarSlots(
  options: Options,
  manifest: MediaSeedManifest,
  assetIdByKey: ReadonlyMap<string, string>,
): Promise<void> {
  const { avatars } = await call<ListScenarioAvatarsResponse>(
    options,
    'GET',
    `/v1/admin/scenarios/${options.scenarioId}/avatars`,
  )
  for (const [name, slots] of Object.entries(manifest.avatars ?? {})) {
    const avatar = avatars.find((item) => item.name === name)
    if (avatar === undefined) throw new Error(`Avatar not found in scenario: ${name}`)
    await call(options, 'PATCH', `/v1/admin/avatars/${avatar.avatarId}`, {
      presentation: mergeSlots(avatar.presentation, slots.presentation, assetIdByKey),
      mediaTriggers: mergeSlots(avatar.mediaTriggers, slots.mediaTriggers, assetIdByKey),
    })
  }
}

async function call<T>(
  options: Options,
  method: string,
  path: string,
  body?: unknown,
  contentType = 'application/json',
): Promise<T> {
  const response = await fetch(`${options.baseUrl}${path}`, {
    method,
    headers: {
      [ADMIN_SERVICE_KEY_HEADER]: options.serviceKey,
      ...(body !== undefined ? { 'content-type': contentType } : {}),
    },
    ...(body === undefined ? {} : { body: body instanceof Buffer ? body : JSON.stringify(body) }),
  })
  const payload = (await response.json()) as ApiResponse<T>
  if (payload.error !== null) {
    throw new Error(`${method} ${path}: ${payload.error.code} ${payload.error.message}`)
  }
  return payload.data
}

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? ''
    const next = argv[index + 1]
    if (token.startsWith('--') && next !== undefined && !next.startsWith('--')) {
      args[token.slice(2)] = next
      index += 1
    }
  }
  return args
}

function required(value: string | undefined, message: string): string {
  if (value === undefined || value.trim().length === 0) throw new Error(message)
  return value
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}

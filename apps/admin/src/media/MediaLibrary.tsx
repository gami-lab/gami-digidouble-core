import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { formatApiError } from '../api/error'
import {
  deleteMediaAsset,
  listMediaAssets,
  updateMediaAsset,
  type MediaAssetSummary,
} from '../api/media'
import { MediaAddForm } from './MediaAddForm'
import { MediaThumbnail } from './MediaPicker'
import { formatBytes, formatDuration } from './media-format'

type MediaLibraryProps = {
  scenarioId: string
  onClose: () => void
}

type LibraryState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; assets: MediaAssetSummary[] }

export function MediaLibrary({ scenarioId, onClose }: MediaLibraryProps): JSX.Element {
  const [state, setState] = useState<LibraryState>({ status: 'loading' })
  const [rowError, setRowError] = useState<{ assetId: string; message: string } | null>(null)

  useEffect(() => {
    listMediaAssets(scenarioId)
      .then((assets) => { setState({ status: 'ready', assets }) })
      .catch((error: unknown) => {
        setState({ status: 'error', message: formatApiError(error, 'Failed to load media') })
      })
  }, [scenarioId])

  const assets = state.status === 'ready' ? state.assets : []
  const replace = (next: MediaAssetSummary[]): void => { setState({ status: 'ready', assets: next }) }

  async function run(assetId: string, action: () => Promise<MediaAssetSummary[]>): Promise<void> {
    setRowError(null)
    try {
      replace(await action())
    } catch (error: unknown) {
      setRowError({ assetId, message: formatApiError(error, 'Media update failed') })
    }
  }

  return (
    <section>
      <h2>Media library</h2>
      <p className="admin-muted">
        Images and videos for this scenario: assign them to presentation slots and character
        triggers, or let the Game Master cue them.
      </p>
      <MediaAddForm scenarioId={scenarioId} onAdded={(added) => { replace([...assets, ...added]) }} />
      {state.status === 'loading' ? <p>Loading media…</p> : null}
      {state.status === 'error' ? <p className="admin-error">{state.message}</p> : null}
      {state.status === 'ready' && assets.length === 0 ? <p className="admin-muted">No media yet.</p> : null}
      <ul className="admin-media-list">
        {assets.map((asset) => (
          <MediaAssetRow
            key={asset.assetId}
            asset={asset}
            assets={assets}
            error={rowError?.assetId === asset.assetId ? rowError.message : null}
            onSave={(changes) => void run(asset.assetId, async () => {
              const updated = await updateMediaAsset(asset.assetId, changes)
              return assets.map((item) => (item.assetId === updated.assetId ? updated : item))
            })}
            onDelete={() => void run(asset.assetId, async () => {
              await deleteMediaAsset(asset.assetId)
              return await listMediaAssets(scenarioId)
            })}
          />
        ))}
      </ul>
      <div className="admin-form-actions">
        <button type="button" className="admin-button admin-button-secondary" onClick={onClose}>
          Back to scenario
        </button>
      </div>
    </section>
  )
}

type MediaAssetRowProps = {
  asset: MediaAssetSummary
  assets: readonly MediaAssetSummary[]
  error: string | null
  onSave: (changes: { description?: string; cueable?: boolean; durationMs?: number | null }) => void
  onDelete: () => void
}

function MediaAssetRow({ asset, assets, error, onSave, onDelete }: MediaAssetRowProps): JSX.Element {
  const [description, setDescription] = useState(asset.description)
  const changed = description.trim() !== asset.description && description.trim().length > 0
  return (
    <li className="admin-media-item" aria-label={asset.description}>
      <MediaThumbnail asset={asset} assets={assets} />
      <div>
        <p className="admin-muted">
          {asset.kind} · {asset.mimeType} · {formatBytes(asset.byteSize)} · {formatDuration(asset.durationMs)}
          {asset.source === 'url' ? ' · linked URL' : ''}
        </p>
        <textarea
          className="admin-form-textarea"
          aria-label={`Description of ${asset.assetId}`}
          rows={2}
          value={description}
          onChange={(event) => { setDescription(event.target.value) }}
        />
        {asset.kind === 'image' ? <ImageDurationField asset={asset} onSave={onSave} /> : null}
        <label>
          <input
            type="checkbox"
            checked={asset.cueable}
            onChange={(event) => { onSave({ cueable: event.target.checked }) }}
          />{' '}
          Cue-able by the Game Master
        </label>
        <div className="admin-form-actions">
          <button type="button" className="admin-button admin-button-secondary" disabled={!changed} onClick={() => { onSave({ description: description.trim() }) }}>
            Save description
          </button>
          <button type="button" className="admin-remove-button" onClick={onDelete}>
            Delete
          </button>
        </div>
        {error !== null ? <p className="admin-error">{error}</p> : null}
      </div>
    </li>
  )
}

/** How long the image stays up when the Game Master or a trigger shows it; empty uses the default. */
function ImageDurationField({
  asset,
  onSave,
}: {
  asset: MediaAssetSummary
  onSave: (changes: { durationMs: number | null }) => void
}): JSX.Element {
  const [seconds, setSeconds] = useState(asset.durationMs === null ? '' : String(asset.durationMs / 1000))
  const parsed = seconds.trim() === '' ? null : Math.round(Number(seconds) * 1000)
  const valid = parsed === null || (Number.isFinite(parsed) && parsed > 0)
  return (
    <div className="admin-form-group">
      <label>
        Display seconds{' '}
        <input
          type="number"
          min={1}
          max={600}
          className="admin-form-input"
          aria-label={`Display seconds of ${asset.assetId}`}
          placeholder="8"
          value={seconds}
          onChange={(event) => { setSeconds(event.target.value) }}
        />
      </label>
      <button
        type="button"
        className="admin-button admin-button-secondary"
        disabled={!valid || parsed === asset.durationMs}
        onClick={() => { onSave({ durationMs: parsed }) }}
      >
        Save duration
      </button>
    </div>
  )
}

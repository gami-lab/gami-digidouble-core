import type { JSX } from 'react'
import type { MediaKind, MediaRef } from '@gami/shared'
import { mediaSrc, type MediaAssetSummary } from '../api/media'
import { shortDescription } from './media-format'

type MediaPickerProps = {
  id: string
  label: string
  value: MediaRef | undefined
  assets: readonly MediaAssetSummary[]
  kinds: readonly MediaKind[]
  disabled: boolean
  onChange: (value: MediaRef | undefined) => void
}

/** Picks one asset of the scenario library whose kind the slot accepts. */
export function MediaPicker({
  id,
  label,
  value,
  assets,
  kinds,
  disabled,
  onChange,
}: MediaPickerProps): JSX.Element {
  const options = assets.filter((asset) => kinds.includes(asset.kind))
  const selected = assets.find((asset) => asset.assetId === value)
  return (
    <div className="admin-form-group">
      <label htmlFor={id} className="admin-form-label">
        {label} <span className="admin-muted">({kinds.join(' or ')})</span>
      </label>
      <select
        id={id}
        className="admin-form-select"
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value === '' ? undefined : event.target.value)
        }}
      >
        <option value="">None</option>
        {value !== undefined && selected === undefined ? (
          <option value={value}>Unavailable asset ({value})</option>
        ) : null}
        {options.map((asset) => (
          <option key={asset.assetId} value={asset.assetId}>
            {asset.kind === 'video' ? '🎬' : '🖼'} {shortDescription(asset.description)}
          </option>
        ))}
      </select>
      {selected !== undefined ? <MediaThumbnail asset={selected} assets={assets} /> : null}
    </div>
  )
}

/** An image, or a video's poster (falling back to the first frame). */
export function MediaThumbnail({
  asset,
  assets,
}: {
  asset: MediaAssetSummary
  assets: readonly MediaAssetSummary[]
}): JSX.Element {
  const poster = assets.find((item) => item.assetId === asset.posterAssetId)
  if (asset.kind === 'image' || poster !== undefined) {
    return (
      <img
        className="admin-presentation-thumbnail"
        src={mediaSrc(poster ?? asset)}
        alt={asset.description}
        loading="lazy"
      />
    )
  }
  return (
    <video
      className="admin-presentation-thumbnail"
      src={mediaSrc(asset)}
      preload="metadata"
      muted
      aria-label={asset.description}
    />
  )
}

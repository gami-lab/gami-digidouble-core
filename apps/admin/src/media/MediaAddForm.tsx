import { useState } from 'react'
import type { JSX, SyntheticEvent } from 'react'
import {
  MEDIA_LIMITS,
  MEDIA_MIME_TYPES,
  mediaKindForMimeType,
  type MediaMimeType,
} from '@gami/shared'
import { formatApiError } from '../api/error'
import {
  createUrlMediaAsset,
  uploadMediaAsset,
  type MediaAssetSummary,
} from '../api/media'
import { readVideoMetadata } from './browser-media'
import { formatBytes } from './media-format'

const ALLOWED_TYPES: readonly MediaMimeType[] = [...MEDIA_MIME_TYPES.image, ...MEDIA_MIME_TYPES.video]

type MediaAddFormProps = {
  scenarioId: string
  onAdded: (assets: MediaAssetSummary[]) => void
}

type Progress = { label: string; fraction: number } | null

export function MediaAddForm({ scenarioId, onAdded }: MediaAddFormProps): JSX.Element {
  const [source, setSource] = useState<'upload' | 'url'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [mimeType, setMimeType] = useState<MediaMimeType>('video/mp4')
  const [description, setDescription] = useState('')
  const [cueable, setCueable] = useState(false)
  const [progress, setProgress] = useState<Progress>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: SyntheticEvent): Promise<void> {
    event.preventDefault()
    setError(null)
    try {
      const added =
        source === 'upload' && file !== null
          ? await uploadWithPoster(scenarioId, file, description.trim(), cueable, setProgress)
          : [await createUrlMediaAsset(scenarioId, { url: url.trim(), mimeType, description: description.trim(), cueable })]
      onAdded(added)
      setFile(null)
      setUrl('')
      setDescription('')
      setCueable(false)
    } catch (caught: unknown) {
      setError(formatApiError(caught, 'Failed to add media'))
    } finally {
      setProgress(null)
    }
  }

  const busy = progress !== null
  const ready = description.trim().length > 0 && hasSource(source, file, url)

  return (
    <form className="admin-media-add" onSubmit={(event) => void handleSubmit(event)}>
      <h3>Add media</h3>
      <div className="admin-form-group" role="radiogroup" aria-label="Media source">
        <label>
          <input type="radio" checked={source === 'upload'} disabled={busy} onChange={() => { setSource('upload') }} />{' '}
          Upload a file
        </label>{' '}
        <label>
          <input type="radio" checked={source === 'url'} disabled={busy} onChange={() => { setSource('url') }} />{' '}
          Link a URL
        </label>
      </div>
      {source === 'upload' ? (
        <UploadField file={file} busy={busy} onChange={setFile} />
      ) : (
        <UrlFields url={url} mimeType={mimeType} busy={busy} onUrlChange={setUrl} onMimeTypeChange={setMimeType} />
      )}
      <div className="admin-form-group">
        <label htmlFor="media-description" className="admin-form-label">Description</label>
        <textarea
          id="media-description"
          className="admin-form-textarea"
          rows={3}
          value={description}
          maxLength={MEDIA_LIMITS.descriptionMaxLength}
          disabled={busy}
          onChange={(event) => { setDescription(event.target.value) }}
        />
        <p className="admin-muted">
          The Game Master reads this to decide when to show the media: say what the image or video
          shows (people, place, moment), not the file name.
        </p>
      </div>
      <label className="admin-form-group">
        <input type="checkbox" checked={cueable} disabled={busy} onChange={(event) => { setCueable(event.target.checked) }} />{' '}
        The Game Master may cue this during conversations
      </label>
      {progress !== null ? (
        <p role="status">
          {progress.label} <progress value={progress.fraction} max={1} />
        </p>
      ) : null}
      {error !== null ? <p className="admin-error">{error}</p> : null}
      <div className="admin-form-actions">
        <button type="submit" className="admin-button admin-button-primary" disabled={busy || !ready}>
          {busy ? 'Adding…' : 'Add media'}
        </button>
      </div>
    </form>
  )
}

function hasSource(source: 'upload' | 'url', file: File | null, url: string): boolean {
  if (source === 'url') return url.trim().length > 0
  return file !== null && validateFile(file) === null
}

function UploadField({
  file,
  busy,
  onChange,
}: {
  file: File | null
  busy: boolean
  onChange: (file: File | null) => void
}): JSX.Element {
  const fileError = file === null ? null : validateFile(file)
  return (
    <div className="admin-form-group">
      <label htmlFor="media-file" className="admin-form-label">File</label>
      <input
        id="media-file"
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        disabled={busy}
        onChange={(event) => { onChange(event.target.files?.[0] ?? null) }}
      />
      <p className="admin-muted">
        JPEG, PNG, or WebP images up to {formatBytes(MEDIA_LIMITS.maxUploadBytes.image)}; MP4 or
        WebM videos up to {formatBytes(MEDIA_LIMITS.maxUploadBytes.video)}. Videos get their
        duration and a poster frame from your browser.
      </p>
      {fileError !== null ? <p className="admin-error">{fileError}</p> : null}
    </div>
  )
}

type UrlFieldsProps = {
  url: string
  mimeType: MediaMimeType
  busy: boolean
  onUrlChange: (url: string) => void
  onMimeTypeChange: (mimeType: MediaMimeType) => void
}

function UrlFields({ url, mimeType, busy, onUrlChange, onMimeTypeChange }: UrlFieldsProps): JSX.Element {
  return (
    <>
      <div className="admin-form-group">
        <label htmlFor="media-url" className="admin-form-label">URL</label>
        <input id="media-url" type="url" className="admin-form-input" value={url} maxLength={MEDIA_LIMITS.urlMaxLength} disabled={busy} placeholder="https://…" onChange={(event) => { onUrlChange(event.target.value) }} />
      </div>
      <div className="admin-form-group">
        <label htmlFor="media-mime" className="admin-form-label">Type</label>
        <select id="media-mime" className="admin-form-select" value={mimeType} disabled={busy} onChange={(event) => { onMimeTypeChange(event.target.value as MediaMimeType) }}>
          {ALLOWED_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </div>
    </>
  )
}

function validateFile(file: File): string | null {
  const kind = mediaKindForMimeType(file.type)
  if (kind === null) return `${file.type || 'This file type'} is not supported.`
  const limit = MEDIA_LIMITS.maxUploadBytes[kind]
  return file.size > limit ? `The file is larger than ${formatBytes(limit)}.` : null
}

/** A video is uploaded after its poster frame so the video can reference it. */
async function uploadWithPoster(
  scenarioId: string,
  file: File,
  description: string,
  cueable: boolean,
  setProgress: (progress: Progress) => void,
): Promise<MediaAssetSummary[]> {
  if (mediaKindForMimeType(file.type) !== 'video') {
    setProgress({ label: 'Uploading…', fraction: 0 })
    const image = await uploadMediaAsset(scenarioId, { file, description, cueable }, (fraction) => {
      setProgress({ label: 'Uploading…', fraction })
    })
    return [image]
  }
  setProgress({ label: 'Reading video…', fraction: 0 })
  const metadata = await readVideoMetadata(file)
  const poster =
    metadata.poster === null
      ? null
      : await uploadMediaAsset(scenarioId, {
          file: metadata.poster,
          description: `Poster frame: ${description}`,
          cueable: false,
        })
  const video = await uploadMediaAsset(
    scenarioId,
    {
      file,
      description,
      cueable,
      ...(poster !== null ? { posterAssetId: poster.assetId } : {}),
      ...(metadata.durationMs !== null ? { durationMs: metadata.durationMs } : {}),
    },
    (fraction) => {
      setProgress({ label: 'Uploading video…', fraction })
    },
  )
  return poster === null ? [video] : [poster, video]
}

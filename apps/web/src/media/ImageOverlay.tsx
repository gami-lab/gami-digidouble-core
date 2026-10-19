import { useEffect, useRef } from 'react'
import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
import type { PublicMediaAsset } from '@gami/shared'
import type { MediaEndOutcome } from './FullscreenVideo'
import { resolveMediaUrl } from './media-url'

/** How long an image stays up when its asset sets no duration. */
export const DEFAULT_IMAGE_OVERLAY_MS = 8000

type ImageOverlayProps = {
  asset: PublicMediaAsset
  onStarted: () => void
  onEnd: (outcome: MediaEndOutcome) => void
}

/** An image over the conversation, dismissed by the visitor or after its duration. */
export function ImageOverlay({ asset, onStarted, onEnd }: ImageOverlayProps): JSX.Element {
  const { t } = useTranslation()
  const closeRef = useRef<HTMLButtonElement>(null)
  const endRef = useRef(onEnd)
  endRef.current = onEnd

  useEffect(() => {
    const previous = document.activeElement
    closeRef.current?.focus()
    const timer = setTimeout(() => {
      endRef.current('completed')
    }, asset.durationMs ?? DEFAULT_IMAGE_OVERLAY_MS)
    return () => {
      clearTimeout(timer)
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [asset.durationMs])

  return (
    <figure className="media-overlay" role="dialog" aria-label={asset.description}>
      <img
        className="media-image"
        src={resolveMediaUrl(asset.url)}
        alt={asset.description}
        onLoad={onStarted}
        onError={() => {
          onEnd('failed')
        }}
      />
      <button
        ref={closeRef}
        type="button"
        className="button-secondary"
        onClick={() => {
          onEnd('skipped')
        }}
      >
        {t('media.close')}
      </button>
    </figure>
  )
}

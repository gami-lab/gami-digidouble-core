import type { JSX } from 'react'
import type { AvailableAvatarSummary } from '@gami/shared'
import { resolveMediaUrl } from '../media/media-url'

type PortraitProps = {
  avatar: Pick<AvailableAvatarSummary, 'name' | 'presentation'>
  size: 'card' | 'stage'
}

/** The authored portrait, or the character's initial when none is authored. */
export function Portrait({ avatar, size }: PortraitProps): JSX.Element {
  const portrait = avatar.presentation?.portrait
  if (portrait !== undefined) {
    return (
      <img
        className={`portrait portrait-${size}`}
        src={resolveMediaUrl(portrait.url)}
        alt={avatar.name}
        loading="lazy"
      />
    )
  }
  return (
    <span
      className={`portrait portrait-${size} portrait-placeholder`}
      role="img"
      aria-label={avatar.name}
    >
      {avatar.name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

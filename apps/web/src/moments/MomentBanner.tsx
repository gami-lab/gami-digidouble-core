import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
import type { AvailableAvatarSummary } from '@gami/shared'
import { Portrait } from '../conversation/Portrait'
import type { RuntimeMoment } from './runtime-moments'

type MomentBannerProps = {
  moment: RuntimeMoment
  avatar: AvailableAvatarSummary
  onTalk: () => void
  onDismiss: () => void
}

/** A GM unlock or suggestion told in-world; it never switches by itself. */
export function MomentBanner({
  moment,
  avatar,
  onTalk,
  onDismiss,
}: MomentBannerProps): JSX.Element {
  const { t } = useTranslation()
  return (
    <aside className={`moment moment-${moment.kind}`} aria-live="polite">
      <Portrait avatar={avatar} size="card" />
      <div className="moment-body">
        <p className="moment-line">
          {t(moment.kind === 'unlocked' ? 'moments.unlocked' : 'moments.suggested', {
            name: avatar.name,
          })}
        </p>
        {avatar.presentation?.hook !== undefined ? (
          <p className="moment-hook">{avatar.presentation.hook}</p>
        ) : null}
        <div className="story-actions">
          <button type="button" className="button-primary" onClick={onTalk}>
            {t('moments.talkTo', { name: avatar.name })}
          </button>
          <button type="button" className="button-secondary" onClick={onDismiss}>
            {t('moments.later')}
          </button>
        </div>
      </div>
    </aside>
  )
}

import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
import type { AvailableAvatarSummary, PublicScenarioSummary } from '@gami/shared'
import { BackButton, StoryCard } from './StoryScreens'

type CharacterChoiceScreenProps = {
  scenario: PublicScenarioSummary
  avatars: AvailableAvatarSummary[]
  loading: boolean
  error: string | null
  onChoose: (avatarId: string) => void
  onBack: () => void
}

export function CharacterChoiceScreen({
  scenario,
  avatars,
  loading,
  error,
  onChoose,
  onBack,
}: CharacterChoiceScreenProps): JSX.Element {
  const { t } = useTranslation()
  return (
    <StoryCard titleId="characters-title" cover={scenario.presentation?.cover}>
      <h1 id="characters-title">{t('characters.title')}</h1>
      {loading ? <p className="lead">{t('characters.loading')}</p> : null}
      {!loading && avatars.length === 0 ? <p className="lead">{t('characters.empty')}</p> : null}
      <div className="story-choices">
        {avatars.map((avatar) => (
          <button
            key={avatar.avatarId}
            type="button"
            className="story-choice"
            aria-label={t('characters.talkTo', { name: avatar.name })}
            onClick={() => {
              onChoose(avatar.avatarId)
            }}
          >
            <strong>{avatar.name}</strong>
            {avatar.presentation?.hook !== undefined ? (
              <span>{avatar.presentation.hook}</span>
            ) : null}
          </button>
        ))}
      </div>
      {error !== null ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="story-actions">
        <BackButton onBack={onBack} />
      </div>
    </StoryCard>
  )
}

import type { JSX, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { AvailableAvatarSummary, PublicScenarioSummary } from '@gami/shared'
import { CharacterCard } from '../conversation/CharacterCard'
import { BackButton, StoryCard } from './StoryScreens'

type CharacterChoiceScreenProps = {
  scenario: PublicScenarioSummary
  notice: ReactNode
  avatars: AvailableAvatarSummary[]
  loading: boolean
  error: string | null
  onChoose: (avatarId: string, firstMessage?: string) => void
  onBack: () => void
}

export function CharacterChoiceScreen({
  scenario,
  notice,
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
      {notice}
      {loading ? <p className="lead">{t('characters.loading')}</p> : null}
      {!loading && avatars.length === 0 ? <p className="lead">{t('characters.empty')}</p> : null}
      <div className="character-cards">
        {avatars.map((avatar) => (
          <CharacterCard
            key={avatar.avatarId}
            avatar={avatar}
            onChoose={(firstMessage) => {
              onChoose(avatar.avatarId, firstMessage)
            }}
          />
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

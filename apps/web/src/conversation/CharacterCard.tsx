import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
import type { AvailableAvatarSummary } from '@gami/shared'
import { Portrait } from './Portrait'

type CharacterCardProps = {
  avatar: AvailableAvatarSummary
  onChoose: (firstMessage?: string) => void
}

export function CharacterCard({ avatar, onChoose }: CharacterCardProps): JSX.Element {
  const { t } = useTranslation()
  const questions = avatar.presentation?.starterQuestions ?? []
  return (
    <article className="character-card" aria-labelledby={`character-${avatar.avatarId}`}>
      <button
        type="button"
        className="character-card-main"
        aria-label={t('characters.talkTo', { name: avatar.name })}
        onClick={() => {
          onChoose()
        }}
      >
        <Portrait avatar={avatar} size="card" />
        <strong id={`character-${avatar.avatarId}`}>{avatar.name}</strong>
        {avatar.presentation?.hook !== undefined ? <span>{avatar.presentation.hook}</span> : null}
      </button>
      {questions.length > 0 ? (
        <ul
          className="character-card-questions"
          aria-label={t('characters.askAbout', { name: avatar.name })}
        >
          {questions.map((question) => (
            <li key={question}>
              <button
                type="button"
                className="starter-question"
                onClick={() => {
                  onChoose(question)
                }}
              >
                {question}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  )
}

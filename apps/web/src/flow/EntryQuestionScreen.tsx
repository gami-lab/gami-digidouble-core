import { useState } from 'react'
import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
import type { PublicScenarioSummary, ScenarioEntryQuestion } from '@gami/shared'
import { updateUserPersonaField } from '../api/users'
import { BackButton, StoryCard } from './StoryScreens'

type EntryQuestionScreenProps = {
  scenario: PublicScenarioSummary
  question: ScenarioEntryQuestion
  onDone: () => void
  onBack: () => void
}

export function EntryQuestionScreen({
  scenario,
  question,
  onDone,
  onBack,
}: EntryQuestionScreenProps): JSX.Element {
  const { t } = useTranslation()
  const [answer, setAnswer] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle')

  async function submit(): Promise<void> {
    const trimmed = answer.trim()
    if (trimmed.length === 0) return
    setStatus('saving')
    try {
      await updateUserPersonaField(question.personaField, trimmed)
      onDone()
    } catch {
      setStatus('error')
    }
  }

  return (
    <StoryCard titleId="entry-question-title" cover={scenario.presentation?.cover}>
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <label className="field">
          <span id="entry-question-title" className="story-question">
            {question.prompt}
          </span>
          <input
            name="entryAnswer"
            value={answer}
            aria-label={t('entryQuestion.answerLabel')}
            autoComplete="off"
            autoFocus
            onChange={(event) => {
              setAnswer(event.target.value)
            }}
          />
        </label>
        {status === 'error' ? (
          <p className="error" role="alert">
            {t('entryQuestion.error')}
          </p>
        ) : null}
        <div className="story-actions">
          <button
            type="submit"
            className="button-primary"
            disabled={status === 'saving' || answer.trim().length === 0}
          >
            {status === 'saving' ? t('entryQuestion.saving') : t('entryQuestion.submit')}
          </button>
          <button type="button" className="button-secondary" onClick={onDone}>
            {t('common.skip')}
          </button>
          <BackButton onBack={onBack} />
        </div>
      </form>
    </StoryCard>
  )
}

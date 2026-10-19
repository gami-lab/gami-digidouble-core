import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'

type IdleHintProps = {
  avatarName: string
  question: string | null
  onAsk: (question: string) => void
}

export function IdleHint({ avatarName, question, onAsk }: IdleHintProps): JSX.Element {
  const { t } = useTranslation()
  return (
    <aside className="idle-hint" aria-live="polite">
      <p className="idle-hint-title">{t('hint.title')}</p>
      {question !== null ? (
        <button
          type="button"
          className="starter-question"
          onClick={() => {
            onAsk(question)
          }}
        >
          {t('hint.ask', { question })}
        </button>
      ) : (
        <p>{t('hint.generic', { name: avatarName })}</p>
      )}
    </aside>
  )
}

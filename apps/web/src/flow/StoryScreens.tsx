import type { JSX, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { PublicScenarioSummary } from '@gami/shared'
import { LanguageSwitcher } from '../i18n/LanguageSwitcher'

type StoryCardProps = {
  titleId: string
  cover?: string | undefined
  children: ReactNode
}

export function StoryCard({ titleId, cover, children }: StoryCardProps): JSX.Element {
  return (
    <main className="page">
      <section className="card story-card" aria-labelledby={titleId}>
        <div className="story-top-bar">
          <LanguageSwitcher />
        </div>
        {cover !== undefined ? <img className="story-cover" src={cover} alt="" /> : null}
        {children}
      </section>
    </main>
  )
}

export function LoadingScreen(): JSX.Element {
  const { t } = useTranslation()
  return (
    <StoryCard titleId="loading-title">
      <p id="loading-title" className="lead" role="status">
        {t('common.loading')}
      </p>
    </StoryCard>
  )
}

export function ErrorScreen({ onRetry }: { onRetry: () => void }): JSX.Element {
  const { t } = useTranslation()
  return (
    <StoryCard titleId="error-title">
      <p id="error-title" className="error" role="alert">
        {t('errors.loadFailed')}
      </p>
      <button type="button" className="button-primary" onClick={onRetry}>
        {t('common.retry')}
      </button>
    </StoryCard>
  )
}

type ScenarioPickerScreenProps = {
  scenarios: PublicScenarioSummary[]
  onPick: (scenarioId: string) => void
}

export function ScenarioPickerScreen({
  scenarios,
  onPick,
}: ScenarioPickerScreenProps): JSX.Element {
  const { t } = useTranslation()
  return (
    <StoryCard titleId="picker-title">
      <h1 id="picker-title">{t('picker.title')}</h1>
      {scenarios.length === 0 ? <p className="lead">{t('picker.empty')}</p> : null}
      <div className="story-choices">
        {scenarios.map((scenario) => (
          <button
            key={scenario.scenarioId}
            type="button"
            className="story-choice"
            onClick={() => {
              onPick(scenario.scenarioId)
            }}
          >
            <strong>{scenario.name}</strong>
            {scenario.presentation?.tagline !== undefined ? (
              <span>{scenario.presentation.tagline}</span>
            ) : null}
          </button>
        ))}
      </div>
    </StoryCard>
  )
}

type StoryStepProps = {
  scenario: PublicScenarioSummary
  onNext: () => void
  onBack?: (() => void) | undefined
}

export function LandingScreen({ scenario, onNext, onBack }: StoryStepProps): JSX.Element {
  const { t } = useTranslation()
  const presentation = scenario.presentation
  return (
    <StoryCard titleId="landing-title" cover={presentation?.cover}>
      <h1 id="landing-title">{scenario.name}</h1>
      {presentation?.tagline !== undefined ? <p className="lead">{presentation.tagline}</p> : null}
      <div className="story-actions">
        <button type="button" className="button-primary" onClick={onNext}>
          {t('landing.begin')}
        </button>
        {onBack !== undefined ? <BackButton onBack={onBack} /> : null}
      </div>
    </StoryCard>
  )
}

export function IntroScreen({ scenario, onNext, onBack }: StoryStepProps): JSX.Element {
  const { t } = useTranslation()
  const presentation = scenario.presentation
  return (
    <StoryCard titleId="intro-title" cover={presentation?.cover}>
      <h1 id="intro-title">{scenario.name}</h1>
      <p className="story-text">{presentation?.introText ?? t('intro.fallback')}</p>
      <div className="story-actions">
        <button type="button" className="button-primary" onClick={onNext}>
          {t('common.continue')}
        </button>
        {onBack !== undefined ? <BackButton onBack={onBack} /> : null}
      </div>
    </StoryCard>
  )
}

export function OutroScreen({ scenario, onNext }: StoryStepProps): JSX.Element {
  const { t } = useTranslation()
  const presentation = scenario.presentation
  return (
    <StoryCard titleId="outro-title" cover={presentation?.cover}>
      <h1 id="outro-title">{t('outro.title')}</h1>
      <p className="story-text">{presentation?.outroText ?? t('outro.fallback')}</p>
      <div className="story-actions">
        <button type="button" className="button-primary" onClick={onNext}>
          {t('outro.restart')}
        </button>
      </div>
    </StoryCard>
  )
}

export function BackButton({ onBack }: { onBack: () => void }): JSX.Element {
  const { t } = useTranslation()
  return (
    <button type="button" className="button-secondary" onClick={onBack}>
      {t('common.back')}
    </button>
  )
}

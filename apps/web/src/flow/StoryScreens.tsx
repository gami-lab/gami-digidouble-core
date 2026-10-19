import { useEffect, useRef, useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { PublicMediaAsset, PublicScenarioSummary } from '@gami/shared'
import { LanguageSwitcher } from '../i18n/LanguageSwitcher'
import { resolveMediaUrl } from '../media/media-url'
import { FullscreenVideo } from '../media/FullscreenVideo'

type StoryCardProps = {
  titleId: string
  cover?: PublicMediaAsset | undefined
  children: ReactNode
}

/** Each screen moves focus to its title (unless a field took it) so keyboard and screen-reader
 * users start at the top of the new step. */
export function StoryCard({ titleId, cover, children }: StoryCardProps): JSX.Element {
  const sectionRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const section = sectionRef.current
    if (section === null || section.contains(document.activeElement)) return
    const title = document.getElementById(titleId)
    title?.setAttribute('tabindex', '-1')
    title?.focus()
  }, [titleId])
  return (
    <main className="page">
      <section ref={sectionRef} className="card story-card" aria-labelledby={titleId}>
        <div className="story-top-bar">
          <LanguageSwitcher />
        </div>
        {cover !== undefined ? (
          <img className="story-cover" src={resolveMediaUrl(cover.url)} alt="" />
        ) : null}
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

/**
 * A slot video plays first, full screen with skip; afterwards the step shows its text, or moves on
 * at once when it has none (`onTextless`). A slot image replaces the cover.
 */
function useSlotVideo(
  media: PublicMediaAsset | undefined,
  onTextless: (() => void) | null,
): JSX.Element | null {
  const [done, setDone] = useState(media?.kind !== 'video')
  if (done || media === undefined) return null
  return (
    <FullscreenVideo
      asset={media}
      onEnd={() => {
        if (onTextless !== null) onTextless()
        else setDone(true)
      }}
    />
  )
}

function slotCover(
  media: PublicMediaAsset | undefined,
  cover: PublicMediaAsset | undefined,
): PublicMediaAsset | undefined {
  return media?.kind === 'image' ? media : cover
}

export function IntroScreen({ scenario, onNext, onBack }: StoryStepProps): JSX.Element {
  const { t } = useTranslation()
  const presentation = scenario.presentation
  const video = useSlotVideo(
    presentation?.introMedia,
    presentation?.introText === undefined ? onNext : null,
  )
  if (video !== null) return video
  return (
    <StoryCard titleId="intro-title" cover={slotCover(presentation?.introMedia, presentation?.cover)}>
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
  const video = useSlotVideo(presentation?.outroMedia, null)
  if (video !== null) return video
  return (
    <StoryCard titleId="outro-title" cover={slotCover(presentation?.outroMedia, presentation?.cover)}>
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

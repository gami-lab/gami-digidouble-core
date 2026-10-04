import { useState } from 'react'
import type { JSX } from 'react'
import {
  AVATAR_COMPUTED_TRAIT_KEYS,
  AVATAR_COMPUTED_TRAIT_LABELS,
  type AvatarSummary,
  type AvatarTraitPreparationResult,
} from '@gami/shared'
import { formatApiError } from '../../api/error'
import { listScenarioAvatars, prepareAvatarTraits } from '../../api/scenarios'
import { Badge, Empty, ErrorText, KeyValues, Section, TextList } from '../../ui/ui'
import { useAsync } from '../../ui/use-async'

export function AvatarsTab({ scenarioId }: { scenarioId: string }): JSX.Element {
  const avatars = useAsync(() => listScenarioAvatars(scenarioId), [scenarioId])
  const preparation = usePreparation(scenarioId, avatars.reload)

  return (
    <div className="stack">
      <div className="row spread">
        <p className="muted">
          Trait preparation is an LLM call that turns each authored persona and the scenario’s
          knowledge into the structured traits the Avatar is prompted with.
        </p>
        <button type="button" onClick={preparation.run} disabled={preparation.isRunning}>
          {preparation.isRunning ? 'Preparing…' : 'Re-prepare all traits'}
        </button>
      </div>
      <ErrorText error={avatars.error ?? preparation.error} />
      {avatars.data?.length === 0 ? <Empty>No avatars in this scenario.</Empty> : null}
      {(avatars.data ?? []).map((avatar) => (
        <AvatarSection
          key={avatar.avatarId}
          avatar={avatar}
          result={preparation.results?.find((result) => result.avatarId === avatar.avatarId)}
        />
      ))}
    </div>
  )
}

function usePreparation(
  scenarioId: string,
  onDone: () => void,
): {
  run: () => void
  isRunning: boolean
  error: string | null
  results: AvatarTraitPreparationResult[] | null
} {
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<AvatarTraitPreparationResult[] | null>(null)

  function run(): void {
    if (
      !window.confirm('Re-run trait preparation for every avatar? This overwrites prepared traits.')
    ) {
      return
    }
    setIsRunning(true)
    setError(null)
    prepareAvatarTraits(scenarioId)
      .then((response) => {
        setResults(response.results)
        onDone()
      })
      .catch((prepareError: unknown) => {
        setError(formatApiError(prepareError, 'Trait preparation failed'))
      })
      .finally(() => {
        setIsRunning(false)
      })
  }

  return { run, isRunning, error, results }
}

// eslint-disable-next-line complexity -- render-only branching
function AvatarSection({
  avatar,
  result,
}: {
  avatar: AvatarSummary
  result: AvatarTraitPreparationResult | undefined
}): JSX.Element {
  const traits = avatar.computedTraits
  const traitCount =
    traits === undefined
      ? 0
      : AVATAR_COMPUTED_TRAIT_KEYS.reduce((sum, key) => sum + traits[key].length, 0)

  return (
    <Section
      title={avatar.name}
      aside={
        <>
          <Badge tone={avatar.status === 'active' ? 'ok' : 'neutral'}>{avatar.status}</Badge>
          <Badge tone={traitCount > 0 ? 'accent' : 'warn'}>
            {traitCount > 0 ? `${String(traitCount)} traits` : 'not prepared'}
          </Badge>
          {result?.status === 'prepared' ? <Badge tone="ok">re-prepared</Badge> : null}
          {result?.status === 'failed' ? <Badge tone="error">failed: {result.reason}</Badge> : null}
        </>
      }
    >
      <Section
        nested
        title="Authored input"
        aside={<span className="muted small">sent to preparation</span>}
      >
        <KeyValues
          items={[
            ['Description', avatar.description ?? '—'],
            ['Tone', avatar.tone ?? '—'],
            ['Adjustments', <TextList items={avatar.adjustments ?? []} empty="None" />],
            ['Persona prompt', <span className="prewrap">{avatar.personaPrompt}</span>],
            [
              'Model override',
              avatar.llmOverride
                ? [avatar.llmOverride.provider, avatar.llmOverride.model].filter(Boolean).join('/')
                : 'Scenario default',
            ],
          ]}
        />
      </Section>
      {traits === undefined ? (
        <Empty>No prepared traits: this avatar cannot serve turns yet.</Empty>
      ) : (
        <Section
          nested
          defaultOpen
          title="Prepared traits"
          aside={<span className="muted small">used in every Avatar prompt</span>}
        >
          <KeyValues
            items={AVATAR_COMPUTED_TRAIT_KEYS.map((key) => [
              AVATAR_COMPUTED_TRAIT_LABELS[key],
              <TextList items={traits[key]} empty="—" />,
            ])}
          />
        </Section>
      )}
    </Section>
  )
}

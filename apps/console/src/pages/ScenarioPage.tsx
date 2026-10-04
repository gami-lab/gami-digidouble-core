import type { JSX } from 'react'
import type { ScenarioSummary } from '@gami/shared'
import { getScenario } from '../api/scenarios'
import { Link } from '../routing/Link'
import type { Route, ScenarioTab } from '../routing/router'
import { Badge, Empty, ErrorText, KeyValues, Section, TextList } from '../ui/ui'
import { useAsync } from '../ui/use-async'
import { AvatarsTab } from './scenario/AvatarsTab'
import { KnowledgeTab } from './scenario/KnowledgeTab'
import { SessionsTab } from './scenario/SessionsTab'

const tabLabels: Record<ScenarioTab, string> = {
  sessions: 'Sessions',
  avatars: 'Avatar preparation',
  knowledge: 'Knowledge & RAG',
}

export function ScenarioPage({
  route,
}: {
  route: Extract<Route, { name: 'scenario' }>
}): JSX.Element {
  const scenario = useAsync(() => getScenario(route.scenarioId), [route.scenarioId])

  return (
    <main className="page">
      <nav className="crumbs">
        <Link to={{ name: 'scenarios' }}>Scenarios</Link>
        <span>/</span>
        <span>{scenario.data?.name ?? route.scenarioId}</span>
      </nav>
      <ErrorText error={scenario.error} />
      {scenario.data === null ? (
        <Empty>Loading scenario…</Empty>
      ) : (
        <ScenarioHeader scenario={scenario.data} />
      )}
      <nav className="tabs">
        {(Object.keys(tabLabels) as ScenarioTab[]).map((tab) => (
          <Link
            key={tab}
            to={{ name: 'scenario', scenarioId: route.scenarioId, tab }}
            current={tab === route.tab}
          >
            {tabLabels[tab]}
          </Link>
        ))}
      </nav>
      {route.tab === 'sessions' ? <SessionsTab scenarioId={route.scenarioId} /> : null}
      {route.tab === 'avatars' ? <AvatarsTab scenarioId={route.scenarioId} /> : null}
      {route.tab === 'knowledge' ? <KnowledgeTab scenarioId={route.scenarioId} /> : null}
    </main>
  )
}

function ScenarioHeader({ scenario }: { scenario: ScenarioSummary }): JSX.Element {
  const models = scenario.modelSelection
  return (
    <div className="stack">
      <div className="row">
        <h1>{scenario.name}</h1>
        <Badge tone={scenario.status === 'active' ? 'ok' : 'neutral'}>{scenario.status}</Badge>
        {scenario.language !== undefined ? <Badge>{scenario.language}</Badge> : null}
      </div>
      <Section
        title="Scenario setup"
        aside={<span className="muted small">world, goals, models</span>}
      >
        <KeyValues
          items={[
            ['World context', <span className="prewrap">{scenario.worldContext || '—'}</span>],
            ['Objectives', <TextList items={scenario.objectives} empty="None" />],
            [
              'Model selection',
              models === undefined
                ? 'Global defaults'
                : (
                    [
                      'defaultProfile',
                      'avatarOverride',
                      'gameMasterOverride',
                      'memoryOverride',
                    ] as const
                  )
                    .flatMap((slot) => {
                      const value = models[slot]
                      return value === undefined
                        ? []
                        : [`${slot}: ${value.provider}/${value.model}`]
                    })
                    .join(' · '),
            ],
          ]}
        />
      </Section>
    </div>
  )
}

import { useState } from 'react'
import type { JSX } from 'react'
import { AppShell } from './shell/AppShell'
import { ScenarioCreatePage } from './scenarios/ScenarioCreatePage'
import { ScenarioDetailPage } from './scenarios/ScenarioDetailPage'
import { ScenarioListPage } from './scenarios/ScenarioListPage'

type AdminView =
  | { name: 'scenario-list' }
  | { name: 'scenario-create' }
  | { name: 'scenario-detail'; scenarioId: string }

function App(): JSX.Element {
  const [view, setView] = useState<AdminView>({ name: 'scenario-list' })

  return (
    <AppShell activeModuleId="scenarios">
      {view.name === 'scenario-list' ? (
        <ScenarioListPage
          onOpenScenario={(scenarioId) => {
            setView({ name: 'scenario-detail', scenarioId })
          }}
          onCreateScenario={() => {
            setView({ name: 'scenario-create' })
          }}
        />
      ) : view.name === 'scenario-create' ? (
        <ScenarioCreatePage
          onBack={() => {
            setView({ name: 'scenario-list' })
          }}
          onCreated={(scenarioId) => {
            setView({ name: 'scenario-detail', scenarioId })
          }}
        />
      ) : (
        <ScenarioDetailPage
          scenarioId={view.scenarioId}
          onBack={() => {
            setView({ name: 'scenario-list' })
          }}
        />
      )}
    </AppShell>
  )
}

export default App

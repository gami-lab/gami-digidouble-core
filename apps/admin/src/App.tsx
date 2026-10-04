import type { JSX } from 'react'
import { ModelConfigPage } from './model-config/ModelConfigPage'
import { navigate, navigateUp, useRoute, useScrollRestoration } from './routing/router'
import { AppShell } from './shell/AppShell'
import { Breadcrumbs } from './shell/Breadcrumbs'
import { ScenarioCreatePage } from './scenarios/ScenarioCreatePage'
import { ScenarioDetailPage } from './scenarios/ScenarioDetailPage'
import { ScenarioListPage } from './scenarios/ScenarioListPage'

function App(): JSX.Element {
  const route = useRoute()
  useScrollRestoration(route)
  const activeModuleId = route.name === 'model-config' ? 'model-config' : 'scenarios'

  return (
    <AppShell activeModuleId={activeModuleId}>
      {route.name === 'scenario-list' ? (
        <ScenarioListPage
          onCreateScenario={() => {
            navigate({ name: 'scenario-create' })
          }}
        />
      ) : route.name === 'scenario-create' ? (
        <ScenarioCreatePage
          onBack={() => {
            navigateUp({ name: 'scenario-list' })
          }}
          onCreated={(scenarioId) => {
            navigate({ name: 'scenario-detail', scenarioId, mode: { kind: 'view' } }, { replace: true })
          }}
        />
      ) : route.name === 'model-config' ? (
        <ModelConfigPage />
      ) : route.name === 'scenario-detail' ? (
        <ScenarioDetailPage key={route.scenarioId} scenarioId={route.scenarioId} mode={route.mode} />
      ) : (
        <section className="admin-card">
          <Breadcrumbs items={[{ label: 'Scenarios', to: { name: 'scenario-list' } }, { label: 'Not found' }]} />
          <p className="admin-error">This page does not exist.</p>
        </section>
      )}
    </AppShell>
  )
}

export default App

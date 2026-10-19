import { describe, expect, it } from 'vitest'
import type {
  ApiResponse,
  CreateAvatarResponse,
  CreateScenarioResponse,
  ListPublicScenariosResponse,
  ListScenarioAvatarsResponse,
  UpdateScenarioResponse,
} from '@gami/shared'
import { stackPlayerHeaders, STACK_SERVICE_KEY } from './stack-e2e-auth.js'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'

async function admin<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${APP_URL}${path}`, {
    method,
    headers: {
      'x-admin-service-key': STACK_SERVICE_KEY,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const payload = (await response.json()) as ApiResponse<T>
  if (payload.data === undefined || payload.data === null) {
    throw new Error(JSON.stringify(payload.error))
  }
  return payload.data
}

describe('Stack E2E — presentation round trip', () => {
  it('persists authored presentation in PostgreSQL and projects it to the player', async () => {
    const presentation = {
      tagline: `Stack presentation ${String(Date.now())}`,
      entryQuestion: { prompt: 'Who are you?', personaField: 'name' },
    }
    const { scenario } = await admin<CreateScenarioResponse>('POST', '/v1/admin/scenarios', {
      name: 'Presentation stack scenario',
      status: 'active',
      language: 'en',
      presentation,
    })
    const avatarPresentation = { hook: 'Stack hook', starterQuestions: ['First?', 'Second?'] }
    await admin<CreateAvatarResponse>(
      'POST',
      `/v1/admin/scenarios/${scenario.scenarioId}/avatars`,
      {
        name: 'Presenter',
        personaPrompt: 'You present.',
        presentation: avatarPresentation,
      },
    )

    const updated = await admin<UpdateScenarioResponse>(
      'PATCH',
      `/v1/admin/scenarios/${scenario.scenarioId}`,
      { config: { goals: ['stack goal'] } },
    )
    expect(updated.scenario.presentation).toEqual(presentation)
    expect(updated.scenario.config).toEqual({ goals: ['stack goal'] })

    const { avatars } = await admin<ListScenarioAvatarsResponse>(
      'GET',
      `/v1/admin/scenarios/${scenario.scenarioId}/avatars`,
    )
    expect(avatars[0]?.presentation).toEqual(avatarPresentation)

    const catalogue = await fetch(`${APP_URL}/v1/scenarios`, { headers: stackPlayerHeaders() })
    const listed = ((await catalogue.json()) as ApiResponse<ListPublicScenariosResponse>).data
    expect(listed?.scenarios.find((item) => item.scenarioId === scenario.scenarioId)).toEqual({
      scenarioId: scenario.scenarioId,
      name: 'Presentation stack scenario',
      language: 'en',
      presentation,
    })

    await admin('DELETE', `/v1/admin/avatars/${avatars[0]?.avatarId ?? ''}`)
    await admin('DELETE', `/v1/admin/scenarios/${scenario.scenarioId}`)
  })
})

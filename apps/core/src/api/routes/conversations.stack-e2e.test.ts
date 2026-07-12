import { describe, expect, it } from 'vitest'
import type { ApiResponse } from '@gami/shared'

const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'
const API_KEY = 'e2e-stack-secret'

async function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(`${APP_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify(body),
  })
}

async function getJson(path: string): Promise<Response> {
  return fetch(`${APP_URL}${path}`, {
    method: 'GET',
    headers: { 'x-api-key': API_KEY },
  })
}

function requireValue(value: string | undefined, label: string): string {
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required value: ${label}`)
  }
  return value
}

async function deleteJson(path: string): Promise<void> {
  await fetch(`${APP_URL}${path}`, {
    method: 'DELETE',
    headers: { 'x-api-key': API_KEY },
  })
}

async function cleanupScenario(ids: {
  sessionId: string | undefined
  avatarId: string | undefined
  scenarioId: string
}): Promise<void> {
  if (ids.sessionId !== undefined) await deleteJson(`/v1/sessions/${ids.sessionId}`)
  if (ids.avatarId !== undefined) await deleteJson(`/v1/avatars/${ids.avatarId}`)
  await deleteJson(`/v1/scenarios/${ids.scenarioId}`)
}

async function seedSessionFixture(
  scenarioName: string,
  avatarName: string,
): Promise<{ scenarioId: string; avatarId: string; sessionId: string }> {
  const scenarioRes = await postJson('/v1/scenarios', { name: scenarioName })
  expect(scenarioRes.status).toBe(201)
  const scenarioBody = (await scenarioRes.json()) as ApiResponse<{
    scenario: { scenarioId: string }
  }>
  const scenarioId = requireValue(scenarioBody.data?.scenario.scenarioId, 'scenarioId')

  const avatarRes = await postJson(`/v1/scenarios/${scenarioId}/avatars`, {
    name: avatarName,
    personaPrompt: `You are ${avatarName}.`,
  })
  expect(avatarRes.status).toBe(201)
  const avatarBody = (await avatarRes.json()) as ApiResponse<{ avatar: { avatarId: string } }>
  const avatarId = requireValue(avatarBody.data?.avatar.avatarId, 'avatarId')

  const sessionRes = await postJson('/v1/sessions', {
    userId: `user_${Date.now().toString()}`,
    scenarioId,
  })
  expect(sessionRes.status).toBe(201)
  const sessionBody = (await sessionRes.json()) as ApiResponse<{ session: { sessionId: string } }>
  const sessionId = requireValue(sessionBody.data?.session.sessionId, 'sessionId')

  return { scenarioId, avatarId, sessionId }
}

describe('Stack E2E — session/conversation lifecycle', () => {
  it('runs create session -> create conversation -> send message -> history -> list conversations', async () => {
    const { scenarioId, avatarId, sessionId } = await seedSessionFixture(
      `Lifecycle Scenario ${String(Date.now())}`,
      'Avatar A',
    )

    try {
      const conversationRes = await postJson(`/v1/sessions/${sessionId}/conversations`, {
        avatarId,
      })
      expect(conversationRes.status).toBe(201)
      const conversationBody = (await conversationRes.json()) as ApiResponse<{
        conversation: { conversationId: string }
      }>
      const conversationId = requireValue(
        conversationBody.data?.conversation.conversationId,
        'conversationId',
      )

      const sendRes = await postJson(`/v1/conversations/${conversationId}/messages`, {
        message: { content: 'Hello stack test' },
      })
      expect(sendRes.status).toBe(200)

      const historyRes = await getJson(`/v1/conversations/${conversationId}/history`)
      expect(historyRes.status).toBe(200)
      const historyBody = (await historyRes.json()) as ApiResponse<{
        messages: Array<{ content: string }>
      }>
      expect(historyBody.data?.messages[0]?.content).toBe('Hello stack test')

      const listConversationsRes = await getJson(`/v1/sessions/${sessionId}/conversations`)
      expect(listConversationsRes.status).toBe(200)
      const listConversationsBody = (await listConversationsRes.json()) as ApiResponse<{
        conversations: Array<{ conversationId: string }>
      }>
      expect(
        listConversationsBody.data?.conversations.map((item) => item.conversationId),
      ).toContain(conversationId)
    } finally {
      await cleanupScenario({ sessionId, avatarId, scenarioId })
    }
  })

  it('implicitly closes conversation on terminal user signal via canonical close pipeline', async () => {
    const { scenarioId, avatarId, sessionId } = await seedSessionFixture(
      `Implicit End Scenario ${String(Date.now())}`,
      'Avatar B',
    )

    try {
      const conversationRes = await postJson(`/v1/sessions/${sessionId}/conversations`, {
        avatarId,
      })
      expect(conversationRes.status).toBe(201)
      const conversationBody = (await conversationRes.json()) as ApiResponse<{
        conversation: { conversationId: string }
      }>
      const conversationId = requireValue(
        conversationBody.data?.conversation.conversationId,
        'conversationId',
      )

      const sendRes = await postJson(`/v1/conversations/${conversationId}/messages`, {
        message: { content: 'bye' },
      })
      expect(sendRes.status).toBe(200)
      const sendBody = (await sendRes.json()) as ApiResponse<{
        conversation: { status: string; endedAt?: string }
      }>
      expect(sendBody.data?.conversation.status).toBe('closed')
      expect(sendBody.data?.conversation.endedAt).toBeTypeOf('string')
    } finally {
      await cleanupScenario({ sessionId, avatarId, scenarioId })
    }
  })
})

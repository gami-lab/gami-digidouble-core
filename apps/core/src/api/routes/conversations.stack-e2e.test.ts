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

describe('Stack E2E — session/conversation lifecycle', () => {
  it('runs create session -> create conversation -> send message -> history -> list conversations', async () => {
    const scenarioRes = await postJson('/v1/scenarios', { name: 'Lifecycle Scenario' })
    expect(scenarioRes.status).toBe(201)
    const scenarioBody = (await scenarioRes.json()) as ApiResponse<{
      scenario: { scenarioId: string }
    }>
    const scenarioId = requireValue(scenarioBody.data?.scenario.scenarioId, 'scenarioId')

    const avatarRes = await postJson(`/v1/scenarios/${scenarioId}/avatars`, {
      name: 'Avatar A',
      personaPrompt: 'You are Avatar A.',
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

    const conversationRes = await postJson(`/v1/sessions/${sessionId}/conversations`, { avatarId })
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
    expect(listConversationsBody.data?.conversations.map((item) => item.conversationId)).toContain(
      conversationId,
    )
  })
})

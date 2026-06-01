// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { upsertUserPersona } from './api/users'
import { useActiveChatRuntime } from './chat/use-active-chat-runtime'
import { useScenarioAvatarDiscovery } from './discovery/use-scenario-avatar-discovery'
import { LOCAL_WEB_IDENTITY_STORAGE_KEY } from './identity/local-identity'

vi.mock('./api/users', () => ({
  upsertUserPersona: vi.fn(),
}))

vi.mock('./discovery/use-scenario-avatar-discovery', () => ({
  useScenarioAvatarDiscovery: vi.fn(),
}))

vi.mock('./chat/use-active-chat-runtime', () => ({
  useActiveChatRuntime: vi.fn(),
}))

describe('App onboarding behavior', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.resetAllMocks()
    window.localStorage.clear()
    vi.mocked(useScenarioAvatarDiscovery).mockReturnValue({
      scenarios: [],
      scenarioStatus: 'ready',
      scenarioError: null,
      selectedScenarioId: null,
      session: null,
      avatars: [],
      avatarStatus: 'idle',
      avatarError: null,
      lastAvatarSyncAt: null,
      selectScenario: vi.fn(),
    })
    vi.mocked(useActiveChatRuntime).mockReturnValue({
      activeAvatarId: null,
      conversation: null,
      conversationStatus: 'idle',
      conversationError: null,
      messages: [],
      composerValue: '',
      sendStatus: 'idle',
      sendError: null,
      canSend: false,
      canEndConversation: false,
      setComposerValue: vi.fn(),
      startChatWithAvatar: vi.fn(),
      sendCurrentMessage: vi.fn(),
      endCurrentConversation: vi.fn(),
    })
  })

  it('activates app shell and persists identity after persona sync succeeds', async () => {
    vi.mocked(upsertUserPersona).mockResolvedValue({
      userId: 'user_12345678',
      persona: {},
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    })

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Save identity' }))

    await waitFor(() => {
      expect(upsertUserPersona).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reset identity' })).toBeTruthy()
    })

    expect(window.localStorage.getItem(LOCAL_WEB_IDENTITY_STORAGE_KEY)).not.toBeNull()
  })

  it('shows an onboarding error and stays in onboarding when persona sync fails', async () => {
    vi.mocked(upsertUserPersona).mockRejectedValueOnce(new Error('sync failed'))

    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Save identity' }))

    await waitFor(() => {
      expect(
        screen.getByText('Unable to save your identity. Please try again.'),
      ).toBeTruthy()
    })

    expect(screen.queryByRole('button', { name: 'Reset identity' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Save identity' })).toBeTruthy()
  })
})
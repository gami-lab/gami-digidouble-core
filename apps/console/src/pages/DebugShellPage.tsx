/* eslint-disable max-lines */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, JSX, SetStateAction, SyntheticEvent } from 'react'
import {
  getAvailableAvatars,
  getUserPersona,
  getHistory,
  listScenarioAvatars,
  listSessionConversations,
  sendMessage,
  startSession,
  switchAvatar,
  upsertUserPersona,
} from '../api'
import type { AvailableAvatarSummary, ConversationSummary, ScenarioSummary } from '../api'
import type { UserPersona } from '@gami/shared'
import { formatApiError } from '../api/error'
import { RuntimeInspector } from '../components/RuntimeInspector'
import { ScenarioTestLayout } from '../components/ScenarioTestLayout'
import { buildPersonaPayload } from '../components/runtime-inspector-tab-content'
import { sectionStyle } from './form-styles'
import {
  createDebugShellContext,
  DEBUG_SHELL_SECTIONS,
  sectionRuntimeInspectorTab,
  withDebugShellSection,
  withDebugShellSession,
} from './debug-shell-navigation'
import { derivePersonaStartGate } from './debug-shell-persona-gate'
import {
  createInitialScenarioTestState,
  deriveAvatarAvailabilityEntries,
  deriveConversationTimeline,
  withAllScenarioAvatars,
  withAvailableAvatarsRefreshed,
  withConversationAdded,
  withConversationHistoryLoaded,
  withError,
  withErrorCleared,
  withMessageExchangeAppended,
  withSessionStarted,
} from './scenario-test-state'
import type { ScenarioTestState } from './scenario-test-state'

type DebugShellPageProps = { scenario: ScenarioSummary }
type SetScenarioTestState = Dispatch<SetStateAction<ScenarioTestState>>
type PersonaDraft = { role: string; tonePreference: string; hintsText: string }

function avatarIds(avatars: AvailableAvatarSummary[]): string[] {
  return avatars.map((avatar) => avatar.avatarId)
}

async function loadScenarioAvatars(
  scenarioId: string,
  setState: SetScenarioTestState,
): Promise<void> {
  try {
    const avatars = await listScenarioAvatars(scenarioId)
    setState((prev) => withAllScenarioAvatars(prev, avatars))
  } catch (error) {
    setState((prev) => withError(prev, formatApiError(error, 'Failed to load avatars')))
  }
}

async function startSessionFlow(
  userId: string,
  scenarioId: string,
  setState: SetScenarioTestState,
  turnIndexRef: { current: number },
): Promise<void> {
  const session = await startSession({ userId, scenarioId })
  const available = await getAvailableAvatars(session.sessionId)
  const conversations = await listSessionConversations(session.sessionId)
  setState((prev) => ({
    ...withSessionStarted(prev, session, avatarIds(available.avatars)),
    conversations,
  }))
  turnIndexRef.current = 0
}

async function switchAvatarFlow(
  sessionId: string,
  avatarId: string,
  setState: SetScenarioTestState,
  turnIndexRef: { current: number },
  allAvatarsById: Map<string, AvailableAvatarSummary>,
): Promise<void> {
  const result = await switchAvatar(sessionId, avatarId)
  const available = await getAvailableAvatars(sessionId)
  setState((prev) =>
    withAvailableAvatarsRefreshed(
      withConversationAdded(prev, result.conversation, result.session, true),
      avatarIds(available.avatars),
      result.session,
      prev.availableAvatarIds,
      turnIndexRef.current,
      allAvatarsById,
    ),
  )
}

async function sendMessageFlow(
  conversationId: string,
  content: string,
  sessionId: string,
  setState: SetScenarioTestState,
  turnIndexRef: { current: number },
  allAvatarsById: Map<string, AvailableAvatarSummary>,
): Promise<void> {
  const response = await sendMessage(conversationId, { message: { content } })
  turnIndexRef.current += 1
  const available = await getAvailableAvatars(sessionId)
  setState((prev) =>
    withMessageExchangeAppended(
      withAvailableAvatarsRefreshed(
        prev,
        avatarIds(available.avatars),
        response.session,
        prev.availableAvatarIds,
        turnIndexRef.current,
        allAvatarsById,
      ),
      conversationId,
      response.conversation,
      response.userMessage,
      response.avatarMessage,
      response.session,
    ),
  )
}

async function openConversationFlow(
  conversationId: string,
  setState: SetScenarioTestState,
): Promise<void> {
  const history = await getHistory(conversationId)
  setState((prev) =>
    withConversationHistoryLoaded(prev, conversationId, history.messages, history.conversation),
  )
}

function useScenarioDerivedData(state: ScenarioTestState): {
  allAvatarsById: Map<string, AvailableAvatarSummary>
  availabilityEntries: ReturnType<typeof deriveAvatarAvailabilityEntries>
  timelineEntries: ReturnType<typeof deriveConversationTimeline>
  selectedMessages: ScenarioTestState['messagesByConversationId'][string]
  selectedConversation: ConversationSummary | null
} {
  const allAvatarsById = useMemo(
    () => new Map(state.allScenarioAvatars.map((a) => [a.avatarId, a])),
    [state.allScenarioAvatars],
  )
  const availabilityEntries = useMemo(() => deriveAvatarAvailabilityEntries(state), [state])
  const timelineEntries = useMemo(
    () => deriveConversationTimeline(state, allAvatarsById),
    [state, allAvatarsById],
  )
  const selectedMessages = useMemo(
    () =>
      state.selectedConversationId
        ? (state.messagesByConversationId[state.selectedConversationId] ?? [])
        : [],
    [state.selectedConversationId, state.messagesByConversationId],
  )
  const selectedConversation = useMemo(
    () =>
      state.selectedConversationId
        ? (state.conversations.find((c) => c.conversationId === state.selectedConversationId) ??
          null)
        : null,
    [state.selectedConversationId, state.conversations],
  )
  return {
    allAvatarsById,
    availabilityEntries,
    timelineEntries,
    selectedMessages,
    selectedConversation,
  }
}

function toPersonaDraft(persona: UserPersona | null): PersonaDraft {
  return {
    role: persona?.role ?? '',
    tonePreference: persona?.tonePreference ?? '',
    hintsText: (persona?.interactionHints ?? []).join('\n'),
  }
}

// eslint-disable-next-line max-lines-per-function, complexity
export function DebugShellPage({ scenario }: DebugShellPageProps): JSX.Element {
  const [shellContext, setShellContext] = useState(() => createDebugShellContext(scenario.scenarioId))
  const [state, setState] = useState<ScenarioTestState>(createInitialScenarioTestState)
  const [userId, setUserId] = useState('tester')
  const [draftMessage, setDraftMessage] = useState('')
  const [isStartingSession, setIsStartingSession] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [personaDraft, setPersonaDraft] = useState<PersonaDraft>({ role: '', tonePreference: '', hintsText: '' })
  const [isLoadingPersona, setIsLoadingPersona] = useState(false)
  const [isSavingPersona, setIsSavingPersona] = useState(false)
  const [personaReady, setPersonaReady] = useState(false)
  const [personaStatus, setPersonaStatus] = useState<string | null>(null)
  const turnIndexRef = useRef(0)

  const {
    allAvatarsById,
    availabilityEntries,
    timelineEntries,
    selectedMessages,
    selectedConversation,
  } = useScenarioDerivedData(state)

  useEffect(() => {
    setShellContext(createDebugShellContext(scenario.scenarioId))
    setState(createInitialScenarioTestState())
    void loadScenarioAvatars(scenario.scenarioId, setState)
  }, [scenario.scenarioId])

  useEffect(() => {
    setShellContext((previous) => withDebugShellSession(previous, state.session?.sessionId ?? null))
  }, [state.session?.sessionId])

  useEffect(() => {
    if (userId.trim() === '') {
      setPersonaDraft({ role: '', tonePreference: '', hintsText: '' })
      setPersonaReady(false)
      setPersonaStatus('Set user id and save persona before starting session.')
      return
    }

    setIsLoadingPersona(true)
    setPersonaStatus(null)
    void (async () => {
      try {
        const response = await getUserPersona(userId.trim())
        setPersonaDraft(toPersonaDraft(response.persona))
        setPersonaReady(response.persona !== null)
        setPersonaStatus(
          response.persona !== null
            ? 'Persona loaded for this user.'
            : 'No persona yet. Save persona before starting session.',
        )
      } catch (error) {
        setPersonaReady(false)
        setPersonaStatus(formatApiError(error, 'Failed to load persona for this user'))
      } finally {
        setIsLoadingPersona(false)
      }
    })()
  }, [userId])

  const handleStartSession = useCallback((): void => {
    if (!personaReady) {
      setState((prev) => withError(prev, 'Save persona before starting the debugging session.'))
      return
    }
    setIsStartingSession(true)
    setState((prev) => withErrorCleared(prev))
    void (async () => {
      try {
        await startSessionFlow(userId, scenario.scenarioId, setState, turnIndexRef)
      } catch (error) {
        setState((prev) => withError(prev, formatApiError(error, 'Failed to start session')))
      } finally {
        setIsStartingSession(false)
      }
    })()
  }, [personaReady, scenario.scenarioId, userId])

  const handleSavePersona = useCallback((): void => {
    if (userId.trim() === '') {
      setPersonaStatus('User id is required to save persona.')
      return
    }
    setIsSavingPersona(true)
    setPersonaStatus('Saving persona...')
    void (async () => {
      try {
        await upsertUserPersona(userId.trim(), buildPersonaPayload(personaDraft))
        setPersonaReady(true)
        setPersonaStatus('Persona saved. Session setup is unlocked.')
      } catch (error) {
        setPersonaReady(false)
        setPersonaStatus(formatApiError(error, 'Failed to save persona'))
      } finally {
        setIsSavingPersona(false)
      }
    })()
  }, [personaDraft, userId])

  const handleSwitchAvatar = useCallback(
    (avatarId: string): void => {
      if (state.session === null) return
      const sessionId = state.session.sessionId
      setIsSwitching(true)
      setState((prev) => withErrorCleared(prev))
      void (async () => {
        try {
          await switchAvatarFlow(sessionId, avatarId, setState, turnIndexRef, allAvatarsById)
        } catch (error) {
          setState((prev) => withError(prev, formatApiError(error, 'Failed to switch avatar')))
        } finally {
          setIsSwitching(false)
        }
      })()
    },
    [allAvatarsById, state.session],
  )

  const handleSendMessage = useCallback(
    (content: string): void => {
      if (!state.selectedConversationId || !state.session || content.trim() === '') return
      const conversationId = state.selectedConversationId
      const sessionId = state.session.sessionId
      setIsSending(true)
      setState((prev) => withErrorCleared(prev))
      void (async () => {
        try {
          await sendMessageFlow(
            conversationId,
            content,
            sessionId,
            setState,
            turnIndexRef,
            allAvatarsById,
          )
        } catch (error) {
          setState((prev) => withError(prev, formatApiError(error, 'Failed to send message')))
        } finally {
          setIsSending(false)
        }
      })()
    },
    [allAvatarsById, state.selectedConversationId, state.session],
  )

  const handleSendDraft = useCallback(
    (event: SyntheticEvent<HTMLFormElement>): void => {
      event.preventDefault()
      const content = draftMessage.trim()
      if (content.length === 0) return
      setDraftMessage('')
      handleSendMessage(content)
    },
    [draftMessage, handleSendMessage],
  )

  const handleOpenConversation = useCallback(
    (conversation: ConversationSummary): void => {
      setIsLoadingHistory(true)
      setState((prev) => withErrorCleared(prev))
      void (async () => {
        try {
          await openConversationFlow(conversation.conversationId, setState)
        } catch (error) {
          setState((prev) => withError(prev, formatApiError(error, 'Failed to load history')))
        } finally {
          setIsLoadingHistory(false)
        }
      })()
    },
    [],
  )

  const handleReturnToGuide = useCallback((): void => {
    const firstAvailable = state.availableAvatarIds[0]
    if (firstAvailable && firstAvailable !== state.session?.activeAvatarId) {
      handleSwitchAvatar(firstAvailable)
    }
  }, [handleSwitchAvatar, state.availableAvatarIds, state.session?.activeAvatarId])

  const handleTestLockedAccess = useCallback((): void => {
    const locked = state.allScenarioAvatars.find((a) => !state.availableAvatarIds.includes(a.avatarId))
    if (locked && state.session) {
      handleSwitchAvatar(locked.avatarId)
      return
    }
    setState((prev) => withError(prev, 'No locked avatars found. All avatars may already be unlocked.'))
  }, [handleSwitchAvatar, state.allScenarioAvatars, state.availableAvatarIds, state.session])

  const activeSection = shellContext.section
  const inspectorTab = sectionRuntimeInspectorTab(activeSection)
  const personaStartGate = derivePersonaStartGate({
    personaReady,
    isLoadingPersona,
    isSavingPersona,
  })

  return (
    <section style={sectionStyle}>
      <h2 style={{ marginTop: 0 }}>Debugging Shell</h2>
      <p style={{ color: '#6b7280', marginTop: 0 }}>
        Scenario: <strong>{scenario.name}</strong>
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        {DEBUG_SHELL_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            style={{
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              padding: '8px 10px',
              fontWeight: 600,
              cursor: 'pointer',
              color: activeSection === section.id ? '#ffffff' : '#111827',
              backgroundColor: activeSection === section.id ? '#111827' : '#ffffff',
            }}
            onClick={() => {
              setShellContext((previous) => withDebugShellSection(previous, section.id))
            }}
          >
            {section.label}
          </button>
        ))}
      </div>

      {activeSection === 'session-setup' ? (
        <>
          {state.session === null ? (
            <div
              style={{
                border: '1px solid #d1d5db',
                borderRadius: '10px',
                padding: '12px',
                backgroundColor: '#f9fafb',
                marginBottom: '12px',
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Persona setup (required)</h3>
              <p style={{ marginTop: 0, color: '#4b5563' }}>
                Persona is part of the primary debug start flow. Save it before starting session.
              </p>
              <div style={{ display: 'grid', gap: '8px' }}>
                <label>
                  Role
                  <input
                    value={personaDraft.role}
                    onChange={(event) => {
                      setPersonaReady(false)
                      setPersonaDraft((previous) => ({ ...previous, role: event.target.value }))
                    }}
                    disabled={isLoadingPersona || isSavingPersona}
                  />
                </label>
                <label>
                  Tone preference
                  <input
                    value={personaDraft.tonePreference}
                    onChange={(event) => {
                      setPersonaReady(false)
                      setPersonaDraft((previous) => ({ ...previous, tonePreference: event.target.value }))
                    }}
                    disabled={isLoadingPersona || isSavingPersona}
                  />
                </label>
                <label>
                  Interaction hints (one per line)
                  <textarea
                    rows={4}
                    value={personaDraft.hintsText}
                    onChange={(event) => {
                      setPersonaReady(false)
                      setPersonaDraft((previous) => ({ ...previous, hintsText: event.target.value }))
                    }}
                    disabled={isLoadingPersona || isSavingPersona}
                  />
                </label>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                  <button
                    type="button"
                    disabled={isLoadingPersona || isSavingPersona || userId.trim() === ''}
                    onClick={handleSavePersona}
                  >
                    {isSavingPersona ? 'Saving...' : 'Save persona'}
                  </button>
                  <p style={{ margin: 0, color: personaReady ? '#166534' : '#92400e' }}>
                    {personaStatus ?? (isLoadingPersona ? 'Loading persona...' : 'Persona not saved yet')}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          <ScenarioTestLayout
            scenario={scenario}
            state={state}
            userId={userId}
            draftMessage={draftMessage}
            isStartingSession={isStartingSession}
            isSwitching={isSwitching}
            isSending={isSending}
            isLoadingHistory={isLoadingHistory}
            canStartSession={personaStartGate.canStartSession}
            startBlockedReason={personaStartGate.startBlockedReason}
            availabilityEntries={availabilityEntries}
            timelineEntries={timelineEntries}
            selectedConversation={selectedConversation}
            selectedMessages={selectedMessages}
            allAvatarsById={allAvatarsById}
            onUserIdChange={setUserId}
            onStartSession={handleStartSession}
            onSwitchAvatar={handleSwitchAvatar}
            onSendMessage={handleSendMessage}
            onSendDraft={handleSendDraft}
            onDraftChange={setDraftMessage}
            onOpenConversation={handleOpenConversation}
            onReturnToGuide={handleReturnToGuide}
            onTestLockedAccess={handleTestLockedAccess}
            showRuntimeInspector={false}
          />
        </>
      ) : null}

      {activeSection !== 'session-setup' ? (
        <div>
          {shellContext.sessionId === null ? (
            <div
              style={{
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                backgroundColor: '#f9fafb',
                padding: '12px',
              }}
            >
              <p style={{ margin: 0 }}>
                No active session yet. Use <strong>Session Setup</strong> to start a session, then
                return to this section.
              </p>
            </div>
          ) : null}
          <div style={{ marginTop: '12px' }}>
            <RuntimeInspector
              sessionId={shellContext.sessionId}
              refreshTrigger={state.conversations.length}
              initialTab={inspectorTab ?? 'overview'}
              tabOrderOverride={inspectorTab === null ? ['overview'] : [inspectorTab]}
              showTabNavigation={false}
              title={DEBUG_SHELL_SECTIONS.find((item) => item.id === activeSection)?.label ?? 'Runtime Inspector'}
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}

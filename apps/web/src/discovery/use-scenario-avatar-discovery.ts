import { useEffect, useRef, useState } from 'react'
import i18n from '../i18n/index'
import type {
  AvailableAvatarSummary,
  RuntimeEvent,
  PublicScenarioSummary,
  SessionSummary,
} from '@gami/shared'
import { subscribeToRuntimeEvents } from '../api/runtime-events-stream'
import { listAvailableScenarios } from '../api/scenarios'
import { ensureActiveSession, getAvailableAvatarsForSession, startSession } from '../api/sessions'

type ScenarioLoadStatus = 'loading' | 'ready' | 'error'
type AvatarLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export type ScenarioSelectionState = {
  selectedScenarioId: string
  avatarStatus: AvatarLoadStatus
  avatarError: string | null
  avatars: AvailableAvatarSummary[]
  session: SessionSummary | null
}

export type ScenarioAvatarDiscoveryState = {
  scenarios: PublicScenarioSummary[]
  scenarioStatus: ScenarioLoadStatus
  selectedScenarioId: string | null
  session: SessionSummary | null
  avatars: AvailableAvatarSummary[]
  avatarStatus: AvatarLoadStatus
  avatarError: string | null
  /** True once Core reports the current session closed. */
  sessionClosed: boolean
  selectScenario: (scenarioId: string) => void
  /** Starts a fresh session for the selected scenario with the same player. */
  restartSession: () => void
  reloadScenarios: () => void
}

type ScenarioAvatarDiscoveryOptions = {
  initialSelectedScenarioId?: string | null
  /** Receives every runtime event of the current session's stream. */
  onRuntimeEvent?: (event: RuntimeEvent) => void
}

export function useScenarioAvatarDiscovery(
  userId: string,
  options?: ScenarioAvatarDiscoveryOptions,
): ScenarioAvatarDiscoveryState {
  const initialSelectedScenarioId = options?.initialSelectedScenarioId ?? null
  const [scenarios, setScenarios] = useState<PublicScenarioSummary[]>([])
  const [scenarioStatus, setScenarioStatus] = useState<ScenarioLoadStatus>('loading')
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(
    initialSelectedScenarioId,
  )

  const [session, setSession] = useState<SessionSummary | null>(null)
  const [avatars, setAvatars] = useState<AvailableAvatarSummary[]>([])
  const [avatarStatus, setAvatarStatus] = useState<AvatarLoadStatus>(
    initialSelectedScenarioId === null ? 'idle' : 'loading',
  )
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [closedSessionId, setClosedSessionId] = useState<string | null>(null)
  const [scenarioListVersion, setScenarioListVersion] = useState(0)

  const scenarioSelectionRequestIdRef = useRef(0)
  const onRuntimeEventRef = useLatestRef(options?.onRuntimeEvent)

  useScenarioList(scenarioListVersion, setScenarios, setScenarioStatus)
  useAvatarAvailabilitySubscription(
    selectedScenarioId,
    session,
    setAvatars,
    setAvatarStatus,
    setAvatarError,
    setClosedSessionId,
    onRuntimeEventRef,
  )
  useEffect(() => {
    if (selectedScenarioId === null) {
      return
    }

    const selectedExists = scenarios.some((scenario) => scenario.scenarioId === selectedScenarioId)
    if (scenarioStatus !== 'ready' || selectedExists) {
      return
    }

    scenarioSelectionRequestIdRef.current += 1
    setSelectedScenarioId(null)
    setSession(null)
    setAvatars([])
    setAvatarStatus('idle')
    setAvatarError(null)
  }, [scenarioStatus, scenarios, selectedScenarioId])

  useEffect(() => {
    if (selectedScenarioId === null) return
    scenarioSelectionRequestIdRef.current += 1
    const requestId = scenarioSelectionRequestIdRef.current
    void loadScenarioSessionAndAvatars(selectedScenarioId, requestId, {
      setSession,
      setAvatars,
      setAvatarStatus,
      setAvatarError,
      scenarioSelectionRequestIdRef,
    })
  }, [userId, selectedScenarioId])

  function selectScenario(scenarioId: string): void {
    scenarioSelectionRequestIdRef.current += 1
    const selectionState = createScenarioSelectionState(scenarioId)
    setSelectedScenarioId(selectionState.selectedScenarioId)
    setAvatarStatus(selectionState.avatarStatus)
    setAvatarError(selectionState.avatarError)
    setAvatars(selectionState.avatars)
    setSession(selectionState.session)
  }

  const sessionSetters: SessionAvatarSetters = {
    setSession,
    setAvatars,
    setAvatarStatus,
    setAvatarError,
    scenarioSelectionRequestIdRef,
  }

  return {
    scenarios,
    scenarioStatus,
    selectedScenarioId,
    session,
    avatars,
    avatarStatus,
    avatarError,
    sessionClosed: session !== null && closedSessionId === session.sessionId,
    selectScenario,
    restartSession: () => {
      if (selectedScenarioId !== null) restartScenarioSession(selectedScenarioId, sessionSetters)
    },
    reloadScenarios: () => {
      setScenarioListVersion((version) => version + 1)
    },
  }
}

export function createScenarioSelectionState(scenarioId: string): ScenarioSelectionState {
  return {
    selectedScenarioId: scenarioId,
    avatarStatus: 'loading',
    avatarError: null,
    avatars: [],
    session: null,
  }
}

function useScenarioList(
  version: number,
  setScenarios: (value: PublicScenarioSummary[]) => void,
  setScenarioStatus: (value: ScenarioLoadStatus) => void,
): void {
  useEffect(() => {
    let isCancelled = false
    async function loadScenarios(): Promise<void> {
      setScenarioStatus('loading')
      try {
        const items = await listAvailableScenarios()
        if (!isCancelled) {
          setScenarios(items)
          setScenarioStatus('ready')
        }
      } catch {
        if (!isCancelled) setScenarioStatus('error')
      }
    }
    void loadScenarios()
    return () => {
      isCancelled = true
    }
  }, [version, setScenarios, setScenarioStatus])
}

function useAvatarAvailabilitySubscription(
  selectedScenarioId: string | null,
  session: SessionSummary | null,
  setAvatars: (updater: (current: AvailableAvatarSummary[]) => AvailableAvatarSummary[]) => void,
  setAvatarStatus: (
    value: AvatarLoadStatus | ((current: AvatarLoadStatus) => AvatarLoadStatus),
  ) => void,
  setAvatarError: (value: string | null) => void,
  setClosedSessionId: (value: string) => void,
  onRuntimeEventRef: { current: ((event: RuntimeEvent) => void) | undefined },
): void {
  useEffect(() => {
    if (selectedScenarioId === null || session === null) return

    const scenarioId = selectedScenarioId
    const sessionId = session.sessionId
    let isCancelled = false

    async function refreshAvailableAvatars(): Promise<void> {
      try {
        const nextAvatars = await getAvailableAvatarsForSession(sessionId, scenarioId)
        if (isCancelled) return
        setAvatars((current) => (areAvatarListsEqual(current, nextAvatars) ? current : nextAvatars))
        setAvatarStatus('ready')
        setAvatarError(null)
      } catch {
        if (isCancelled) return
        setAvatarError(i18n.t('errors.unableToRefreshAvatars'))
        setAvatarStatus((current) => (current === 'ready' ? 'ready' : 'error'))
      }
    }

    const subscription = subscribeToRuntimeEvents(sessionId, {
      onOpen: () => {
        void refreshAvailableAvatars()
      },
      onEvent: (event) => {
        if (event.sessionId !== sessionId) return
        onRuntimeEventRef.current?.(event)
        if (event.type === 'runtime.session_closed') setClosedSessionId(sessionId)
        if (shouldRefreshAvatarAvailabilityFromEvent(event)) {
          void refreshAvailableAvatars()
        }
      },
    })

    return () => {
      isCancelled = true
      subscription.close()
    }
  }, [
    selectedScenarioId,
    session,
    setAvatars,
    setAvatarStatus,
    setAvatarError,
    setClosedSessionId,
    onRuntimeEventRef,
  ])
}

function shouldRefreshAvatarAvailabilityFromEvent(event: RuntimeEvent): boolean {
  return event.type === 'runtime.avatar_unlocked'
}

function restartScenarioSession(scenarioId: string, setters: SessionAvatarSetters): void {
  setters.scenarioSelectionRequestIdRef.current += 1
  setters.setSession(null)
  setters.setAvatars([])
  setters.setAvatarStatus('loading')
  void loadScenarioSessionAndAvatars(
    scenarioId,
    setters.scenarioSelectionRequestIdRef.current,
    setters,
    startSession,
  )
}

type SessionAvatarSetters = {
  setSession: (value: SessionSummary | null) => void
  setAvatars: (value: AvailableAvatarSummary[]) => void
  setAvatarStatus: (value: AvatarLoadStatus) => void
  setAvatarError: (value: string | null) => void
  scenarioSelectionRequestIdRef: SelectionRequestRef
}

type SelectionRequestRef = {
  current: number
}

async function loadScenarioSessionAndAvatars(
  scenarioId: string,
  requestId: number,
  setters: SessionAvatarSetters,
  obtainSession: typeof ensureActiveSession = ensureActiveSession,
): Promise<void> {
  try {
    const activeSession = await obtainSession({ scenarioId })

    if (requestId !== setters.scenarioSelectionRequestIdRef.current) {
      return
    }

    setters.setSession(activeSession)

    const availableAvatars = await getAvailableAvatarsForSession(
      activeSession.sessionId,
      scenarioId,
    )

    if (requestId !== setters.scenarioSelectionRequestIdRef.current) {
      return
    }

    setters.setAvatars(availableAvatars)
    setters.setAvatarStatus('ready')
    setters.setAvatarError(null)
  } catch {
    if (requestId !== setters.scenarioSelectionRequestIdRef.current) {
      return
    }
    setters.setAvatarStatus('error')
    setters.setAvatarError(i18n.t('errors.unableToLoadAvatars'))
  }
}

function areAvatarListsEqual(
  current: AvailableAvatarSummary[],
  next: AvailableAvatarSummary[],
): boolean {
  if (current.length !== next.length) {
    return false
  }

  const currentIds = current.map((avatar) => avatar.avatarId).join('|')
  const nextIds = next.map((avatar) => avatar.avatarId).join('|')

  return currentIds === nextIds
}

function useLatestRef<T>(value: T): { current: T } {
  const ref = useRef(value)
  ref.current = value
  return ref
}

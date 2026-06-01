import { useEffect, useRef, useState } from 'react'
import type {
  AvailableAvatarSummary,
  LocalWebIdentity,
  ScenarioSummary,
  SessionSummary,
} from '@gami/shared'
import { listAvailableScenarios } from '../api/scenarios'
import { ensureActiveSession, getAvailableAvatarsForSession } from '../api/sessions'

const AVATAR_DISCOVERY_POLL_INTERVAL_MS = 5_000

type ScenarioLoadStatus = 'loading' | 'ready' | 'error'
type AvatarLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export type ScenarioSelectionState = {
  selectedScenarioId: string
  avatarStatus: AvatarLoadStatus
  avatarError: string | null
  avatars: AvailableAvatarSummary[]
  session: SessionSummary | null
  lastAvatarSyncAt: string | null
}

export type ScenarioAvatarDiscoveryState = {
  scenarios: ScenarioSummary[]
  scenarioStatus: ScenarioLoadStatus
  scenarioError: string | null
  selectedScenarioId: string | null
  session: SessionSummary | null
  avatars: AvailableAvatarSummary[]
  avatarStatus: AvatarLoadStatus
  avatarError: string | null
  lastAvatarSyncAt: string | null
  selectScenario: (scenarioId: string) => void
}

type ScenarioAvatarDiscoveryOptions = {
  initialSelectedScenarioId?: string | null
}

export function useScenarioAvatarDiscovery(
  identity: LocalWebIdentity,
  options?: ScenarioAvatarDiscoveryOptions,
): ScenarioAvatarDiscoveryState {
  const initialSelectedScenarioId = options?.initialSelectedScenarioId ?? null
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([])
  const [scenarioStatus, setScenarioStatus] = useState<ScenarioLoadStatus>('loading')
  const [scenarioError, setScenarioError] = useState<string | null>(null)
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(
    initialSelectedScenarioId,
  )

  const [session, setSession] = useState<SessionSummary | null>(null)
  const [avatars, setAvatars] = useState<AvailableAvatarSummary[]>([])
  const [avatarStatus, setAvatarStatus] = useState<AvatarLoadStatus>(
    initialSelectedScenarioId === null ? 'idle' : 'loading',
  )
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [lastAvatarSyncAt, setLastAvatarSyncAt] = useState<string | null>(null)

  const scenarioSelectionRequestIdRef = useRef(0)

  useScenarioList(setScenarios, setScenarioStatus, setScenarioError)
  useAvatarAvailabilityPolling(
    selectedScenarioId,
    session,
    setAvatars,
    setAvatarStatus,
    setAvatarError,
    setLastAvatarSyncAt,
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
    setLastAvatarSyncAt(null)
  }, [scenarioStatus, scenarios, selectedScenarioId])

  useEffect(() => {
    if (selectedScenarioId === null) {
      return
    }

    scenarioSelectionRequestIdRef.current += 1
    const requestId = scenarioSelectionRequestIdRef.current
    void loadScenarioSessionAndAvatars(identity.userId, selectedScenarioId, requestId, {
      setSession,
      setAvatars,
      setAvatarStatus,
      setAvatarError,
      setLastAvatarSyncAt,
      scenarioSelectionRequestIdRef,
    })
  }, [identity.userId, selectedScenarioId])

  function selectScenario(scenarioId: string): void {
    scenarioSelectionRequestIdRef.current += 1

    const selectionState = createScenarioSelectionState(scenarioId)
    setSelectedScenarioId(selectionState.selectedScenarioId)
    setAvatarStatus(selectionState.avatarStatus)
    setAvatarError(selectionState.avatarError)
    setAvatars(selectionState.avatars)
    setSession(selectionState.session)
    setLastAvatarSyncAt(selectionState.lastAvatarSyncAt)
  }

  return {
    scenarios,
    scenarioStatus,
    scenarioError,
    selectedScenarioId,
    session,
    avatars,
    avatarStatus,
    avatarError,
    lastAvatarSyncAt,
    selectScenario,
  }
}

export function createScenarioSelectionState(scenarioId: string): ScenarioSelectionState {
  return {
    selectedScenarioId: scenarioId,
    avatarStatus: 'loading',
    avatarError: null,
    avatars: [],
    session: null,
    lastAvatarSyncAt: null,
  }
}

function useScenarioList(
  setScenarios: (value: ScenarioSummary[]) => void,
  setScenarioStatus: (value: ScenarioLoadStatus) => void,
  setScenarioError: (value: string | null) => void,
): void {
  useEffect(() => {
    let isCancelled = false
    async function loadScenarios(): Promise<void> {
      setScenarioStatus('loading')
      setScenarioError(null)
      try {
        const items = await listAvailableScenarios()
        if (!isCancelled) {
          setScenarios(items)
          setScenarioStatus('ready')
        }
      } catch (error) {
        if (!isCancelled) {
          setScenarioStatus('error')
          setScenarioError(error instanceof Error ? error.message : 'Unable to load scenarios')
        }
      }
    }
    void loadScenarios()
    return () => {
      isCancelled = true
    }
  }, [setScenarios, setScenarioStatus, setScenarioError])
}

function useAvatarAvailabilityPolling(
  selectedScenarioId: string | null,
  session: SessionSummary | null,
  setAvatars: (updater: (current: AvailableAvatarSummary[]) => AvailableAvatarSummary[]) => void,
  setAvatarStatus: (
    value: AvatarLoadStatus | ((current: AvatarLoadStatus) => AvatarLoadStatus),
  ) => void,
  setAvatarError: (value: string | null) => void,
  setLastAvatarSyncAt: (value: string | null) => void,
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
        setLastAvatarSyncAt(new Date().toISOString())
      } catch (error) {
        if (isCancelled) return
        setAvatarError(
          error instanceof Error ? error.message : 'Unable to refresh avatar availability',
        )
        setAvatarStatus((current) => (current === 'ready' ? 'ready' : 'error'))
      }
    }
    void refreshAvailableAvatars()
    const intervalId = window.setInterval(() => {
      void refreshAvailableAvatars()
    }, AVATAR_DISCOVERY_POLL_INTERVAL_MS)
    return () => {
      isCancelled = true
      window.clearInterval(intervalId)
    }
  }, [
    selectedScenarioId,
    session,
    setAvatars,
    setAvatarStatus,
    setAvatarError,
    setLastAvatarSyncAt,
  ])
}

type SessionAvatarSetters = {
  setSession: (value: SessionSummary | null) => void
  setAvatars: (value: AvailableAvatarSummary[]) => void
  setAvatarStatus: (value: AvatarLoadStatus) => void
  setAvatarError: (value: string | null) => void
  setLastAvatarSyncAt: (value: string | null) => void
  scenarioSelectionRequestIdRef: SelectionRequestRef
}

type SelectionRequestRef = {
  current: number
}

async function loadScenarioSessionAndAvatars(
  userId: string,
  scenarioId: string,
  requestId: number,
  setters: SessionAvatarSetters,
): Promise<void> {
  try {
    const activeSession = await ensureActiveSession({
      userId,
      scenarioId,
    })

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
    setters.setLastAvatarSyncAt(new Date().toISOString())
  } catch (error) {
    if (requestId !== setters.scenarioSelectionRequestIdRef.current) {
      return
    }
    setters.setAvatarStatus('error')
    setters.setAvatarError(error instanceof Error ? error.message : 'Unable to load avatars')
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

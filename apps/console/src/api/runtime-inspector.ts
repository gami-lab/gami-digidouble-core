import type {
  AdminSessionContextResponse,
  AdminSessionInspectResponse,
  AdminSessionMemoryLayersResponse,
  AdminSessionMemoryResponse,
  AdminSessionTurnMetricsResponse,
  RuntimeState,
  SessionEventRecord,
  SessionSummary,
  UserPersona,
} from '@gami/shared'
import {
  getSessionContext,
  getRuntimeState,
  getSessionMemory,
  getSessionMemoryLayers,
  getSessionMetrics,
  getUserPersona,
  inspectSession,
  listSessionEvents,
} from './sessions'

export type RuntimeInspectorQueryOptions = {
  eventsLimit?: number
}

export type RuntimeInspectorViewModel = {
  session: SessionSummary
  runtimeState: RuntimeState
  gm: {
    gmState: NonNullable<AdminSessionInspectResponse['inspect']['gmState']> | null
    gmNotes: string | null
    transitionHistory: AdminSessionInspectResponse['inspect']['transitionHistory']
    unlockedAvatarIds: string[]
  }
  effectiveModels: AdminSessionInspectResponse['inspect']['effectiveModels']
  memory: {
    summary: AdminSessionMemoryResponse['session']
    layers: AdminSessionMemoryLayersResponse['session']
  }
  metrics: {
    summary: AdminSessionTurnMetricsResponse['summary']
    turns: AdminSessionTurnMetricsResponse['turns']
  }
  context: {
    avatar: AdminSessionContextResponse['avatarContext']
    gm: AdminSessionContextResponse['gmContext']
    trace: AdminSessionContextResponse['contextTrace']
  }
  persona: UserPersona | null
  recentEvents: SessionEventRecord[]
}

const DEFAULT_EVENTS_LIMIT = 20

export async function loadRuntimeInspectorViewModel(
  sessionId: string,
  options?: RuntimeInspectorQueryOptions,
): Promise<RuntimeInspectorViewModel> {
  const inspect = await inspectSession(sessionId)
  const eventsLimit = options?.eventsLimit ?? DEFAULT_EVENTS_LIMIT

  const [
    runtimeState,
    memorySummary,
    memoryLayers,
    metrics,
    personaResponse,
    eventsResponse,
    contextResponse,
  ] = await Promise.all([
    getRuntimeState(sessionId),
    getSessionMemory(sessionId),
    getSessionMemoryLayers(sessionId),
    getSessionMetrics(sessionId),
    getUserPersona(inspect.inspect.session.userId),
    listSessionEvents(sessionId, { limit: eventsLimit }),
    getSessionContext(sessionId),
  ])

  return {
    session: inspect.inspect.session,
    runtimeState,
    gm: {
      gmState: inspect.inspect.gmState,
      gmNotes: inspect.inspect.gmNotes,
      transitionHistory: inspect.inspect.transitionHistory,
      unlockedAvatarIds: [...inspect.inspect.unlockedAvatarIds],
    },
    effectiveModels: inspect.inspect.effectiveModels,
    memory: {
      summary: memorySummary.session,
      layers: memoryLayers.session,
    },
    metrics: {
      summary: metrics.summary,
      turns: metrics.turns,
    },
    context: {
      avatar: contextResponse.avatarContext,
      gm: contextResponse.gmContext,
      trace: contextResponse.contextTrace,
    },
    persona: personaResponse.persona,
    recentEvents: eventsResponse.events,
  }
}

import type {
  GmSessionEventPayload,
  SessionEventRecord,
  TurnCompletedEventPayload,
} from '@gami/shared'
import type { RuntimeInspectorViewModel } from '../api'

export type GmImpactTraceEntry = {
  correlationId: string
  turnIndex: number | null
  timelinePosition: string
  triggerContext: string
  gmDecisionAction: string[]
  resultingImpact: string[]
  createdAt: string
  status: 'applied' | 'error' | 'pending'
}

export function buildGmImpactTrace(snapshot: RuntimeInspectorViewModel): GmImpactTraceEntry[] {
  const eventsByCorrelation = new Map<string, SessionEventRecord[]>()

  for (const event of snapshot.recentEvents) {
    const existing = eventsByCorrelation.get(event.correlationId) ?? []
    existing.push(event)
    eventsByCorrelation.set(event.correlationId, existing)
  }

  const traces = Array.from(eventsByCorrelation.entries())
    .map(([correlationId, events]) =>
      toTraceEntry(correlationId, events, snapshot.gm.transitionHistory.length),
    )
    .filter((entry): entry is GmImpactTraceEntry => entry !== null)

  return traces.sort((a, b) => {
    const left = a.turnIndex ?? -1
    const right = b.turnIndex ?? -1
    return right - left
  })
}

// eslint-disable-next-line complexity
function toTraceEntry(
  correlationId: string,
  events: SessionEventRecord[],
  timelineCount: number,
): GmImpactTraceEntry | null {
  const gmEvent = events.find((event) => event.type === 'gm_triggered' || event.type === 'gm_error')
  if (!gmEvent) return null

  const turnEvent = events.find((event) => event.type === 'turn_completed')
  if (!isGmPayload(gmEvent.payload)) return null
  const gmPayload = gmEvent.payload
  const turnPayload = turnEvent && isTurnPayload(turnEvent.payload) ? turnEvent.payload : undefined

  const turnIndex = gmPayload.turnIndex
  const timelinePosition =
    timelineCount > 0
      ? `${String(Math.min(turnIndex, timelineCount))}/${String(timelineCount)}`
      : '-'

  const decision = gmPayload.decision
  const decisionActions: string[] = []
  const impacts: string[] = []

  decisionActions.push(
    `Trigger: ${gmPayload.triggerReason ?? 'none'} (interaction ${String(gmPayload.interactionCount)})`,
  )

  if (decision) {
    decisionActions.push(`Decision: avatar ${decision.avatarId} (${decision.conversationMode})`)

    if (decision.suggestedAvatarId) {
      impacts.push(
        `Routing suggestion: ${decision.suggestedAvatarId}${decision.suggestedAvatarReason ? ` (${decision.suggestedAvatarReason})` : ''}`,
      )
    }

    if (decision.switchedAvatarId) {
      impacts.push(`Avatar switched: ${decision.switchedAvatarId}`)
    }

    if (decision.unlockedAvatarIds && decision.unlockedAvatarIds.length > 0) {
      impacts.push(`Avatar unlocks: ${decision.unlockedAvatarIds.join(', ')}`)
    }

    if (decision.notesInjected) {
      impacts.push('GM notes/directives injected into context')
    }

    if (decision.directiveCount > 0) {
      impacts.push(`Directive count: ${String(decision.directiveCount)}`)
    }
  } else {
    decisionActions.push('Decision: no decision payload')
  }

  if (turnPayload) {
    impacts.push(
      `User-flow impact: completed turn ${String(turnPayload.turnIndex)} on avatar ${turnPayload.avatarId}`,
    )
  } else {
    impacts.push('User-flow impact: turn completion not observed in snapshot window')
  }

  if (gmEvent.type === 'gm_error') {
    impacts.push(`GM error: ${gmPayload.errorCode ?? 'unknown'}`)
  }

  return {
    correlationId,
    turnIndex,
    timelinePosition,
    triggerContext: gmPayload.triggerReason ?? 'none',
    gmDecisionAction: decisionActions,
    resultingImpact: impacts,
    createdAt: gmEvent.createdAt,
    status: gmEvent.type === 'gm_error' ? 'error' : turnEvent ? 'applied' : 'pending',
  }
}

function isGmPayload(payload: SessionEventRecord['payload']): payload is GmSessionEventPayload {
  return 'interactionCount' in payload
}

function isTurnPayload(
  payload: SessionEventRecord['payload'],
): payload is TurnCompletedEventPayload {
  return 'conversationId' in payload
}

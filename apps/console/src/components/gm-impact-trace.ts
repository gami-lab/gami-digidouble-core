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
  const avatarNameById = buildAvatarNameById(snapshot)

  for (const event of snapshot.recentEvents) {
    const existing = eventsByCorrelation.get(event.correlationId) ?? []
    existing.push(event)
    eventsByCorrelation.set(event.correlationId, existing)
  }

  const traces = Array.from(eventsByCorrelation.entries())
    .map(([correlationId, events]) =>
      toTraceEntry(correlationId, events, snapshot.gm.transitionHistory.length, avatarNameById),
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
  avatarNameById: Map<string, string>,
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
    `GM ran after turn ${String(gmPayload.turnIndex)} because ${formatTriggerReason(gmPayload.triggerReason)}.`,
  )
  decisionActions.push(describeStateBefore(gmPayload, avatarNameById))

  if (decision) {
    decisionActions.push(describeDecision(decision, gmPayload, avatarNameById))

    if (decision.suggestedAvatarId) {
      impacts.push(
        `GM recommendation: ${formatAvatar(decision.suggestedAvatarId, avatarNameById)}${decision.suggestedAvatarReason ? ` — ${decision.suggestedAvatarReason}` : ''}`,
      )
    }

    if (decision.switchedAvatarId) {
      impacts.push(
        `Next active avatar: ${formatAvatar(decision.switchedAvatarId, avatarNameById)}.`,
      )
    }

    if (decision.unlockEvaluations && decision.unlockEvaluations.length > 0) {
      impacts.push(
        `Avatar unlocks: ${decision.unlockEvaluations
          .map((unlock) => {
            const detail = `${unlock.avatarId} (${unlock.avatarName})`
            const reason = unlock.reason ? ` — ${unlock.reason}` : ''
            return `${detail} [${unlock.outcome}]${reason}`
          })
          .join(', ')}`,
      )
    } else if (decision.unlockedAvatarIds && decision.unlockedAvatarIds.length > 0) {
      impacts.push(`Avatar unlocks: ${decision.unlockedAvatarIds.join(', ')}`)
    }

    if (decision.injectedNote) {
      impacts.push(`GM note added to the next avatar turn: ${decision.injectedNote}`)
    } else if (decision.notesInjected) {
      impacts.push('GM note added to the next avatar turn.')
    }

    if (decision.directiveCount > 0) {
      impacts.push(
        `GM produced ${String(decision.directiveCount)} structured recommendation${decision.directiveCount === 1 ? '' : 's'}.`,
      )
    }
  } else {
    decisionActions.push('Decision: no decision payload')
  }

  if (turnPayload) {
    impacts.push(
      `Immediate user-facing result: turn ${String(turnPayload.turnIndex)} was still answered by ${formatAvatar(turnPayload.avatarId, avatarNameById)}. GM changes apply on the next turn.`,
    )
    if (turnPayload.contextSelection) {
      impacts.push(formatAvatarContext(turnPayload))
    }
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

function buildAvatarNameById(snapshot: RuntimeInspectorViewModel): Map<string, string> {
  const avatarNameById = new Map<string, string>()

  for (const avatar of snapshot.context.gm.availableAvatars) {
    avatarNameById.set(avatar.avatarId, avatar.name)
  }

  for (const event of snapshot.recentEvents) {
    if (event.type !== 'gm_triggered') continue
    if (!isGmPayload(event.payload)) continue
    const unlockEvaluations = event.payload.decision?.unlockEvaluations ?? []
    for (const unlock of unlockEvaluations) {
      avatarNameById.set(unlock.avatarId, unlock.avatarName)
    }
  }

  return avatarNameById
}

function describeStateBefore(
  payload: GmSessionEventPayload,
  avatarNameById: Map<string, string>,
): string {
  const currentAvatar = payload.stateBefore.currentAvatarId
  const avatarText =
    currentAvatar === undefined
      ? 'no active avatar was recorded'
      : `the active avatar was ${formatAvatar(currentAvatar, avatarNameById)}`
  const progression =
    payload.stateBefore.progression.length > 0
      ? `progression was "${payload.stateBefore.progression}"`
      : 'no progression label was recorded'

  return `Before the decision, ${avatarText} and ${progression}.`
}

function describeDecision(
  decision: NonNullable<GmSessionEventPayload['decision']>,
  payload: GmSessionEventPayload,
  avatarNameById: Map<string, string>,
): string {
  const targetAvatar = formatAvatar(decision.avatarId, avatarNameById)
  const sameAvatar = payload.stateBefore.currentAvatarId === decision.avatarId

  if (decision.conversationMode === 'continue') {
    return sameAvatar
      ? `GM kept ${targetAvatar} as the active avatar.`
      : `GM chose to continue with ${targetAvatar}.`
  }

  return sameAvatar
    ? `GM asked for a fresh conversation with ${targetAvatar}, even though it is the same avatar as the current turn.`
    : `GM asked to start a new conversation with ${targetAvatar}.`
}

function formatAvatar(avatarId: string, avatarNameById: Map<string, string>): string {
  const avatarName = avatarNameById.get(avatarId)
  return avatarName ? `${avatarName} (${avatarId})` : avatarId
}

function formatTriggerReason(triggerReason: string | null): string {
  if (triggerReason === null) return 'no trigger reason was recorded'
  return triggerReason.replaceAll('_', ' ')
}

function formatAvatarContext(turnPayload: TurnCompletedEventPayload): string {
  const selected = turnPayload.contextSelection
  if (!selected) return 'Avatar context used for this reply: unavailable.'

  const retrievalTotal =
    selected.retrievalCounts.memory +
    selected.retrievalCounts.world +
    selected.retrievalCounts.media

  return [
    `Avatar context used for this reply: ${String(selected.shortTermExchangeCount)} recent exchange${selected.shortTermExchangeCount === 1 ? '' : 's'}`,
    selected.hasWorkingMemory ? 'working memory included' : 'no working memory',
    `${String(selected.longTermFactCount)} long-term fact${selected.longTermFactCount === 1 ? '' : 's'}`,
    `${String(retrievalTotal)} retrieved reference${retrievalTotal === 1 ? '' : 's'} (${String(selected.retrievalCounts.memory)} memory / ${String(selected.retrievalCounts.world)} world / ${String(selected.retrievalCounts.media)} media)`,
    selected.hasGmDirective ? 'GM note included' : 'no GM note',
    selected.hasUserPersona ? 'user persona included' : 'no user persona',
  ].join(', ')
}

function isGmPayload(payload: SessionEventRecord['payload']): payload is GmSessionEventPayload {
  return 'interactionCount' in payload
}

function isTurnPayload(
  payload: SessionEventRecord['payload'],
): payload is TurnCompletedEventPayload {
  return 'conversationId' in payload
}

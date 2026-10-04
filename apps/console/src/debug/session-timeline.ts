import type {
  GmSessionEventPayload,
  MemoryConsolidationEventPayload,
  MemoryRefreshEventPayload,
  Message,
  SessionEventRecord,
  TurnCompletedEventPayload,
} from '@gami/shared'

/** The GM run that followed a turn (or an operator replay). */
export type GmRun = {
  status: 'ok' | 'error'
  createdAt: string
  payload: GmSessionEventPayload
}

/** One working-memory refresh: triggered, then succeeded or failed (or still running). */
export type MemoryRun = {
  status: 'running' | 'ok' | 'failed'
  createdAt: string
  trigger: MemoryRefreshEventPayload['trigger']
  conversationId: string
  payload: MemoryRefreshEventPayload | null
}

export type ConsolidationStep = {
  kind: 'facts' | 'episodic'
  status: 'ok' | 'failed'
  createdAt: string
  payload: MemoryConsolidationEventPayload
}

export type TurnEntry = {
  kind: 'turn'
  id: string
  createdAt: string
  turn: TurnCompletedEventPayload
  userMessage: Message | null
  avatarMessage: Message | null
  gm: GmRun | null
  memory: MemoryRun[]
}

/** Work not caused by a turn: GM replays, conversation-close and avatar-switch memory work. */
export type BackgroundEntry = {
  kind: 'background'
  id: string
  createdAt: string
  conversationId: string | null
  gm: GmRun | null
  memory: MemoryRun[]
  consolidation: ConsolidationStep[]
}

export type TimelineEntry = TurnEntry | BackgroundEntry

/**
 * Joins the session event log with conversation messages into a chronological debug timeline.
 * Events sharing a correlation id belong to the same turn (or the same background job).
 */
export function buildSessionTimeline(
  events: SessionEventRecord[],
  messagesByConversation: Record<string, Message[]>,
): TimelineEntry[] {
  const ordered = [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const turns = new Map<string, TurnEntry>()
  const background = new Map<string, BackgroundEntry>()
  const usedMessageIds = new Set<string>()

  for (const event of ordered) {
    if (event.type !== 'turn_completed') continue
    const turn = event.payload as TurnCompletedEventPayload
    const messages = matchTurnMessages(
      messagesByConversation[turn.conversationId] ?? [],
      event.createdAt,
      usedMessageIds,
    )
    turns.set(event.correlationId, {
      kind: 'turn',
      id: event.correlationId,
      createdAt: event.createdAt,
      turn,
      ...messages,
      gm: null,
      memory: [],
    })
  }

  const owner = (event: SessionEventRecord): TurnEntry | BackgroundEntry => {
    const turn = turns.get(event.correlationId)
    if (turn !== undefined) return turn
    let entry = background.get(event.correlationId)
    if (entry === undefined) {
      entry = {
        kind: 'background',
        id: event.correlationId,
        createdAt: event.createdAt,
        conversationId: readConversationId(event),
        gm: null,
        memory: [],
        consolidation: [],
      }
      background.set(event.correlationId, entry)
    }
    return entry
  }

  for (const event of ordered) {
    if (event.type !== 'turn_completed') applyFollowUpEvent(owner(event), event)
  }

  const timeline: TimelineEntry[] = [...turns.values(), ...background.values()].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )
  return mergeAdjacentBackgroundWork(timeline)
}

const BACKGROUND_MERGE_WINDOW_MS = 60_000

// Closing a conversation runs refresh, fact extraction, and episodic generation as separate jobs;
// show them as one entry when they follow each other on the same conversation.
function mergeAdjacentBackgroundWork(timeline: TimelineEntry[]): TimelineEntry[] {
  const merged: TimelineEntry[] = []
  for (const entry of timeline) {
    const previous = merged[merged.length - 1]
    if (
      entry.kind === 'background' &&
      previous?.kind === 'background' &&
      entry.gm === null &&
      previous.gm === null &&
      entry.conversationId === previous.conversationId &&
      Date.parse(entry.createdAt) - Date.parse(previous.createdAt) <= BACKGROUND_MERGE_WINDOW_MS
    ) {
      previous.memory.push(...entry.memory)
      previous.consolidation.push(...entry.consolidation)
      continue
    }
    merged.push(entry)
  }
  return merged
}

function applyFollowUpEvent(entry: TurnEntry | BackgroundEntry, event: SessionEventRecord): void {
  switch (event.type) {
    case 'gm_triggered':
    case 'gm_error':
      entry.gm = {
        status: event.type === 'gm_triggered' ? 'ok' : 'error',
        createdAt: event.createdAt,
        payload: event.payload as GmSessionEventPayload,
      }
      return
    case 'memory_refresh_triggered':
    case 'memory_refresh_succeeded':
    case 'memory_refresh_failed':
      applyMemoryEvent(entry.memory, event)
      return
    default:
      if (entry.kind === 'background') entry.consolidation.push(toConsolidationStep(event))
  }
}

// The Avatar message is persisted just before turn_completed is logged, so the turn's reply is the
// latest unused Avatar message at or before the event, and its prompt the user message before it.
function matchTurnMessages(
  messages: Message[],
  eventCreatedAt: string,
  used: Set<string>,
): { userMessage: Message | null; avatarMessage: Message | null } {
  const ordered = [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const avatarIndex = findLastIndex(
    ordered,
    (message) =>
      message.role === 'avatar' &&
      !used.has(message.messageId) &&
      message.createdAt <= eventCreatedAt,
  )
  if (avatarIndex < 0) return { userMessage: null, avatarMessage: null }
  const avatarMessage = ordered[avatarIndex] ?? null
  const userIndex = findLastIndex(
    ordered.slice(0, avatarIndex),
    (message) => message.role === 'user' && !used.has(message.messageId),
  )
  const userMessage = userIndex < 0 ? null : (ordered[userIndex] ?? null)
  if (avatarMessage !== null) used.add(avatarMessage.messageId)
  if (userMessage !== null) used.add(userMessage.messageId)
  return { userMessage, avatarMessage }
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]
    if (item !== undefined && predicate(item)) return index
  }
  return -1
}

function applyMemoryEvent(runs: MemoryRun[], event: SessionEventRecord): void {
  const payload = event.payload as MemoryRefreshEventPayload
  if (event.type === 'memory_refresh_triggered') {
    runs.push({
      status: 'running',
      createdAt: event.createdAt,
      trigger: payload.trigger,
      conversationId: payload.conversationId,
      payload: null,
    })
    return
  }
  const status = event.type === 'memory_refresh_succeeded' ? 'ok' : 'failed'
  const running = runs.find(
    (run) =>
      run.status === 'running' &&
      run.trigger === payload.trigger &&
      run.conversationId === payload.conversationId,
  )
  if (running !== undefined) {
    running.status = status
    running.payload = payload
    return
  }
  runs.push({
    status,
    createdAt: event.createdAt,
    trigger: payload.trigger,
    conversationId: payload.conversationId,
    payload,
  })
}

function toConsolidationStep(event: SessionEventRecord): ConsolidationStep {
  return {
    kind: event.type.startsWith('user_fact_extraction') ? 'facts' : 'episodic',
    status: event.type.endsWith('_succeeded') ? 'ok' : 'failed',
    createdAt: event.createdAt,
    payload: event.payload as MemoryConsolidationEventPayload,
  }
}

function readConversationId(event: SessionEventRecord): string | null {
  const payload = event.payload as Partial<Record<'conversationId', unknown>>
  return typeof payload.conversationId === 'string' ? payload.conversationId : null
}

export function backgroundLabel(entry: BackgroundEntry): string {
  if (entry.gm !== null) {
    if (entry.id.startsWith('admin_gm_replay')) return 'GM replay (operator)'
    return entry.gm.payload.turnIndex === 0 ? 'GM: conversation opening' : 'GM run'
  }
  const trigger = entry.memory[0]?.trigger
  if (trigger === 'avatar_switch') return 'Avatar switch: memory saved'
  if (trigger === 'admin_trigger') return 'Memory refresh (operator)'
  return 'Conversation closed: memory consolidated'
}

import type {
  SessionMemoryLayers,
  SessionEventRecord,
  TurnCompletedEventPayload,
} from '@gami/shared'

export type MemoryEvolutionSnapshot = {
  snapshotId: string
  capturedAt: string
  turnIndex: number | null
  conversationId: string | null
  layers: SessionMemoryLayers
}

export type LongTermAvatarMemory =
  SessionMemoryLayers['longTerm']['avatars'][number]['memories'][number] & {
    avatarId: string
  }

export type MemoryEvolutionDelta = {
  shortTerm: {
    added: Array<{ user: string; avatar: string }>
    removed: Array<{ user: string; avatar: string }>
  }
  working: {
    sessionChanged: boolean
    avatarAdded: Array<{ avatarId: string; summary: string }>
    avatarRemoved: Array<{ avatarId: string; summary: string }>
    avatarChanged: Array<{ avatarId: string; from: string; to: string }>
    stale: boolean
  }
  longTerm: {
    added: LongTermAvatarMemory[]
    removed: LongTermAvatarMemory[]
    changed: Array<{ key: string; from: string; to: string }>
  }
}

const MAX_MEMORY_SNAPSHOTS = 8

export function buildMemorySnapshot(
  layers: SessionMemoryLayers,
  recentEvents: SessionEventRecord[],
): MemoryEvolutionSnapshot {
  const latestTurn = getLatestTurnEvent(recentEvents)
  const marker = getSnapshotMarker(layers)

  return {
    snapshotId: `${latestTurn?.correlationId ?? 'memory'}:${layers.sessionId}:${marker}`,
    capturedAt: new Date().toISOString(),
    turnIndex: latestTurn?.turnIndex ?? null,
    conversationId: latestTurn?.conversationId ?? null,
    layers,
  }
}

function getSnapshotMarker(layers: SessionMemoryLayers): string {
  if (layers.working.current?.updatedAt !== undefined) {
    return layers.working.current.updatedAt
  }
  if (layers.working.session?.updatedAt !== undefined) {
    return layers.working.session.updatedAt
  }
  return String(layers.shortTerm.exchangeCount)
}

export function pushMemorySnapshotHistory(
  history: MemoryEvolutionSnapshot[],
  next: MemoryEvolutionSnapshot,
): MemoryEvolutionSnapshot[] {
  const previous = history[history.length - 1]
  if (previous && areMemorySnapshotsEquivalent(previous, next)) {
    return history
  }

  return [...history, next].slice(-MAX_MEMORY_SNAPSHOTS)
}

// eslint-disable-next-line complexity
export function computeMemoryDelta(
  previous: MemoryEvolutionSnapshot | null,
  current: MemoryEvolutionSnapshot,
): MemoryEvolutionDelta {
  if (previous === null) {
    return {
      shortTerm: {
        added: [...current.layers.shortTerm.recentExchanges],
        removed: [],
      },
      working: {
        sessionChanged: current.layers.working.session !== undefined,
        avatarAdded: current.layers.working.avatars.map((avatar) => ({
          avatarId: avatar.avatarId,
          summary: avatar.summary,
        })),
        avatarRemoved: [],
        avatarChanged: [],
        stale: false,
      },
      longTerm: {
        added: [...flattenLongTermMemories(current.layers)],
        removed: [],
        changed: [],
      },
    }
  }

  const shortTermDelta = computeShortTermDelta(previous, current)
  const workingDelta = computeWorkingDelta(previous, current)
  const longTermDelta = computeLongTermDelta(previous, current)

  const sessionChanged =
    (previous.layers.working.session?.summary ?? '') !==
    (current.layers.working.session?.summary ?? '')

  const turnAdvanced =
    previous.turnIndex !== null &&
    current.turnIndex !== null &&
    current.turnIndex > previous.turnIndex
  const hasWorkingUpdate =
    sessionChanged || workingDelta.avatarAdded.length > 0 || workingDelta.avatarChanged.length > 0

  return {
    shortTerm: {
      added: shortTermDelta.added,
      removed: shortTermDelta.removed,
    },
    working: {
      sessionChanged,
      avatarAdded: workingDelta.avatarAdded,
      avatarRemoved: workingDelta.avatarRemoved,
      avatarChanged: workingDelta.avatarChanged,
      stale: turnAdvanced && !hasWorkingUpdate,
    },
    longTerm: {
      added: longTermDelta.added,
      removed: longTermDelta.removed,
      changed: longTermDelta.changed,
    },
  }
}

function computeShortTermDelta(
  previous: MemoryEvolutionSnapshot,
  current: MemoryEvolutionSnapshot,
) {
  const previousShortTerm = new Set(
    previous.layers.shortTerm.recentExchanges.map((exchange) => serializeExchange(exchange)),
  )
  const currentShortTerm = new Set(
    current.layers.shortTerm.recentExchanges.map((exchange) => serializeExchange(exchange)),
  )

  return {
    added: current.layers.shortTerm.recentExchanges.filter(
      (exchange) => !previousShortTerm.has(serializeExchange(exchange)),
    ),
    removed: previous.layers.shortTerm.recentExchanges.filter(
      (exchange) => !currentShortTerm.has(serializeExchange(exchange)),
    ),
  }
}

function computeWorkingDelta(previous: MemoryEvolutionSnapshot, current: MemoryEvolutionSnapshot) {
  const previousWorkingByAvatar = new Map(
    previous.layers.working.avatars.map((item) => [item.avatarId, item]),
  )
  const currentWorkingByAvatar = new Map(
    current.layers.working.avatars.map((item) => [item.avatarId, item]),
  )

  return {
    avatarAdded: current.layers.working.avatars
      .filter((item) => !previousWorkingByAvatar.has(item.avatarId))
      .map((item) => ({ avatarId: item.avatarId, summary: item.summary })),
    avatarRemoved: previous.layers.working.avatars
      .filter((item) => !currentWorkingByAvatar.has(item.avatarId))
      .map((item) => ({ avatarId: item.avatarId, summary: item.summary })),
    avatarChanged: current.layers.working.avatars
      .filter((item) => {
        const previousItem = previousWorkingByAvatar.get(item.avatarId)
        return previousItem !== undefined && previousItem.summary !== item.summary
      })
      .map((item) => {
        const previousItem = previousWorkingByAvatar.get(item.avatarId)
        return {
          avatarId: item.avatarId,
          from: previousItem?.summary ?? '',
          to: item.summary,
        }
      }),
  }
}

function computeLongTermDelta(previous: MemoryEvolutionSnapshot, current: MemoryEvolutionSnapshot) {
  const previousFactsByKey = new Map(
    flattenLongTermMemories(previous.layers).map((memory) => [
      serializeLongTermKey(memory),
      memory,
    ]),
  )
  const currentFactsByKey = new Map(
    flattenLongTermMemories(current.layers).map((memory) => [serializeLongTermKey(memory), memory]),
  )

  return {
    added: flattenLongTermMemories(current.layers).filter(
      (memory) => !previousFactsByKey.has(serializeLongTermKey(memory)),
    ),
    removed: flattenLongTermMemories(previous.layers).filter(
      (memory) => !currentFactsByKey.has(serializeLongTermKey(memory)),
    ),
    changed: flattenLongTermMemories(current.layers)
      .filter((memory) => {
        const previousFact = previousFactsByKey.get(serializeLongTermKey(memory))
        return previousFact !== undefined && previousFact.summary !== memory.summary
      })
      .map((memory) => {
        const key = serializeLongTermKey(memory)
        const previousFact = previousFactsByKey.get(key)
        return {
          key,
          from: previousFact?.summary ?? '',
          to: memory.summary,
        }
      }),
  }
}

function serializeExchange(exchange: { user: string; avatar: string }): string {
  return `${exchange.user}::${exchange.avatar}`
}

function serializeLongTermKey(memory: LongTermAvatarMemory): string {
  return `${memory.avatarId}:${memory.conversationId}`
}

function flattenLongTermMemories(layers: SessionMemoryLayers): LongTermAvatarMemory[] {
  return layers.longTerm.avatars.flatMap((avatar) =>
    avatar.memories.map((memory) => ({
      avatarId: avatar.avatarId,
      ...memory,
    })),
  )
}

function areMemorySnapshotsEquivalent(
  previous: MemoryEvolutionSnapshot,
  next: MemoryEvolutionSnapshot,
): boolean {
  return (
    previous.turnIndex === next.turnIndex &&
    JSON.stringify(previous.layers.shortTerm) === JSON.stringify(next.layers.shortTerm) &&
    JSON.stringify(previous.layers.working) === JSON.stringify(next.layers.working) &&
    JSON.stringify(previous.layers.longTerm) === JSON.stringify(next.layers.longTerm)
  )
}

function getLatestTurnEvent(
  recentEvents: SessionEventRecord[],
): { turnIndex: number; conversationId: string; correlationId: string } | null {
  let latest: { turnIndex: number; conversationId: string; correlationId: string } | null = null

  for (const event of recentEvents) {
    if (event.type !== 'turn_completed') continue
    if (!isTurnCompletedPayload(event.payload)) continue
    const candidate = {
      turnIndex: event.payload.turnIndex,
      conversationId: event.payload.conversationId,
      correlationId: event.correlationId,
    }

    if (latest === null || candidate.turnIndex >= latest.turnIndex) {
      latest = candidate
    }
  }

  return latest
}

function isTurnCompletedPayload(
  payload: SessionEventRecord['payload'],
): payload is TurnCompletedEventPayload {
  return 'conversationId' in payload
}

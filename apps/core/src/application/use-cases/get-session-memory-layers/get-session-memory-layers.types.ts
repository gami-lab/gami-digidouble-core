import type { SessionMemoryLayers } from '@gami/shared'

export type GetSessionMemoryLayersInput = {
  sessionId: string
}

export type GetSessionMemoryLayersOutput = {
  memory: SessionMemoryLayers
}

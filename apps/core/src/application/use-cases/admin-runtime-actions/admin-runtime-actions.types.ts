import type {
  AdminClearMemoryResponse,
  AdminRefreshMemoryResponse,
  AdminReplayGmResponse,
} from '@gami/shared'

export type ReplayGmInput = {
  sessionId: string
}

export type RefreshMemoryInput = {
  sessionId: string
}

export type ClearMemoryInput = {
  sessionId: string
}

export type ReplayGmOutput = AdminReplayGmResponse
export type RefreshMemoryOutput = AdminRefreshMemoryResponse
export type ClearMemoryOutput = AdminClearMemoryResponse

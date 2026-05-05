import type { RuntimeState } from '@gami/shared'

export type GetRuntimeStateInput = {
  sessionId: string
}

export type GetRuntimeStateOutput = {
  runtimeState: RuntimeState
}

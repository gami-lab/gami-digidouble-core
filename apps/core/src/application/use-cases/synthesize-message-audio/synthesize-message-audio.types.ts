import type { AudioOutputFormat } from '@gami/shared'

export type SynthesizeMessageAudioInput = Readonly<{
  conversationId: string
  messageId: string
  requestId: string
  format?: AudioOutputFormat
  signal?: AbortSignal
}>

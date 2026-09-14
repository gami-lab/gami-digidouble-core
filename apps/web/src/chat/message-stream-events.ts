import type { MessageStreamEvent } from '@gami/shared'

export function isTerminalMessageStreamEvent(event: MessageStreamEvent): boolean {
  return (
    event.type === 'conversation.message.completed' ||
    event.type === 'conversation.message.interrupted' ||
    event.type === 'conversation.message.error'
  )
}

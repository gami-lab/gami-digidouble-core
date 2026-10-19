import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActiveChatRuntimeState } from '../chat/use-active-chat-runtime'
import type { VoiceConversationState } from '../voice/use-voice-conversation'

/** Secondary text input; with voice on, Send also submits what the microphone heard so far. */
export function TextComposer({
  chat,
  voice,
  disabled = false,
}: {
  chat: ActiveChatRuntimeState
  voice: VoiceConversationState
  disabled?: boolean
}): JSX.Element {
  const { t } = useTranslation()
  const hasText = chat.composerValue.trim().length > 0
  return (
    <form
      className="text-composer"
      onSubmit={(event) => {
        event.preventDefault()
        if (hasText || !voice.submitNow()) chat.sendCurrentMessage()
      }}
    >
      <label className="field">
        <span>{t('chat.message.label')}</span>
        <textarea
          value={chat.composerValue}
          onChange={(event) => {
            chat.setComposerValue(event.target.value)
          }}
          onKeyDown={(event) => {
            if (isSendKey(event)) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
          rows={2}
          disabled={disabled}
          placeholder={t('chat.message.placeholder')}
        />
      </label>
      {chat.sendError !== null ? <p className="error">{chat.sendError}</p> : null}
      <button type="submit" className="button-secondary" disabled={disabled || !chat.canSend}>
        {chat.sendStatus === 'streaming' ? t('chat.sending') : t('chat.send')}
      </button>
    </form>
  )
}

/** Enter sends; Shift+Enter keeps a newline; Enter that confirms an IME composition never sends. */
export function isSendKey(event: {
  key: string
  shiftKey: boolean
  nativeEvent: { isComposing: boolean }
}): boolean {
  return event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing
}

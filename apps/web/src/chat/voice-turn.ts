import i18n from '../i18n/index'
import { sendVoiceMessageStream } from '../api/conversations'
import { startStreamedTurn, type StreamedTurnArgs } from './message-stream-runtime'

/** Starts a voice turn: the pending bubble reads "transcribing" until Core echoes the transcript. */
export function startVoiceTurn(
  conversationId: string,
  recording: { audio: Blob; durationMs?: number },
  runId: number,
  setters: StreamedTurnArgs['setters'],
): void {
  startStreamedTurn({
    conversationId,
    pendingContent: i18n.t('chat.voice.transcribing'),
    send: (onEvent, signal) =>
      sendVoiceMessageStream(
        conversationId,
        {
          audio: recording.audio,
          utteranceId: crypto.randomUUID(),
          ...(recording.durationMs === undefined ? {} : { durationMs: recording.durationMs }),
        },
        { onEvent },
        signal,
      ),
    runId,
    setters,
  })
}

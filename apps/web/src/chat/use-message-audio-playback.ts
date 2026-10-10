import { useCallback, useEffect, useRef, useState } from 'react'
import { requestMessageAudio } from '../api/conversations'
import { ApiError } from '../api/client'
import { PcmStreamPlayer } from './pcm-stream-player'

export type AudioPlaybackStatus =
  'idle' | 'loading' | 'playing' | 'stopped' | 'unsupported' | 'failed'

export type AudioPlaybackState = Readonly<{
  messageId: string | null
  status: AudioPlaybackStatus
  errorCode: string | null
}>

export type MessageAudioPlayback = Readonly<{
  audio: AudioPlaybackState
  playMessageAudio: (messageId: string) => void
  stopMessageAudio: () => void
}>

type AudioResources = {
  controller: AbortController
  context: AudioContext
}

const INITIAL_AUDIO_STATE: AudioPlaybackState = {
  messageId: null,
  status: 'idle',
  errorCode: null,
}

/** How long a suspended AudioContext may take to start before playback counts as blocked. */
const AUTOPLAY_UNLOCK_MS = 300

/**
 * Streams reply audio as raw PCM and plays each chunk as it arrives, so the voice starts with the
 * first synthesized words instead of after the whole clip.
 */
// eslint-disable-next-line max-lines-per-function -- retained fixture or orchestration setup is clearer together
export function useMessageAudioPlayback(conversationId: string | null): MessageAudioPlayback {
  const [audio, setAudio] = useState<AudioPlaybackState>(INITIAL_AUDIO_STATE)
  const mountedRef = useRef(true)
  const operationRef = useRef(0)
  const resourcesRef = useRef<AudioResources | null>(null)

  const isCurrentOperation = useCallback((operationId: number): boolean => {
    return mountedRef.current && operationRef.current === operationId
  }, [])

  const cleanupResources = useCallback((): void => {
    const resources = resourcesRef.current
    resourcesRef.current = null
    if (resources === null) return
    resources.controller.abort()
    void resources.context.close().catch(() => undefined)
  }, [])

  const stopMessageAudio = useCallback((): void => {
    operationRef.current += 1
    cleanupResources()
    if (!mountedRef.current) return
    setAudio((current) => ({
      ...current,
      status: current.messageId === null ? 'idle' : 'stopped',
      errorCode: null,
    }))
  }, [cleanupResources])

  const playMessageAudio = useCallback(
    (messageId: string): void => {
      operationRef.current += 1
      const operationId = operationRef.current
      cleanupResources()

      if (typeof AudioContext === 'undefined') {
        setAudio({ messageId, status: 'unsupported', errorCode: null })
        return
      }
      if (conversationId === null) {
        setAudio({ messageId, status: 'failed', errorCode: 'NO_CONVERSATION' })
        return
      }

      const controller = new AbortController()
      // Created before the request so the browser can unlock audio while synthesis starts.
      const context = new AudioContext()
      const unlocked = context.resume().catch(() => undefined)
      resourcesRef.current = { controller, context }
      setAudio({ messageId, status: 'loading', errorCode: null })

      const finish = (status: AudioPlaybackStatus, errorCode: string | null): void => {
        if (!isCurrentOperation(operationId)) return
        operationRef.current += 1
        cleanupResources()
        setAudio((current) => ({ ...current, status, errorCode }))
      }

      const play = async (): Promise<void> => {
        const delivery = await requestMessageAudio(
          conversationId,
          messageId,
          { format: 'audio/pcm' },
          controller.signal,
        )
        if (!isCurrentOperation(operationId)) return
        if (delivery.metadata.format !== 'audio/pcm') {
          finish('unsupported', null)
          return
        }
        await Promise.race([unlocked, wait(AUTOPLAY_UNLOCK_MS)])
        if (!isCurrentOperation(operationId)) return
        if (context.state !== 'running') {
          finish('stopped', 'AUTOPLAY_BLOCKED')
          return
        }

        const player = new PcmStreamPlayer(context)
        const reader = delivery.body.getReader()
        let started = false
        for (;;) {
          const next = await reader.read()
          if (!isCurrentOperation(operationId)) return
          if (next.done) break
          player.enqueue(next.value)
          if (!started) {
            started = true
            setAudio((current) => ({ ...current, status: 'playing' }))
          }
        }
        if (!started) {
          finish('failed', 'NETWORK_ERROR')
          return
        }
        await player.ended()
        finish('stopped', null)
      }

      void play().catch((error: unknown) => {
        if (controller.signal.aborted) return
        finish('failed', error instanceof ApiError ? error.code : 'NETWORK_ERROR')
      })
    },
    [cleanupResources, conversationId, isCurrentOperation],
  )

  useEffect(() => {
    operationRef.current += 1
    cleanupResources()
    setAudio(INITIAL_AUDIO_STATE)
  }, [cleanupResources, conversationId])

  useEffect(() => {
    // StrictMode runs cleanup then re-runs this effect; without resetting the flag every later
    // result would be ignored and playback would stay "loading" forever.
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      operationRef.current += 1
      cleanupResources()
    }
  }, [cleanupResources])

  return { audio, playMessageAudio, stopMessageAudio }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

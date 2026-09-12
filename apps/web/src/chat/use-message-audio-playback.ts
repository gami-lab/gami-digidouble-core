import { useCallback, useEffect, useRef, useState } from 'react'
import type { AudioDeliveryRequest } from '@gami/shared'
import { requestMessageAudio } from '../api/conversations'
import { ApiError } from '../api/client'

export type AudioPlaybackStatus =
  'idle' | 'loading' | 'playing' | 'stopped' | 'unsupported' | 'failed'

export type AudioPlaybackState = Readonly<{
  messageId: string | null
  status: AudioPlaybackStatus
  durationMs: number | null
  errorCode: string | null
}>

export type MessageAudioPlayback = Readonly<{
  audio: AudioPlaybackState
  playMessageAudio: (messageId: string, request?: AudioDeliveryRequest) => void
  stopMessageAudio: () => void
}>

type AudioResources = {
  controller: AbortController
  element: HTMLAudioElement | null
  objectUrl: string | null
  listeners: AudioListener[]
}

type AudioListener = {
  type: 'playing' | 'ended' | 'error'
  listener: EventListener
}

const INITIAL_AUDIO_STATE: AudioPlaybackState = {
  messageId: null,
  status: 'idle',
  durationMs: null,
  errorCode: null,
}

// eslint-disable-next-line max-lines-per-function
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
    if (resources.element !== null) {
      for (const { type, listener } of resources.listeners) {
        resources.element.removeEventListener(type, listener)
      }
      resources.element.pause()
      resources.element.removeAttribute('src')
      resources.element.load()
    }
    if (resources.objectUrl !== null) {
      URL.revokeObjectURL(resources.objectUrl)
    }
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
    // eslint-disable-next-line max-lines-per-function
    (messageId: string, request?: AudioDeliveryRequest): void => {
      operationRef.current += 1
      const operationId = operationRef.current
      cleanupResources()

      if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') {
        setAudio({
          messageId,
          status: 'unsupported',
          durationMs: null,
          errorCode: null,
        })
        return
      }

      const controller = new AbortController()
      resourcesRef.current = {
        controller,
        element: null,
        objectUrl: null,
        listeners: [],
      }
      setAudio({ messageId, status: 'loading', durationMs: null, errorCode: null })

      if (conversationId === null) {
        setAudio({ messageId, status: 'failed', durationMs: null, errorCode: 'NO_CONVERSATION' })
        cleanupResources()
        return
      }

      void requestMessageAudio(conversationId, messageId, request, controller.signal)
        .then(async (delivery) => {
          if (!isCurrentOperation(operationId)) return

          const element = document.createElement('audio')
          if (element.canPlayType(delivery.metadata.format) === '') {
            cleanupResources()
            setAudio({ messageId, status: 'unsupported', durationMs: null, errorCode: null })
            return
          }

          const objectUrl = URL.createObjectURL(delivery.blob)
          const resources = resourcesRef.current
          if (resources === null || !isCurrentOperation(operationId)) {
            URL.revokeObjectURL(objectUrl)
            return
          }

          const listeners: AudioListener[] = [
            {
              type: 'playing',
              listener: () => {
                if (isCurrentOperation(operationId)) {
                  setAudio((current) => ({ ...current, status: 'playing' }))
                }
              },
            },
            {
              type: 'ended',
              listener: () => {
                if (!isCurrentOperation(operationId)) return
                operationRef.current += 1
                cleanupResources()
                setAudio((current) => ({ ...current, status: 'stopped' }))
              },
            },
            {
              type: 'error',
              listener: () => {
                if (!isCurrentOperation(operationId)) return
                operationRef.current += 1
                cleanupResources()
                setAudio((current) => ({
                  ...current,
                  status: 'failed',
                  errorCode: 'PLAYBACK_ERROR',
                }))
              },
            },
          ]
          resourcesRef.current = { controller, element, objectUrl, listeners }
          setAudio((current) => ({
            ...current,
            durationMs: delivery.metadata.durationMs ?? null,
          }))
          element.preload = 'auto'
          element.src = objectUrl
          for (const { type, listener } of listeners) {
            element.addEventListener(type, listener)
          }

          try {
            await element.play()
            if (!isCurrentOperation(operationId)) return
            setAudio((current) => ({ ...current, status: 'playing' }))
          } catch {
            if (!isCurrentOperation(operationId)) return
            cleanupResources()
            setAudio((current) => ({
              ...current,
              status: 'stopped',
              errorCode: 'AUTOPLAY_BLOCKED',
            }))
          }
        })
        .catch((error: unknown) => {
          if (!isCurrentOperation(operationId) || controller.signal.aborted) return
          setAudio((current) => ({
            ...current,
            status: 'failed',
            errorCode: error instanceof ApiError ? error.code : 'NETWORK_ERROR',
          }))
          cleanupResources()
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
    return () => {
      mountedRef.current = false
      operationRef.current += 1
      cleanupResources()
    }
  }, [cleanupResources])

  return { audio, playMessageAudio, stopMessageAudio }
}

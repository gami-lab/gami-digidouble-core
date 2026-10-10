import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActiveChatRuntimeState } from '../chat/use-active-chat-runtime'
import { computeRmsLevel, VoiceActivityDetector } from './voice-activity'
import { getVoiceLoopPhase, type VoiceLoopPhase } from './voice-loop'

const LEVEL_SAMPLE_INTERVAL_MS = 50
/** Restart a silent recording so it never grows while nobody talks. */
const IDLE_RECORDING_RESTART_MS = 30_000
const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
]

export type VoiceConversationError = 'unsupported' | 'permission-denied' | 'failed'

export type VoiceConversationState = Readonly<{
  supported: boolean
  enabled: boolean
  phase: VoiceLoopPhase
  /** Speech detected in the utterance being recorded (it will be sent on pause or Send). */
  hearing: boolean
  error: VoiceConversationError | null
  start: () => void
  stop: () => void
  /** Sends the current utterance now; returns false when there is no speech to send. */
  submitNow: () => boolean
}>

type Capture = {
  stream: MediaStream
  context: AudioContext
  analyser: AnalyserNode
}

type Recording = {
  recorder: MediaRecorder
  chunks: Blob[]
  startedAt: number
  timer: ReturnType<typeof setInterval>
  detector: VoiceActivityDetector
}

export function isVoiceCaptureSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    // mediaDevices is absent on non-secure origins even though the DOM types say otherwise.
    'mediaDevices' in navigator &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined' &&
    typeof AudioContext !== 'undefined'
  )
}

/**
 * Hands-free voice loop: records while listening, auto-sends on a pause, pauses the microphone
 * while the reply streams and plays, then listens again.
 */
// eslint-disable-next-line max-lines-per-function -- retained fixture or orchestration setup is clearer together
export function useVoiceConversation(chat: ActiveChatRuntimeState): VoiceConversationState {
  const [supported] = useState(isVoiceCaptureSupported)
  const [enabled, setEnabled] = useState(false)
  const [captureReady, setCaptureReady] = useState(false)
  const [hearing, setHearing] = useState(false)
  const [error, setError] = useState<VoiceConversationError | null>(null)
  const captureRef = useRef<Capture | null>(null)
  const recordingRef = useRef<Recording | null>(null)
  const chatRef = useRef(chat)
  chatRef.current = chat

  const phase = getVoiceLoopPhase(enabled && captureReady, chat.sendStatus, chat.audio.status)

  const finishRecording = useCallback((submit: boolean): void => {
    const recording = recordingRef.current
    if (recording === null) return
    recordingRef.current = null
    clearInterval(recording.timer)
    setHearing(false)
    const shouldSend = submit && recording.detector.hasSpeech
    const durationMs = Date.now() - recording.startedAt
    recording.recorder.onstop = () => {
      if (!shouldSend) return
      const audio = new Blob(recording.chunks, { type: recording.recorder.mimeType })
      chatRef.current.sendVoiceMessage(audio, durationMs)
    }
    if (recording.recorder.state !== 'inactive') recording.recorder.stop()
  }, [])

  const beginRecording = useCallback((): void => {
    const capture = captureRef.current
    if (capture === null || recordingRef.current !== null) return
    const mimeType = PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
    const recorder = new MediaRecorder(
      capture.stream,
      mimeType === undefined ? undefined : { mimeType },
    )
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    const detector = new VoiceActivityDetector()
    const startedAt = Date.now()
    detector.reset(startedAt)
    const samples = new Float32Array(capture.analyser.fftSize)
    const timer = setInterval(() => {
      const now = Date.now()
      capture.analyser.getFloatTimeDomainData(samples)
      const event = detector.update(computeRmsLevel(samples), now)
      if (event === 'speech-start') setHearing(true)
      if (event === 'utterance-end') finishRecording(true)
      if (!detector.hasSpeech && now - startedAt >= IDLE_RECORDING_RESTART_MS) {
        finishRecording(false)
        beginRecording()
      }
    }, LEVEL_SAMPLE_INTERVAL_MS)
    recordingRef.current = { recorder, chunks, startedAt, timer, detector }
    recorder.start()
  }, [finishRecording])

  const releaseCapture = useCallback((): void => {
    finishRecording(false)
    const capture = captureRef.current
    captureRef.current = null
    setCaptureReady(false)
    if (capture === null) return
    for (const track of capture.stream.getTracks()) track.stop()
    void capture.context.close().catch(() => undefined)
  }, [finishRecording])

  const start = useCallback((): void => {
    if (!supported) {
      setError('unsupported')
      return
    }
    setError(null)
    setEnabled(true)
    navigator.mediaDevices
      .getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      .then((stream) => {
        const context = new AudioContext()
        const analyser = context.createAnalyser()
        analyser.fftSize = 1024
        context.createMediaStreamSource(stream).connect(analyser)
        captureRef.current = { stream, context, analyser }
        setCaptureReady(true)
      })
      .catch((cause: unknown) => {
        setEnabled(false)
        setError(
          cause instanceof DOMException && cause.name === 'NotAllowedError'
            ? 'permission-denied'
            : 'failed',
        )
      })
  }, [supported])

  const stop = useCallback((): void => {
    setEnabled(false)
    releaseCapture()
  }, [releaseCapture])

  const submitNow = useCallback((): boolean => {
    if (recordingRef.current?.detector.hasSpeech !== true) return false
    finishRecording(true)
    return true
  }, [finishRecording])

  // Record only while listening; anything captured while the avatar answers is discarded.
  useEffect(() => {
    if (phase === 'listening') beginRecording()
    else finishRecording(false)
  }, [phase, beginRecording, finishRecording])

  useEffect(() => releaseCapture, [releaseCapture])

  return { supported, enabled, phase, hearing, error, start, stop, submitNow }
}

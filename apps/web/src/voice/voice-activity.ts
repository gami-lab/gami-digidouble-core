export type VoiceActivityConfig = Readonly<{
  /** RMS level (0..1) above which a frame counts as voice. */
  speechLevel: number
  /** Voiced time needed before a sound counts as speech (ignores clicks and coughs). */
  minSpeechMs: number
  /** Silence after speech that ends the utterance (the auto-submit pause). */
  silenceMs: number
  /** Hard cap, kept under Core's 120 s transcription limit. */
  maxUtteranceMs: number
}>

export const DEFAULT_VOICE_ACTIVITY: VoiceActivityConfig = Object.freeze({
  speechLevel: 0.02,
  minSpeechMs: 250,
  silenceMs: 1200,
  maxUtteranceMs: 110_000,
})

export type VoiceActivityEvent = 'none' | 'speech-start' | 'utterance-end'

/**
 * Turns a stream of microphone levels into "speech started" and "utterance ended" (pause or
 * length cap). Pure and clock-driven so it can be tested without a microphone.
 */
export class VoiceActivityDetector {
  private startedAt = 0
  private lastUpdateAt = 0
  private lastVoiceAt = 0
  private voicedMs = 0
  private speaking = false
  private ended = false

  constructor(private readonly config: VoiceActivityConfig = DEFAULT_VOICE_ACTIVITY) {}

  get hasSpeech(): boolean {
    return this.speaking
  }

  reset(nowMs: number): void {
    this.startedAt = nowMs
    this.lastUpdateAt = nowMs
    this.lastVoiceAt = nowMs
    this.voicedMs = 0
    this.speaking = false
    this.ended = false
  }

  /** Reports each event once; after `utterance-end` it stays quiet until `reset`. */
  update(level: number, nowMs: number): VoiceActivityEvent {
    if (this.ended) return 'none'
    const elapsed = Math.max(0, nowMs - this.lastUpdateAt)
    this.lastUpdateAt = nowMs
    const isVoice = level >= this.config.speechLevel
    if (isVoice) {
      this.voicedMs += elapsed
      this.lastVoiceAt = nowMs
    }

    if (!this.speaking) {
      if (this.voicedMs >= this.config.minSpeechMs) {
        this.speaking = true
        return 'speech-start'
      }
      // A lone blip followed by silence is noise, not the start of speech.
      if (nowMs - this.lastVoiceAt >= this.config.silenceMs) this.voicedMs = 0
      return 'none'
    }

    const paused = nowMs - this.lastVoiceAt >= this.config.silenceMs
    const tooLong = nowMs - this.startedAt >= this.config.maxUtteranceMs
    if (!paused && !tooLong) return 'none'
    this.ended = true
    return 'utterance-end'
  }
}

/** Root-mean-square level of time-domain samples in [-1, 1]. */
export function computeRmsLevel(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (const sample of samples) sum += sample * sample
  return Math.sqrt(sum / samples.length)
}

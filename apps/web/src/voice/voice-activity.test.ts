import { describe, expect, it } from 'vitest'
import { computeRmsLevel, VoiceActivityDetector } from './voice-activity'

const CONFIG = { speechLevel: 0.05, minSpeechMs: 200, silenceMs: 1000, maxUtteranceMs: 5000 }

/** Feeds `level` every 50 ms from `fromMs` (exclusive) to `toMs` (inclusive); returns events. */
function feed(detector: VoiceActivityDetector, level: number, fromMs: number, toMs: number) {
  const events: { at: number; event: string }[] = []
  for (let now = fromMs + 50; now <= toMs; now += 50) {
    const event = detector.update(level, now)
    if (event !== 'none') events.push({ at: now, event })
  }
  return events
}

describe('VoiceActivityDetector', () => {
  it('starts speech after enough voiced time and ends the utterance after the pause', () => {
    const detector = new VoiceActivityDetector(CONFIG)
    detector.reset(0)

    expect(feed(detector, 0.2, 0, 1000)).toEqual([{ at: 200, event: 'speech-start' }])
    expect(detector.hasSpeech).toBe(true)
    expect(feed(detector, 0.01, 1000, 2500)).toEqual([{ at: 2000, event: 'utterance-end' }])
  })

  it('does not end the utterance on short pauses between words', () => {
    const detector = new VoiceActivityDetector(CONFIG)
    detector.reset(0)
    feed(detector, 0.2, 0, 500)

    expect(feed(detector, 0.01, 500, 1200)).toEqual([])
    expect(feed(detector, 0.2, 1200, 1500)).toEqual([])
  })

  it('ignores isolated clicks shorter than the minimum speech time', () => {
    const detector = new VoiceActivityDetector(CONFIG)
    detector.reset(0)

    feed(detector, 0.3, 0, 100)
    feed(detector, 0.0, 100, 1500)
    expect(feed(detector, 0.3, 1500, 1600)).toEqual([])
    expect(detector.hasSpeech).toBe(false)
  })

  it('ends a long monologue at the length cap', () => {
    const detector = new VoiceActivityDetector(CONFIG)
    detector.reset(0)

    const events = feed(detector, 0.2, 0, 6000)
    expect(events).toEqual([
      { at: 200, event: 'speech-start' },
      { at: 5000, event: 'utterance-end' },
    ])
  })

  it('computes RMS of time-domain samples', () => {
    expect(computeRmsLevel(new Float32Array([]))).toBe(0)
    expect(computeRmsLevel(new Float32Array([0.5, -0.5, 0.5, -0.5]))).toBeCloseTo(0.5)
  })
})

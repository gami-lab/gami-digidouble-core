import { PCM_SAMPLE_RATE } from '@gami/shared'

/** Head start for each (re)started run of chunks, so network jitter does not cut the voice. */
const START_LEAD_SECONDS = 0.05

/**
 * Plays streamed `audio/pcm` (16-bit little-endian mono) on an AudioContext, scheduling every
 * chunk right after the previous one as soon as it arrives.
 */
export class PcmStreamPlayer {
  private nextStartTime = 0
  private pending = new Uint8Array(0)
  private lastSource: AudioBufferSourceNode | null = null

  constructor(private readonly context: AudioContext) {}

  enqueue(bytes: Uint8Array): void {
    const joined = new Uint8Array(this.pending.byteLength + bytes.byteLength)
    joined.set(this.pending)
    joined.set(bytes, this.pending.byteLength)
    const sampleCount = Math.floor(joined.byteLength / 2)
    // A sample can be split across chunks; keep its first byte for the next one.
    this.pending = joined.slice(sampleCount * 2)
    if (sampleCount === 0) return

    const buffer = this.context.createBuffer(1, sampleCount, PCM_SAMPLE_RATE)
    buffer.copyToChannel(decodePcm16(joined, sampleCount), 0)
    const source = this.context.createBufferSource()
    source.buffer = buffer
    source.connect(this.context.destination)
    const startAt = Math.max(this.nextStartTime, this.context.currentTime + START_LEAD_SECONDS)
    source.start(startAt)
    this.nextStartTime = startAt + sampleCount / PCM_SAMPLE_RATE
    this.lastSource = source
  }

  /** Resolves once everything enqueued so far has played. */
  ended(): Promise<void> {
    const source = this.lastSource
    if (source === null) return Promise.resolve()
    return new Promise((resolve) => {
      source.addEventListener('ended', () => {
        resolve()
      })
    })
  }
}

export function decodePcm16(bytes: Uint8Array, sampleCount: number): Float32Array<ArrayBuffer> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, sampleCount * 2)
  const samples = new Float32Array(sampleCount)
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / 32_768
  }
  return samples
}

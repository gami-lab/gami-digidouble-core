import { describe, expect, it } from 'vitest'
import { decodePcm16 } from './pcm-stream-player'

describe('decodePcm16', () => {
  it('decodes 16-bit little-endian samples to the Web Audio range', () => {
    const bytes = Uint8Array.from([0x00, 0x00, 0xff, 0x7f, 0x00, 0x80, 0x00, 0x40, 0x99])

    expect(Array.from(decodePcm16(bytes, 4))).toEqual([0, 32_767 / 32_768, -1, 0.5])
  })

  it('reads from a view that does not start at the beginning of its buffer', () => {
    const bytes = Uint8Array.from([0x11, 0x00, 0x40]).subarray(1)

    expect(Array.from(decodePcm16(bytes, 1))).toEqual([0.5])
  })
})

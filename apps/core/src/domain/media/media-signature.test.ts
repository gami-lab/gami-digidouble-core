import { describe, expect, it } from 'vitest'
import { matchesMediaSignature } from './media-signature.js'

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values)
const text = (value: string): number[] => Array.from(new TextEncoder().encode(value))

describe('media signatures', () => {
  it.each([
    ['image/jpeg', bytes(0xff, 0xd8, 0xff, 0xe0)],
    ['image/png', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)],
    ['image/webp', bytes(...text('RIFF'), 0, 0, 0, 0, ...text('WEBP'))],
    ['video/mp4', bytes(0, 0, 0, 0x20, ...text('ftypisom'))],
    ['video/webm', bytes(0x1a, 0x45, 0xdf, 0xa3)],
  ] as const)('recognises %s', (mimeType, head) => {
    expect(matchesMediaSignature(mimeType, head)).toBe(true)
  })

  it('rejects content that does not match the declared type', () => {
    expect(matchesMediaSignature('image/png', bytes(0xff, 0xd8, 0xff))).toBe(false)
    expect(matchesMediaSignature('video/mp4', bytes(...text('<html><body>')))).toBe(false)
    expect(matchesMediaSignature('image/jpeg', bytes())).toBe(false)
  })
})

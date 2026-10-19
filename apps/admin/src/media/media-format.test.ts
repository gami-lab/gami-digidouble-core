import { describe, expect, it } from 'vitest'
import { formatBytes, formatDuration, shortDescription } from './media-format'

describe('media formatting', () => {
  it('formats sizes and durations for the library', () => {
    expect(formatBytes(null)).toBe('—')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(65_400)).toBe('1:05')
    expect(shortDescription('abcdef', 4)).toBe('abc…')
  })
})

import { describe, expect, it } from 'vitest'
import { resolveMediaUrl } from './media-url'

describe('resolveMediaUrl', () => {
  it('resolves Core file routes against the API origin and keeps absolute URLs', () => {
    expect(resolveMediaUrl('/v1/media/media_1')).toBe('http://localhost:3000/v1/media/media_1')
    expect(resolveMediaUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png')
  })
})

import type { MediaMimeType } from '@gami/shared'

/** Bytes needed to recognise every allowed type. */
export const MEDIA_SIGNATURE_BYTES = 12

const SIGNATURES: Record<MediaMimeType, (head: Uint8Array) => boolean> = {
  'image/jpeg': (head) => startsWith(head, 0, [0xff, 0xd8, 0xff]),
  'image/png': (head) => startsWith(head, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  'image/webp': (head) => startsWith(head, 0, ascii('RIFF')) && startsWith(head, 8, ascii('WEBP')),
  'video/mp4': (head) => startsWith(head, 4, ascii('ftyp')),
  'video/webm': (head) => startsWith(head, 0, [0x1a, 0x45, 0xdf, 0xa3]),
}

/** Whether the first bytes of a file match its declared MIME type. */
export function matchesMediaSignature(mimeType: MediaMimeType, head: Uint8Array): boolean {
  return SIGNATURES[mimeType](head)
}

function startsWith(head: Uint8Array, offset: number, expected: readonly number[]): boolean {
  return expected.every((byte, index) => head[offset + index] === byte)
}

function ascii(text: string): number[] {
  return Array.from(new TextEncoder().encode(text))
}

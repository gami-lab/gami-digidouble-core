import type { Readable } from 'node:stream'

/** Inclusive byte range. */
export type ByteRange = { start: number; end: number }

/** Stores uploaded media files under Core-generated keys. */
export interface IMediaStorage {
  /** Writes `content` under `key`; on any failure nothing is left behind and the error is rethrown. */
  put(key: string, content: AsyncIterable<Uint8Array>): Promise<{ byteSize: number }>
  /** Size of the stored file, or `null` when it does not exist. */
  stat(key: string): Promise<{ byteSize: number } | null>
  /** Reads the whole file or one byte range; `null` when the file does not exist. */
  openRead(key: string, range?: ByteRange): Promise<Readable | null>
  delete(key: string): Promise<void>
}

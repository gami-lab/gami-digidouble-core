import { Readable } from 'node:stream'
import type { ByteRange, IMediaStorage } from '../../application/ports/IMediaStorage.js'

export class InMemoryMediaStorage implements IMediaStorage {
  private readonly files = new Map<string, Buffer>()

  async put(key: string, content: AsyncIterable<Uint8Array>): Promise<{ byteSize: number }> {
    const chunks: Buffer[] = []
    for await (const chunk of content) chunks.push(Buffer.from(chunk))
    const file = Buffer.concat(chunks)
    this.files.set(key, file)
    return { byteSize: file.byteLength }
  }

  stat(key: string): Promise<{ byteSize: number } | null> {
    const file = this.files.get(key)
    return Promise.resolve(file === undefined ? null : { byteSize: file.byteLength })
  }

  openRead(key: string, range?: ByteRange): Promise<Readable | null> {
    const file = this.files.get(key)
    if (file === undefined) return Promise.resolve(null)
    return Promise.resolve(
      Readable.from([range === undefined ? file : file.subarray(range.start, range.end + 1)]),
    )
  }

  delete(key: string): Promise<void> {
    this.files.delete(key)
    return Promise.resolve()
  }

  has(key: string): boolean {
    return this.files.has(key)
  }
}

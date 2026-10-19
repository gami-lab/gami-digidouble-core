import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ByteRange, IMediaStorage } from '../../application/ports/IMediaStorage.js'

const KEY_PATTERN = /^[A-Za-z0-9-]+$/

/** Files live flat under one directory (a Docker volume in deployment), named by their key. */
export class FilesystemMediaStorage implements IMediaStorage {
  constructor(private readonly rootDir: string) {}

  async put(key: string, content: AsyncIterable<Uint8Array>): Promise<{ byteSize: number }> {
    const target = this.pathFor(key)
    const temporary = join(this.rootDir, `.upload-${randomUUID()}`)
    await mkdir(this.rootDir, { recursive: true })
    let byteSize = 0
    try {
      await pipeline(
        Readable.from(content),
        async function* (source: AsyncIterable<Uint8Array>) {
          for await (const chunk of source) {
            byteSize += chunk.byteLength
            yield chunk
          }
        },
        createWriteStream(temporary, { flags: 'wx' }),
      )
      await rename(temporary, target)
      return { byteSize }
    } catch (error) {
      await rm(temporary, { force: true })
      throw error
    }
  }

  async stat(key: string): Promise<{ byteSize: number } | null> {
    try {
      const info = await stat(this.pathFor(key))
      return info.isFile() ? { byteSize: info.size } : null
    } catch (error) {
      if (isNotFound(error)) return null
      throw error
    }
  }

  async openRead(key: string, range?: ByteRange): Promise<Readable | null> {
    if ((await this.stat(key)) === null) return null
    return createReadStream(this.pathFor(key), range)
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true })
  }

  private pathFor(key: string): string {
    if (!KEY_PATTERN.test(key)) throw new Error('Invalid media storage key.')
    return join(this.rootDir, key)
  }
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

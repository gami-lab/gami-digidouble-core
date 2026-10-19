import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FilesystemMediaStorage } from './filesystem-media-storage.js'

async function readAll(stream: Readable | null): Promise<string> {
  if (stream === null) throw new Error('missing stream')
  const parts: Buffer[] = []
  for await (const chunk of stream) parts.push(Buffer.from(chunk as Uint8Array))
  return Buffer.concat(parts).toString()
}

describe('FilesystemMediaStorage', () => {
  let root: string
  let storage: FilesystemMediaStorage

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'gami-media-'))
    storage = new FilesystemMediaStorage(join(root, 'media'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('writes, stats, reads ranges, and deletes a file', async () => {
    const { byteSize } = await storage.put('file-1', Readable.from([Buffer.from('0123456789')]))

    expect(byteSize).toBe(10)
    await expect(storage.stat('file-1')).resolves.toEqual({ byteSize: 10 })
    expect(await readAll(await storage.openRead('file-1'))).toBe('0123456789')
    expect(await readAll(await storage.openRead('file-1', { start: 3, end: 5 }))).toBe('345')

    await storage.delete('file-1')
    await expect(storage.stat('file-1')).resolves.toBeNull()
    await expect(storage.openRead('file-1')).resolves.toBeNull()
  })

  it('leaves no file behind when the incoming stream fails', async () => {
    async function* failing(): AsyncGenerator<Uint8Array> {
      await Promise.resolve()
      yield Buffer.from('partial')
      throw new Error('client aborted')
    }

    await expect(storage.put('file-2', failing())).rejects.toThrow('client aborted')
    await expect(readdir(join(root, 'media'))).resolves.toEqual([])
  })

  it('refuses keys that could escape the directory', async () => {
    await expect(storage.stat('../etc/passwd')).rejects.toThrow('Invalid media storage key')
  })
})

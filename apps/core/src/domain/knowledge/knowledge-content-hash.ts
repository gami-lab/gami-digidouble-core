import crypto from 'node:crypto'

/** Stable identity for the final chunk text, including headers. */
export function hashKnowledgeChunkContent(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex')
}

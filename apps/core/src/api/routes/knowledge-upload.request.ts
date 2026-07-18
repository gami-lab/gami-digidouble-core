import type { UpdateKnowledgeSourceRequest } from '@gami/shared'
import { parseUploadedKnowledgeSourceContent } from '../../infrastructure/knowledge/uploaded-knowledge-source-content-parser.js'

// Max base64-encoded content size: ~14MB encodes to ~10MB of raw bytes.
const UPLOAD_MAX_BASE64_BYTES = 14 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['.txt', '.text', '.pdf'])

export type UploadedKnowledgeSource = {
  filename: string
  format: 'pdf' | 'text'
  text: string
}

export type UploadValidationResult<T> =
  | { success: true; value: T }
  | { success: false; message: string }

export async function validateUploadedKnowledgeSource(
  content: string,
  filename: string,
): Promise<UploadValidationResult<UploadedKnowledgeSource>> {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      success: false,
      message: `Unsupported file type "${ext}". Allowed: .txt, .text, .pdf`,
    }
  }

  if (content.length > UPLOAD_MAX_BASE64_BYTES) {
    return {
      success: false,
      message: 'File content exceeds maximum allowed size (10 MB).',
    }
  }

  const extractResult = await parseUploadedKnowledgeSourceContent(content, ext)
  if (extractResult.error !== null) {
    return { success: false, message: extractResult.error }
  }

  return {
    success: true,
    value: {
      filename,
      format: ext === '.pdf' ? 'pdf' : 'text',
      text: extractResult.text,
    },
  }
}

export async function buildUploadedKnowledgeSourceUpdate(input: {
  content: string | undefined
  filename: string | undefined
  metadata: Record<string, unknown> | undefined
  uriOrPath: string | undefined
}): Promise<
  UploadValidationResult<{ metadata: Record<string, unknown>; uriOrPath: string } | null>
> {
  const hasContent = input.content !== undefined || input.filename !== undefined
  if (!hasContent) {
    return { success: true, value: null }
  }

  if (input.content === undefined || input.filename === undefined) {
    return {
      success: false,
      message: 'content and filename must be provided together.',
    }
  }

  if (input.metadata !== undefined || input.uriOrPath !== undefined) {
    return {
      success: false,
      message: 'Use either metadata/uriOrPath updates or content/filename replacement, not both.',
    }
  }

  const uploaded = await validateUploadedKnowledgeSource(input.content, input.filename)
  if (!uploaded.success) return uploaded

  return {
    success: true,
    value: {
      metadata: { inlineText: uploaded.value.text },
      uriOrPath: uploaded.value.filename,
    },
  }
}

export function toKnowledgeSourceUpdateInput(
  sourceId: string,
  body: UpdateKnowledgeSourceRequest,
  uploadedUpdate: { metadata: Record<string, unknown>; uriOrPath: string } | null,
): UpdateKnowledgeSourceRequest & { sourceId: string } {
  return {
    sourceId,
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(uploadedUpdate?.metadata !== undefined
      ? { metadata: uploadedUpdate.metadata }
      : body.metadata !== undefined
        ? { metadata: body.metadata }
        : {}),
    ...(body.visibilityPolicy !== undefined ? { visibilityPolicy: body.visibilityPolicy } : {}),
    ...(body.visibleToAvatarIds !== undefined
      ? { visibleToAvatarIds: body.visibleToAvatarIds }
      : {}),
    ...(uploadedUpdate?.uriOrPath !== undefined
      ? { uriOrPath: uploadedUpdate.uriOrPath }
      : body.uriOrPath !== undefined
        ? { uriOrPath: body.uriOrPath }
        : {}),
  }
}

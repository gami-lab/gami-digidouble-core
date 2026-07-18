import pdfParse from 'pdf-parse'

export type ParseUploadedKnowledgeSourceContentResult =
  | { text: string; error: null }
  | { text: ''; error: string }

export async function parseUploadedKnowledgeSourceContent(
  content: string,
  ext: string,
): Promise<ParseUploadedKnowledgeSourceContentResult> {
  let rawBuffer: Buffer
  try {
    rawBuffer = Buffer.from(content, 'base64')
  } catch {
    return { text: '', error: 'content must be valid base64.' }
  }

  let inlineText: string
  if (ext === '.pdf') {
    try {
      const parsed = await pdfParse(rawBuffer)
      inlineText = parsed.text.trim()
    } catch {
      return { text: '', error: 'Failed to parse PDF file.' }
    }
  } else {
    inlineText = rawBuffer.toString('utf8').trim()
  }

  if (inlineText.length === 0) {
    return { text: '', error: 'Uploaded file contains no extractable text content.' }
  }

  return { text: inlineText, error: null }
}

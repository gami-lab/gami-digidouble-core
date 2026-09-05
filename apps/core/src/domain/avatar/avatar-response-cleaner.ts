/**
 * Removes presentation-only stage directions and speaker labels from Avatar output.
 *
 * A marker must begin a new line (ignoring indentation). Content after the closing
 * marker is preserved so labels such as `**Max:** Hello` become `Hello`.
 */
export function cleanAvatarResponse(content: string): string {
  const lines = content.replace(/\r\n?/g, '\n').split('\n')
  const cleanedLines: string[] = []

  for (let lineIndex = 0; lineIndex < lines.length;) {
    const line = lines[lineIndex] ?? ''
    const markerMatch = line.match(/^[ \t]*(\*{1,2})/)
    const marker = markerMatch?.[1]
    if (markerMatch === null || marker === undefined) {
      cleanedLines.push(line)
      lineIndex += 1
      continue
    }

    const closing = findClosingMarker(lines, lineIndex, marker, markerMatch[0].length)
    if (closing === null) {
      // An unfinished marker is treated as presentation text and removed to keep
      // streamed output from exposing a partial stage direction.
      break
    }

    const remainder = (lines[closing.lineIndex] ?? '').slice(closing.index + marker.length)
    if (remainder.trim().length > 0) cleanedLines.push(remainder.trimStart())
    lineIndex = closing.lineIndex + 1
  }

  return cleanedLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+|\n+$/g, '')
}

function findClosingMarker(
  lines: string[],
  startLineIndex: number,
  marker: string,
  startIndex: number,
): { lineIndex: number; index: number } | null {
  for (let lineIndex = startLineIndex; lineIndex < lines.length; lineIndex += 1) {
    const index = (lines[lineIndex] ?? '').indexOf(
      marker,
      lineIndex === startLineIndex ? startIndex : 0,
    )
    if (index >= 0) return { lineIndex, index }
  }
  return null
}

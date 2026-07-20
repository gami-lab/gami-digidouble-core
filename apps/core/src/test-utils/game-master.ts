export function readRenderedGameMasterPrompt(
  request: { messages: Array<{ content: string }> } | undefined,
): string {
  return request?.messages[0]?.content ?? ''
}

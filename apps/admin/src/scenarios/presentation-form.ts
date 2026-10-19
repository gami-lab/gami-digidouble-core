import type { AvatarPresentation, ScenarioPresentation } from '@gami/shared'

/** Trims authored text and drops blank fields; `null` means "no presentation" (clears on update). */
export function toScenarioPresentationPayload(
  value: ScenarioPresentation,
): ScenarioPresentation | null {
  const prompt = value.entryQuestion?.prompt.trim() ?? ''
  return nonEmpty({
    ...text('cover', value.cover),
    ...text('tagline', value.tagline),
    ...text('introText', value.introText),
    ...(value.entryQuestion !== undefined && prompt.length > 0
      ? { entryQuestion: { prompt, personaField: value.entryQuestion.personaField } }
      : {}),
    ...text('outroText', value.outroText),
  })
}

export function toAvatarPresentationPayload(value: AvatarPresentation): AvatarPresentation | null {
  const starterQuestions = (value.starterQuestions ?? [])
    .map((question) => question.trim())
    .filter((question) => question.length > 0)
  return nonEmpty({
    ...text('portrait', value.portrait),
    ...text('hook', value.hook),
    ...(starterQuestions.length > 0 ? { starterQuestions } : {}),
  })
}

export function moveItem<T>(items: readonly T[], index: number, offset: -1 | 1): T[] {
  const target = index + offset
  if (target < 0 || target >= items.length) return [...items]
  const next = [...items]
  const [item] = next.splice(index, 1)
  if (item !== undefined) next.splice(target, 0, item)
  return next
}

function text<K extends string>(key: K, value: string | undefined): Partial<Record<K, string>> {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? ({ [key]: trimmed } as Record<K, string>) : {}
}

function nonEmpty<T extends object>(value: T): T | null {
  return Object.keys(value).length > 0 ? value : null
}

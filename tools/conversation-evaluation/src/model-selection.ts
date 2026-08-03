import { isModelSelectionProviderName, type ModelSelectionOverride } from '@gami/shared'

const FAST_SUFFIX = '-fast'

export function parseDeclaredModel(declaredModel: string): ModelSelectionOverride {
  const separatorIndex = declaredModel.indexOf('/')
  if (separatorIndex <= 0 || separatorIndex === declaredModel.length - 1) {
    throw new Error('Avatar model must use provider/model notation for request-level selection.')
  }

  const provider = declaredModel.slice(0, separatorIndex)
  if (!isModelSelectionProviderName(provider)) {
    throw new Error('Avatar model provider is not supported for request-level selection.')
  }

  const declaredName = declaredModel.slice(separatorIndex + 1)
  const fast = provider === 'openai' && declaredName.endsWith(FAST_SUFFIX)
  const model = fast ? declaredName.slice(0, -FAST_SUFFIX.length) : declaredName
  if (model.length === 0) throw new Error('Fast model selector must include a base model name.')

  return {
    provider,
    model,
    ...(fast ? { serviceTier: 'fast' as const } : {}),
  }
}

export function parseJudgeModel(declaredModel: string): ModelSelectionOverride {
  const separatorIndex = declaredModel.indexOf('/')
  if (separatorIndex <= 0 || separatorIndex === declaredModel.length - 1) {
    const fast = declaredModel.startsWith('gpt-') && declaredModel.endsWith(FAST_SUFFIX)
    const model = fast ? declaredModel.slice(0, -FAST_SUFFIX.length) : declaredModel
    return {
      model,
      ...(fast ? { serviceTier: 'fast' as const } : {}),
    }
  }
  const provider = declaredModel.slice(0, separatorIndex)
  if (!isModelSelectionProviderName(provider)) return { model: declaredModel }
  return parseDeclaredModel(declaredModel)
}

export function baseDeclaredModel(declaredModel: string): string {
  const separatorIndex = declaredModel.indexOf('/')
  if (separatorIndex <= 0 || separatorIndex === declaredModel.length - 1) {
    return declaredModel.startsWith('gpt-') && declaredModel.endsWith(FAST_SUFFIX)
      ? declaredModel.slice(0, -FAST_SUFFIX.length)
      : declaredModel
  }
  const provider = declaredModel.slice(0, separatorIndex)
  const model = declaredModel.slice(separatorIndex + 1)
  return provider === 'openai' && model.endsWith(FAST_SUFFIX)
    ? `${provider}/${model.slice(0, -FAST_SUFFIX.length)}`
    : declaredModel
}

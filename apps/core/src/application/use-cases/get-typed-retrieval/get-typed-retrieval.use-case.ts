import { DomainError } from '../../../domain/errors.js'
import { TypedRetrievalService } from '../../services/knowledge/typed-retrieval.service.js'
import type {
  GetTypedRetrievalInput,
  GetTypedRetrievalOutput,
} from './get-typed-retrieval.types.js'

export class GetTypedRetrievalUseCase {
  constructor(private readonly retrievalService: TypedRetrievalService) {}

  async execute(input: GetTypedRetrievalInput): Promise<GetTypedRetrievalOutput> {
    const scenarioId = input.scenarioId.trim()
    const query = input.query.trim()

    if (scenarioId.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'scenarioId must be a non-empty string.')
    }
    if (query.length === 0) {
      throw new DomainError('VALIDATION_ERROR', 'query must be a non-empty string.')
    }

    const retrieval = await this.retrievalService.retrieve({
      scenarioId,
      query,
      ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
      ...(input.userId !== undefined ? { userId: input.userId } : {}),
      ...(input.conversationId !== undefined ? { conversationId: input.conversationId } : {}),
      ...(input.limitPerType !== undefined ? { limitPerType: input.limitPerType } : {}),
    })

    return { retrieval }
  }
}

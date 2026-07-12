import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type { DeleteSessionInput, DeleteSessionOutput } from './delete-session.types.js'

export class DeleteSessionUseCase {
  constructor(private readonly sessionRepository: ISessionRepository) {}

  async execute(input: DeleteSessionInput): Promise<DeleteSessionOutput> {
    const session = await this.sessionRepository.findById(input.sessionId)
    if (session === null) {
      throw new DomainError('NOT_FOUND', `Session ${input.sessionId} was not found.`)
    }

    await this.sessionRepository.delete(input.sessionId)
    return { sessionId: input.sessionId, deleted: true }
  }
}

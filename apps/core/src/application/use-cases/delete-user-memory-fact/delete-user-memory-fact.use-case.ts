import type { IUserMemoryFactRepository } from '../../ports/IUserMemoryFactRepository.js'
import { DomainError } from '../../../domain/errors.js'
import type {
  DeleteUserMemoryFactInput,
  DeleteUserMemoryFactOutput,
} from './delete-user-memory-fact.types.js'

export class DeleteUserMemoryFactUseCase {
  constructor(private readonly userMemoryFactRepository: IUserMemoryFactRepository) {}

  async execute(input: DeleteUserMemoryFactInput): Promise<DeleteUserMemoryFactOutput> {
    const fact = await this.userMemoryFactRepository.findById(input.factId)
    if (fact === null || fact.userId !== input.userId) {
      throw new DomainError(
        'NOT_FOUND',
        `User memory fact ${input.factId} was not found for user ${input.userId}.`,
      )
    }

    await this.userMemoryFactRepository.deleteById(input.factId)
    return { factId: input.factId, deleted: true }
  }
}

import type { IUserMemoryFactRepository } from '../../ports/IUserMemoryFactRepository.js'
import type {
  ListUserMemoryFactsInput,
  ListUserMemoryFactsOutput,
} from './list-user-memory-facts.types.js'

export class ListUserMemoryFactsUseCase {
  constructor(private readonly userMemoryFactRepository: IUserMemoryFactRepository) {}

  async execute(input: ListUserMemoryFactsInput): Promise<ListUserMemoryFactsOutput> {
    const facts = await this.userMemoryFactRepository.findByUserId(input.userId)
    return { facts }
  }
}

import type { IUserRepository } from '../../ports/IUserRepository.js'
import type { User, UserPersona } from '../../../domain/user/user.types.js'

export type UpsertUserPersonaInput = {
  userId: string
  persona: UserPersona
}

export type UpsertUserPersonaOutput = {
  user: User
}

export class UpsertUserPersonaUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: UpsertUserPersonaInput): Promise<UpsertUserPersonaOutput> {
    const userId = input.userId.trim()
    if (userId.length === 0) {
      throw new Error('userId must be a non-empty string.')
    }

    const user = await this.userRepository.upsert(userId, input.persona)
    return { user }
  }
}

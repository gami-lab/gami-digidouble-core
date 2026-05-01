import type { IUserRepository } from '../../ports/IUserRepository.js'
import type { UserPersona } from '../../../domain/user/user.types.js'

export type GetUserPersonaInput = {
  userId: string
}

export type GetUserPersonaOutput = {
  persona: UserPersona | null
}

export class GetUserPersonaUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(input: GetUserPersonaInput): Promise<GetUserPersonaOutput> {
    const user = await this.userRepository.findById(input.userId)
    return { persona: user?.persona ?? null }
  }
}

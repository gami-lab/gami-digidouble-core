import type { User, UserPersona } from '../../domain/user/user.types.js'

export interface IUserRepository {
  findById(userId: string): Promise<User | null>
  upsert(userId: string, persona: UserPersona): Promise<User>
}

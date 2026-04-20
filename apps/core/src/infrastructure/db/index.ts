/**
 * PostgreSQL + pgvector repositories are introduced in EPIC 2.3.
 * Prompt 04 exports the first concrete Postgres repository adapters here.
 *
 * All exports from this module will implement the port interfaces
 * defined in application/ports/.
 */
export { closeDbClient, getDbClient } from './client.js'
export { InMemoryAvatarRepository } from './in-memory-avatar.repository.js'
export { InMemorySessionRepository } from './in-memory-session.repository.js'
export { InMemoryMessageRepository } from './in-memory-message.repository.js'

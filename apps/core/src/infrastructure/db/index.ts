// DB adapters — infrastructure layer
// In-memory stubs are used in unit tests (injected via ServerAdapters).
// Postgres repositories are wired in production via apps/core/src/index.ts.
export { InMemoryAvatarRepository } from './in-memory-avatar.repository.js'
export { InMemorySessionRepository } from './in-memory-session.repository.js'
export { InMemoryMessageRepository } from './in-memory-message.repository.js'
export { InMemoryScenarioRepository } from './in-memory-scenario.repository.js'
export { PostgresScenarioRepository } from './repositories/postgres-scenario.repository.js'
export { PostgresAvatarRepository } from './repositories/postgres-avatar.repository.js'
export { PostgresSessionRepository } from './repositories/postgres-session.repository.js'
export { PostgresConversationRepository } from './repositories/postgres-conversation.repository.js'
export { PostgresMessageRepository } from './repositories/postgres-message.repository.js'
export { InMemoryConversationRepository } from './in-memory-conversation.repository.js'
export { getDbClient, closeDbClient } from './client.js'

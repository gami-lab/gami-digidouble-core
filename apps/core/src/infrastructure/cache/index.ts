import { Redis } from 'ioredis'

let client: Redis | null = null
let clientUrl: string | null = null

export function getRedisClient(url: string): Redis {
  if (client && clientUrl !== url) {
    throw new Error(
      'Redis client already initialized with a different URL. Restart the application to change REDIS_URL.',
    )
  }

  if (!client) {
    client = new Redis(url)
    clientUrl = url
  }

  return client
}

export async function closeRedisClient(): Promise<void> {
  if (!client) {
    return
  }

  await client.quit()
  client = null
  clientUrl = null
}

import type { ApiResponse, PrepareAvatarTraitsResponse } from '@gami/shared'

function assertPreparedAvatar(
  body: ApiResponse<PrepareAvatarTraitsResponse>,
  avatarId: string,
): void {
  const result = body.data?.results.find((item) => item.avatarId === avatarId)
  if (result?.status !== 'prepared') {
    throw new Error(
      `Avatar trait preparation failed for ${avatarId}: ${result?.reason ?? 'missing result'}`,
    )
  }
}

export async function prepareAndActivateAvatar(args: {
  appUrl: string
  apiKey: string
  scenarioId: string
  avatarId: string
}): Promise<void> {
  const prepareResponse = await fetch(
    `${args.appUrl}/v1/scenarios/${args.scenarioId}/prepare-avatar-traits`,
    {
      method: 'POST',
      headers: { 'x-api-key': args.apiKey },
    },
  )
  const prepareBody = (await prepareResponse.json()) as ApiResponse<PrepareAvatarTraitsResponse>
  if (prepareResponse.status !== 200) {
    throw new Error(
      `Avatar trait preparation failed with HTTP ${String(prepareResponse.status)}: ${prepareBody.error?.message ?? 'unknown error'}`,
    )
  }

  assertPreparedAvatar(prepareBody, args.avatarId)

  const activateResponse = await fetch(`${args.appUrl}/v1/avatars/${args.avatarId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-api-key': args.apiKey,
    },
    body: JSON.stringify({ status: 'active' }),
  })
  if (activateResponse.status !== 200) {
    const activateBody = (await activateResponse.json()) as ApiResponse<null>
    throw new Error(
      `Avatar activation failed with HTTP ${String(activateResponse.status)}: ${activateBody.error?.message ?? 'unknown error'}`,
    )
  }
}

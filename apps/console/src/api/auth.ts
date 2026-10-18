import type { AdminLoginResponse, AdminLogoutResponse, AdminMeResponse } from '@gami/shared'
import { ApiError, coreRequest, notifySignedOut } from './client'

/** Resolves the current admin identity, or `null` when nobody is signed in. */
export async function getAdminIdentity(): Promise<AdminMeResponse | null> {
  try {
    return await coreRequest<AdminMeResponse>('GET', '/v1/admin/auth/me')
  } catch (error) {
    if (error instanceof ApiError && error.code === 'UNAUTHORIZED') return null
    throw error
  }
}

export async function signIn(password: string): Promise<AdminLoginResponse> {
  return coreRequest<AdminLoginResponse>('POST', '/v1/admin/auth/login', { password })
}

export async function signOut(): Promise<void> {
  try {
    await coreRequest<AdminLogoutResponse>('POST', '/v1/admin/auth/logout')
  } finally {
    notifySignedOut()
  }
}

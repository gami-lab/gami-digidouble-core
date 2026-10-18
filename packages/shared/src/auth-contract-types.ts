/** Header carrying the server-side admin service key (tools only; never a browser bundle). */
export const ADMIN_SERVICE_KEY_HEADER = 'x-admin-service-key'

export type AdminLoginRequest = {
  password: string
}

export type AdminLoginResponse = {
  expiresAt: string
}

export type AdminAuthenticationMethod = 'session' | 'service_key'

export type AdminMeResponse = {
  authenticatedBy: AdminAuthenticationMethod
}

export type AdminLogoutResponse = {
  signedOut: true
}

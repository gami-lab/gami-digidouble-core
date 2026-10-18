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

/** Core-issued player identity; `token` is sent as `Authorization: Bearer <token>`. */
export type PlayerTokenResponse = {
  userId: string
  token: string
  expiresAt: string
}

/** Operator request for a token acting as an existing player (console, evaluation tool). */
export type IssuePlayerTokenRequest = {
  userId: string
}

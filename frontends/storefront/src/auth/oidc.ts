type OidcConfig = {
  issuer: string
  oidcEndpoint: string
  storefrontClientId: string
}

export type AuthSession = {
  accessToken: string
  idToken?: string
  expiresAt: number
  refreshToken?: string
  profile: {
    name?: string
    email?: string
    roles: string[]
  }
}

const SESSION_KEY = 'sample-ec.storefront.session'
const TRANSACTION_KEY = 'sample-ec.storefront.transaction'

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

async function sha256(value: string) {
  return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
}

function random() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64Url(bytes)
}

async function config(): Promise<OidcConfig> {
  const response = await fetch('/zitadel/sample-ec-oidc.json', { cache: 'no-store' })
  if (!response.ok) throw new Error('OIDC configuration is unavailable. Start Docker Compose first.')
  return response.json()
}

export function readSession(): AuthSession | null {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as AuthSession
    return session.expiresAt > Date.now() ? session : null
  } catch {
    return null
  }
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

export async function beginLogin(returnTo: string) {
  const oidc = await config()
  const verifier = random()
  const state = random()
  sessionStorage.setItem(TRANSACTION_KEY, JSON.stringify({ verifier, state, returnTo }))
  const url = new URL('/oauth/v2/authorize', oidc.oidcEndpoint)
  url.search = new URLSearchParams({
    client_id: oidc.storefrontClientId,
    response_type: 'code',
    redirect_uri: `${window.location.origin}/auth/callback`,
    scope: 'openid profile email offline_access',
    code_challenge: await sha256(verifier),
    code_challenge_method: 'S256',
    state,
  }).toString()
  window.location.assign(url)
}

export async function completeLogin(): Promise<string> {
  const transaction = JSON.parse(sessionStorage.getItem(TRANSACTION_KEY) ?? '{}') as { verifier?: string; state?: string; returnTo?: string }
  const params = new URLSearchParams(window.location.search)
  if (!transaction.verifier || !transaction.state || transaction.state !== params.get('state') || !params.get('code')) {
    throw new Error('ログインの検証に失敗しました。もう一度お試しください。')
  }
  const oidc = await config()
  const response = await fetch(new URL('/oauth/v2/token', oidc.oidcEndpoint), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code: params.get('code')!, client_id: oidc.storefrontClientId,
      redirect_uri: `${window.location.origin}/auth/callback`, code_verifier: transaction.verifier,
    }),
  })
  if (!response.ok) throw new Error('ログイン処理に失敗しました。')
  const token = await response.json() as { access_token: string; id_token?: string; refresh_token?: string; expires_in: number }
  const claims = JSON.parse(atob(token.id_token?.split('.')[1]?.replaceAll('-', '+').replaceAll('_', '/') ?? 'e30=')) as Record<string, unknown>
  const roles = Object.values(claims).find((value) => typeof value === 'object' && value !== null && 'customer' in value) as Record<string, unknown> | undefined
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken: token.access_token, idToken: token.id_token, refreshToken: token.refresh_token, expiresAt: Date.now() + token.expires_in * 1000, profile: { name: typeof claims.name === 'string' ? claims.name : undefined, email: typeof claims.email === 'string' ? claims.email : undefined, roles: Object.keys(roles ?? {}) } } satisfies AuthSession))
  sessionStorage.removeItem(TRANSACTION_KEY)
  return transaction.returnTo || '/'
}

export async function refreshSession(): Promise<AuthSession | null> {
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  const current = JSON.parse(raw) as AuthSession
  if (!current.refreshToken || current.expiresAt - Date.now() > 60_000) return readSession()
  const oidc = await config()
  const response = await fetch(new URL('/oauth/v2/token', oidc.oidcEndpoint), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: current.refreshToken, client_id: oidc.storefrontClientId }) })
  if (!response.ok) { clearSession(); return null }
  const token = await response.json() as { access_token: string; expires_in: number; refresh_token?: string }
  const next = { ...current, accessToken: token.access_token, refreshToken: token.refresh_token ?? current.refreshToken, expiresAt: Date.now() + token.expires_in * 1000 }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(next))
  return next
}

export async function logout() {
  const session = readSession()
  clearSession()
  const oidc = await config()
  const url = new URL('/oidc/v1/end_session', oidc.oidcEndpoint)
  url.searchParams.set('post_logout_redirect_uri', `${window.location.origin}/`)
  if (session?.idToken) url.searchParams.set('id_token_hint', session.idToken)
  window.location.assign(url)
}

export function authorizationHeader(): Record<string, string> {
  const session = readSession()
  return session ? { Authorization: `Bearer ${session.accessToken}` } : {}
}

export type Session = { accessToken: string; idToken?: string; refreshToken?: string; expiresAt: number; roles: string[]; name?: string; email?: string }
const KEY = 'sample-ec.admin.session'
const TX = 'sample-ec.admin.transaction'
type Config = { oidcEndpoint: string; adminClientId: string; projectId: string }
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
const random = () => { const bytes = new Uint8Array(32); crypto.getRandomValues(bytes); return b64(bytes) }
const config = async (): Promise<Config> => {
  const response = await fetch('/zitadel/sample-ec-oidc.json', { cache: 'no-store' })
  if (!response.ok) throw new Error('OIDC configuration is unavailable')
  return response.json()
}
export const session = (): Session | null => { try { const value = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Session | null; return value && value.expiresAt > Date.now() ? value : null } catch { return null } }
export const header = (): Record<string, string> => { const current = session(); return current ? { Authorization: `Bearer ${current.accessToken}` } : {} }
export const clear = () => sessionStorage.removeItem(KEY)
export async function login(returnTo: string) {
  const oidc = await config(); const verifier = random(); const state = random()
  sessionStorage.setItem(TX, JSON.stringify({ verifier, state, returnTo }))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const url = new URL('/oauth/v2/authorize', oidc.oidcEndpoint)
  url.search = new URLSearchParams({ client_id: oidc.adminClientId, response_type: 'code', redirect_uri: `${location.origin}/auth/callback`, scope: 'openid profile email offline_access', code_challenge: b64(new Uint8Array(digest)), code_challenge_method: 'S256', state }).toString()
  location.assign(url)
}
export async function callback() {
  const tx = JSON.parse(sessionStorage.getItem(TX) ?? '{}') as { verifier?: string; state?: string; returnTo?: string }
  const params = new URLSearchParams(location.search)
  if (!tx.verifier || tx.state !== params.get('state') || !params.get('code')) throw new Error('ログインの検証に失敗しました')
  const oidc = await config()
  const response = await fetch(new URL('/oauth/v2/token', oidc.oidcEndpoint), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code: params.get('code')!, client_id: oidc.adminClientId, redirect_uri: `${location.origin}/auth/callback`, code_verifier: tx.verifier }) })
  if (!response.ok) throw new Error('ログイン処理に失敗しました')
  const token = await response.json() as { access_token: string; id_token?: string; refresh_token?: string; expires_in: number }
  const claims = JSON.parse(atob(token.id_token?.split('.')[1]?.replaceAll('-', '+').replaceAll('_', '/') ?? 'e30=')) as Record<string, unknown>
  const roleClaim = claims[`urn:zitadel:iam:org:project:${oidc.projectId}:roles`] as Record<string, unknown> | undefined
  sessionStorage.setItem(KEY, JSON.stringify({ accessToken: token.access_token, idToken: token.id_token, refreshToken: token.refresh_token, expiresAt: Date.now() + token.expires_in * 1000, roles: Object.keys(roleClaim ?? {}), name: typeof claims.name === 'string' ? claims.name : undefined, email: typeof claims.email === 'string' ? claims.email : undefined } satisfies Session))
  return tx.returnTo || '/'
}
export async function logout() { const current = session(); clear(); const oidc = await config(); const url = new URL('/oidc/v1/end_session', oidc.oidcEndpoint); url.searchParams.set('post_logout_redirect_uri', `${location.origin}/`); if (current?.idToken) url.searchParams.set('id_token_hint', current.idToken); location.assign(url) }
export async function refresh(): Promise<Session | null> { const raw = sessionStorage.getItem(KEY); if (!raw) return null; const current = JSON.parse(raw) as Session; if (!current.refreshToken || current.expiresAt - Date.now() > 60_000) return session(); const oidc = await config(); const response = await fetch(new URL('/oauth/v2/token', oidc.oidcEndpoint), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: current.refreshToken, client_id: oidc.adminClientId }) }); if (!response.ok) { clear(); return null }; const token = await response.json() as { access_token: string; refresh_token?: string; expires_in: number }; const next = { ...current, accessToken: token.access_token, refreshToken: token.refresh_token ?? current.refreshToken, expiresAt: Date.now() + token.expires_in * 1000 }; sessionStorage.setItem(KEY, JSON.stringify(next)); return next }

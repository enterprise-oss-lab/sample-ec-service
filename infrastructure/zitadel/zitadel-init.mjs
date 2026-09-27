import { readFile, writeFile } from 'node:fs/promises'
import http from 'node:http'
import { join } from 'node:path'

const baseUrl = process.env.ZITADEL_URL
const token = (await readFile(process.env.ZITADEL_PAT_FILE, 'utf8')).trim()
const bootstrapDir = process.env.ZITADEL_BOOTSTRAP_DIR

if (!baseUrl || !token || !bootstrapDir) {
  throw new Error('ZITADEL_URL, ZITADEL_PAT_FILE, and ZITADEL_BOOTSTRAP_DIR are required')
}

async function api(path, { method = 'GET', body, allowNotFound = false } = {}) {
  const url = new URL(path, baseUrl)
  const payload = body ? JSON.stringify(body) : undefined
  // fetch intentionally controls Host. Use http.request so ZITADEL receives
  // the external hostname configured for this local instance, even though the
  // initializer connects through Docker's internal DNS.
  const { statusCode, text } = await new Promise((resolve, reject) => {
    const request = http.request(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Host: 'localhost',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, (response) => {
      let result = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { result += chunk })
      response.on('end', () => resolve({ statusCode: response.statusCode, text: result }))
    })
    request.on('error', reject)
    if (payload) request.write(payload)
    request.end()
  })

  if (allowNotFound && statusCode === 404) return undefined
  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`${method} ${path} failed (${statusCode}): ${text}`)
  }
  return text ? JSON.parse(text) : undefined
}

async function findOne(path, query) {
  const response = await api(path, { method: 'POST', body: { queries: [query] } })
  return response.result?.[0]
}

async function ensureProject() {
  const existing = await findOne('/management/v1/projects/_search', {
    nameQuery: { name: 'Sample EC', method: 'TEXT_QUERY_METHOD_EQUALS' },
  })
  if (existing) return existing
  return api('/management/v1/projects', {
    method: 'POST',
    body: {
      name: 'Sample EC',
      projectRoleAssertion: true,
      projectRoleCheck: true,
      hasProjectCheck: true,
    },
  })
}

async function ensureRole(projectId, key, displayName) {
  const existing = await findOne(`/management/v1/projects/${projectId}/roles/_search`, {
    keyQuery: { key, method: 'TEXT_QUERY_METHOD_EQUALS' },
  })
  if (existing) return existing
  return api(`/management/v1/projects/${projectId}/roles`, {
    method: 'POST',
    body: { roleKey: key, displayName, group: 'Sample EC' },
  })
}

async function ensureSpa(projectId, name, redirectUri, postLogoutRedirectUri) {
  const existing = await findOne(`/management/v1/projects/${projectId}/apps/_search`, {
    nameQuery: { name, method: 'TEXT_QUERY_METHOD_EQUALS' },
  })
  if (existing) return { clientId: existing.clientId ?? existing.id }
  const created = await api(`/management/v1/projects/${projectId}/apps/oidc`, {
    method: 'POST',
    body: {
      name,
      redirectUris: [redirectUri],
      postLogoutRedirectUris: [postLogoutRedirectUri],
      responseTypes: ['OIDC_RESPONSE_TYPE_CODE'],
      grantTypes: ['OIDC_GRANT_TYPE_AUTHORIZATION_CODE', 'OIDC_GRANT_TYPE_REFRESH_TOKEN'],
      appType: 'OIDC_APP_TYPE_USER_AGENT',
      authMethodType: 'OIDC_AUTH_METHOD_TYPE_NONE',
      version: 'OIDC_VERSION_1_0',
      accessTokenType: 'OIDC_TOKEN_TYPE_JWT',
      idTokenRoleAssertion: true,
      devMode: true,
    },
  })
  return { clientId: created.clientId ?? created.appId }
}

async function ensureHuman({ username, email, password, firstName, lastName }) {
  const existing = await findOne('/management/v1/users/_search', {
    userNameQuery: { userName: username, method: 'TEXT_QUERY_METHOD_EQUALS' },
  })
  if (existing) return { userId: existing.userId ?? existing.id }
  const created = await api('/management/v1/users/human', {
    method: 'POST',
    body: {
      userName: username,
      profile: { firstName, lastName, displayName: `${firstName} ${lastName}`, preferredLanguage: 'ja' },
      email: { email, isEmailVerified: true },
      password: { password, changeRequired: false },
    },
  })
  return { userId: created.userId ?? created.id }
}

async function ensureGrant(userId, projectId, roleKey) {
  const grants = await api('/management/v1/users/grants/_search', {
    method: 'POST',
    body: { queries: [{ userIdQuery: { userId } }] },
  })
  const existing = grants.result?.find((grant) => grant.projectId === projectId && grant.roleKeys?.includes(roleKey))
  if (existing) return existing
  return api(`/management/v1/users/${userId}/grants`, {
    method: 'POST',
    body: { projectId, roleKeys: [roleKey] },
  })
}

async function ensureK6Machine(projectId) {
  const username = 'k6-load-test'
  const existing = await findOne('/management/v1/users/_search', {
    userNameQuery: { userName: username, method: 'TEXT_QUERY_METHOD_EQUALS' },
  })
  const machine = existing ? { userId: existing.userId ?? existing.id } : await api('/management/v1/users/machine', {
    method: 'POST',
    body: {
      userName: username,
      name: 'k6 load test service account',
      description: 'Local development k6 client-credentials account',
      accessTokenType: 'ACCESS_TOKEN_TYPE_JWT',
    },
  })
  await ensureGrant(machine.userId, projectId, 'admin')

  // A machine user's id is its OAuth client_id.  Set the supplied secret on
  // every run; this is deliberate so changing .env rotates it predictably.
  const secret = await api(`/management/v1/users/${machine.userId}/secret`, {
    method: 'PUT',
    body: { secret: process.env.ZITADEL_K6_CLIENT_SECRET },
  })
  return { ...machine, clientId: secret.clientId ?? machine.userId }
}

async function disableRegistration() {
  const current = await api('/management/v1/policies/login')
  const policy = current.policy
  if (!policy.allowRegister) return
  await api('/management/v1/policies/login', {
    // The first-instance policy is inherited from the default organisation.
    // Create a local override once, then update that override on later runs.
    method: current.isDefault ? 'POST' : 'PUT',
    body: {
      allowUsernamePassword: policy.allowUsernamePassword,
      allowRegister: false,
      allowExternalIdp: policy.allowExternalIdp,
      passwordlessType: policy.passwordlessType,
      allowDomainDiscovery: policy.allowDomainDiscovery,
    },
  })
}

await disableRegistration()
const project = await ensureProject()
const projectId = project.id
await ensureRole(projectId, 'customer', 'Customer')
await ensureRole(projectId, 'admin', 'Administrator')

const storefront = await ensureSpa(projectId, 'Storefront', process.env.ZITADEL_STOREFRONT_REDIRECT_URI, process.env.ZITADEL_STOREFRONT_LOGOUT_URI)
const admin = await ensureSpa(projectId, 'Admin', process.env.ZITADEL_ADMIN_REDIRECT_URI, process.env.ZITADEL_ADMIN_LOGOUT_URI)

const users = [
  { username: process.env.ZITADEL_CUSTOMER_1_USERNAME, email: process.env.ZITADEL_CUSTOMER_1_EMAIL, password: process.env.ZITADEL_CUSTOMER_1_PASSWORD, firstName: 'Customer', lastName: 'One', role: 'customer' },
  { username: process.env.ZITADEL_CUSTOMER_2_USERNAME, email: process.env.ZITADEL_CUSTOMER_2_EMAIL, password: process.env.ZITADEL_CUSTOMER_2_PASSWORD, firstName: 'Customer', lastName: 'Two', role: 'customer' },
  { username: process.env.ZITADEL_ADMIN_USERNAME, email: process.env.ZITADEL_ADMIN_EMAIL, password: process.env.ZITADEL_ADMIN_PASSWORD, firstName: 'EC', lastName: 'Administrator', role: 'admin' },
]
for (const user of users) {
  const created = await ensureHuman(user)
  await ensureGrant(created.userId, projectId, user.role)
}
const k6 = await ensureK6Machine(projectId)

await writeFile(join(bootstrapDir, 'sample-ec-oidc.json'), `${JSON.stringify({
  issuer: 'http://localhost:8080',
  projectId,
  storefrontClientId: storefront.clientId,
  adminClientId: admin.clientId,
  k6ClientId: k6.clientId,
}, null, 2)}\n`, { mode: 0o600 })

console.log('ZITADEL Sample EC bootstrap completed')

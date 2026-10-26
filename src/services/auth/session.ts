import { runtimePolicy } from '../../app/config/runtime'
import { getLoginToken } from '../nativeBridge'
import { createContractError, isAppError, type AppError } from '../http/appError'
import { STORAGE_KEYS, storage } from '../../storage'
import type { ApiSignatureCredentials } from '../http/apiSignature'
import {
  createHttpClient,
  setHttpAuthFailureHandler,
  setHttpAuthHeadersProvider,
  setHttpSignatureCredentialsProvider,
  setHttpUnauthorizedHandler,
} from '../http/httpClient'

const AUTH_FAILURE_EVENT = 'dr-card-ui:auth-failure'
const AUTH_EXPIRED_EVENT = 'dr-card-ui:auth-expired'
const LOGIN_PATH = '/api/oauth/login'

export interface NewUserPopup {
  title: string
  description: string
  points: number | string
}

export interface AuthSession {
  userInfo: unknown
  accessToken: string
  is_new_user?: boolean
  popup?: NewUserPopup
}

interface LoginResponse extends AuthSession {}

interface LoginEnvelope {
  code?: unknown
  data?: unknown
}

const loginClient = createHttpClient({
  baseURL: runtimePolicy.apiBaseUrl ?? undefined,
  timeoutMs: 10_000,
})

let inFlightLogin: Promise<AuthSession> | undefined
let initialBootstrap: Promise<AuthSession> | undefined
let authFlowEnabled = false
let initializedForDocument = false
let volatileSession: AuthSession | undefined
// Native upstream credentials never enter sessionStorage, URLs outside /api, or logs.
let signatureCredentials: ApiSignatureCredentials | undefined

function readSession(): AuthSession | undefined {
  const value = storage.read(STORAGE_KEYS.authSession)
  if (value && value.accessToken.trim()) {
    if (volatileSession?.accessToken === value.accessToken) return volatileSession
    return { userInfo: null, accessToken: value.accessToken }
  }
  return volatileSession
}

function writeSession(session: AuthSession) {
  volatileSession = session
  storage.write(STORAGE_KEYS.authSession, { accessToken: session.accessToken })
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('dr-card-ui:auth-session-changed'))
}

export function clearAuthSession() {
  volatileSession = undefined
  signatureCredentials = undefined
  storage.remove(STORAGE_KEYS.authSession)
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('dr-card-ui:auth-session-cleared'))
}

export function getAuthSession() {
  return readSession()
}

export function setAuthFlowEnabled(enabled: boolean) {
  authFlowEnabled = enabled && runtimePolicy.dataMode === 'api'
}

/** Accept the confirmed backend envelope without weakening the login contract. */
export function parseLoginResponse(result: unknown): LoginResponse {
  if (!result || typeof result !== 'object') {
    throw createContractError('登录接口返回格式无效', { code: 'AUTH_LOGIN_RESPONSE_INVALID' })
  }

  const response = result as LoginEnvelope & Partial<LoginResponse>
  const payload =
    (response.code === 0 || response.code === '0') &&
    response.data &&
    typeof response.data === 'object'
      ? (response.data as Partial<LoginResponse>)
      : (response as Partial<LoginResponse>)

  if (typeof payload.accessToken !== 'string' || !payload.accessToken.trim() || !('userInfo' in payload)) {
    throw createContractError('登录响应必须包含 userInfo 和 accessToken', {
      code: 'AUTH_LOGIN_RESPONSE_INVALID',
      details: result,
    })
  }

  const popupValue = payload.popup
  const popup = popupValue && typeof popupValue === 'object' ? popupValue as Partial<NewUserPopup> : undefined
  const validPopup = popup && typeof popup.title === 'string' && popup.title.trim()
    && typeof popup.description === 'string' && popup.description.trim()
    && (typeof popup.points === 'number' || typeof popup.points === 'string')
    ? { title: popup.title, description: popup.description, points: popup.points }
    : undefined

  return {
    userInfo: payload.userInfo,
    accessToken: payload.accessToken,
    ...(typeof payload.is_new_user === 'boolean' ? { is_new_user: payload.is_new_user } : {}),
    ...(validPopup ? { popup: validPopup } : {}),
  }
}

async function loginFromNative(): Promise<AuthSession> {
  const credentials = await getLoginToken()
  if (!credentials.token.trim() || !credentials.salt?.trim()) {
    throw createContractError('Native 登录凭据缺少 token 或 salt', {
      code: 'AUTH_NATIVE_CREDENTIALS_INVALID',
    })
  }

  const result = await loginClient.request<unknown>({
    method: 'POST',
    url: LOGIN_PATH,
    data: { salt: credentials.salt, token: credentials.token },
    skipAuth: true,
    signatureCredentials: { token: credentials.token, salt: credentials.salt },
  })

  const session = parseLoginResponse(result)
  signatureCredentials = { token: credentials.token, salt: credentials.salt }
  writeSession(session)
  return session
}

export function authenticate(force = false): Promise<AuthSession> {
  if (!force) {
    const current = readSession()
    if (current && signatureCredentials) return Promise.resolve(current)
  }
  if (inFlightLogin) return inFlightLogin

  clearAuthSession()
  inFlightLogin = loginFromNative().finally(() => {
    inFlightLogin = undefined
  })
  return inFlightLogin
}

function isUnauthorizedAuthError(error: unknown) {
  return isAppError(error) && error.status === 401
}

function dispatchAuthEvent(eventName: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(eventName))
}

async function authenticateInitialDocument(): Promise<AuthSession> {
  try {
    return await authenticate(true)
  } catch (error) {
    if (!isUnauthorizedAuthError(error)) throw error
  }

  try {
    return await authenticate(true)
  } catch (error) {
    clearAuthSession()
    if (isUnauthorizedAuthError(error)) dispatchAuthEvent(AUTH_EXPIRED_EVENT)
    throw error
  }
}

export function bootstrapAuthSession(): Promise<AuthSession> {
  if (!initializedForDocument) {
    initializedForDocument = true
    initialBootstrap = authenticateInitialDocument().finally(() => {
      initialBootstrap = undefined
    })
    return initialBootstrap
  }
  if (initialBootstrap) return initialBootstrap
  return authenticate()
}

async function reauthenticateAfterUnauthorized() {
  try {
    await authenticate(true)
  } catch (error) {
    clearAuthSession()
    dispatchAuthEvent(
      isUnauthorizedAuthError(error) ? AUTH_EXPIRED_EVENT : AUTH_FAILURE_EVENT,
    )
    throw error
  }
}

/** Refresh the shared Native/H5 auth session after a failed non-idempotent request.
 * Caller must surface the original error; NEVER replay the chat POST automatically. */
export async function refreshChatAuthAfterUnauthorized(): Promise<void> {
  if (authFlowEnabled) await reauthenticateAfterUnauthorized()
}

/** Obtain the upstream Native token/salt for independent SSE and HTTP transports.
 * A restored accessToken requires re-reading the Native bridge before signing. */
export async function getApiSignatureCredentials(): Promise<ApiSignatureCredentials> {
  if (signatureCredentials) return signatureCredentials
  if (!readSession()) {
    throw createContractError('未建立签名会话', { code: 'AUTH_SIGNATURE_CREDENTIALS_MISSING' })
  }
  // Bridge failures happen before the HTTP request; preserve that distinction.
  let native: Awaited<ReturnType<typeof getLoginToken>>
  try {
    native = await getLoginToken()
  } catch {
    throw createContractError('无法取得 Native 签名凭据，请检查 App 登录状态', {
      code: 'AUTH_NATIVE_CREDENTIALS_UNAVAILABLE',
    })
  }
  if (!native.token.trim() || !native.salt?.trim()) {
    throw createContractError('Native 登录凭据缺少 token 或 salt', {
      code: 'AUTH_NATIVE_CREDENTIALS_INVALID',
    })
  }
  signatureCredentials = { token: native.token, salt: native.salt }
  return signatureCredentials
}

/** Only these failures certify that signing stopped before HTTP transport. */
export function isApiSignaturePreflightError(error: unknown) {
  return isAppError(error) && error.code === 'AUTH_NATIVE_CREDENTIALS_UNAVAILABLE'
}

setHttpAuthHeadersProvider(() => {
  const session = readSession()
  return session ? { Authorization: `Bearer ${session.accessToken}` } : {}
})
setHttpSignatureCredentialsProvider(getApiSignatureCredentials)
setHttpUnauthorizedHandler(() => {
  if (authFlowEnabled) void reauthenticateAfterUnauthorized()
})
setHttpAuthFailureHandler(() => {
  clearAuthSession()
})

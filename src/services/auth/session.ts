import { runtimePolicy } from '../../app/config/runtime'
import { getLoginToken } from '../nativeBridge'
import { createContractError } from '../http/appError'
import { STORAGE_KEYS, storage } from '../../storage'
import {
  createHttpClient,
  setHttpAuthFailureHandler,
  setHttpAuthHeadersProvider,
  setHttpUnauthorizedHandler,
} from '../http/httpClient'

const AUTH_FAILURE_EVENT = 'dr-card-ui:auth-failure'
const LOGIN_PATH = '/api/oauth/login'

export interface NewUserPopup {
  title: string
  description: string
  points?: number | string
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
  is_new_user?: unknown
  popup?: unknown
}

const DEFAULT_NEW_USER_POPUP: NewUserPopup = {
  title: '欢迎加入卡博士',
  description: '恭喜成为卡博士新用户，欢迎开启卡博士体验。',
}

/** Build a visible first-entry notice from the new-user flag, even without optional popup copy. */
export function getNewUserPopup(session: AuthSession | undefined): NewUserPopup | null {
  if (session?.is_new_user !== true) return null
  return session.popup ?? DEFAULT_NEW_USER_POPUP
}

const loginClient = createHttpClient({
  baseURL: runtimePolicy.apiBaseUrl ?? undefined,
  timeoutMs: 10_000,
})

let inFlightLogin: Promise<AuthSession> | undefined
let authFlowEnabled = false
let initializedForDocument = false
let volatileSession: AuthSession | undefined

function readSession(): AuthSession | undefined {
  const value = storage.read(STORAGE_KEYS.authSession)
  if (value && value.accessToken.trim()) {
    return { userInfo: volatileSession?.userInfo ?? null, accessToken: value.accessToken }
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

  // Gateways may leave extension fields outside data while wrapping login credentials.
  const isNewUser = typeof payload.is_new_user === 'boolean'
    ? payload.is_new_user
    : response.is_new_user
  const popupValue = payload.popup ?? response.popup
  const popup = popupValue && typeof popupValue === 'object' ? popupValue as Partial<NewUserPopup> : undefined
  const hasPopupContent = Boolean(
    (typeof popup?.title === 'string' && popup.title.trim()) ||
    (typeof popup?.description === 'string' && popup.description.trim()) ||
    typeof popup?.points === 'number' ||
    typeof popup?.points === 'string',
  )
  const validPopup = hasPopupContent
    ? {
        title: typeof popup?.title === 'string' && popup.title.trim() ? popup.title : DEFAULT_NEW_USER_POPUP.title,
        description: typeof popup?.description === 'string' && popup.description.trim()
          ? popup.description
          : DEFAULT_NEW_USER_POPUP.description,
        ...(typeof popup?.points === 'number' || typeof popup?.points === 'string'
          ? { points: popup.points }
          : {}),
      }
    : undefined

  return {
    userInfo: payload.userInfo,
    accessToken: payload.accessToken,
    ...(typeof isNewUser === 'boolean' ? { is_new_user: isNewUser } : {}),
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
  })

  const session = parseLoginResponse(result)
  writeSession(session)
  return session
}

export function authenticate(force = false): Promise<AuthSession> {
  if (!force) {
    const current = readSession()
    if (current) return Promise.resolve(current)
  }
  if (inFlightLogin) return inFlightLogin

  clearAuthSession()
  inFlightLogin = loginFromNative().finally(() => {
    inFlightLogin = undefined
  })
  return inFlightLogin
}

export function bootstrapAuthSession(): Promise<AuthSession> {
  if (!initializedForDocument) {
    initializedForDocument = true
    return authenticate(true)
  }
  return authenticate()
}

async function reauthenticateAfterUnauthorized() {
  try {
    await authenticate(true)
  } catch (error) {
    clearAuthSession()
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_FAILURE_EVENT))
    throw error
  }
}

/** Refresh the shared Native/H5 auth session after a failed non-idempotent request.
 * Caller must surface the original error; NEVER replay the chat POST automatically. */
export async function refreshChatAuthAfterUnauthorized(): Promise<void> {
  if (authFlowEnabled) await reauthenticateAfterUnauthorized()
}

setHttpAuthHeadersProvider(() => {
  if (!authFlowEnabled) return undefined
  const session = readSession()
  return session ? { Authorization: `Bearer ${session.accessToken}` } : undefined
})
setHttpUnauthorizedHandler(() => {
  if (authFlowEnabled) return reauthenticateAfterUnauthorized()
})
setHttpAuthFailureHandler(() => {
  if (authFlowEnabled && typeof window !== 'undefined') {
    clearAuthSession()
    window.dispatchEvent(new Event(AUTH_FAILURE_EVENT))
  }
})

export { AUTH_FAILURE_EVENT }

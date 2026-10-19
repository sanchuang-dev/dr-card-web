import axios, {
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios'
import { runtimePolicy } from '../../app/config/runtime'
import { AppError, toAppError } from './appError'
import { signCardApiUrl, type ApiSignatureCredentials } from './apiSignature'

export const DEFAULT_HTTP_TIMEOUT_MS = 10_000

type Awaitable<T> = T | Promise<T>

export type HttpAuthHeadersProvider = () => Awaitable<Record<string, string> | undefined>
export type HttpSignatureCredentialsProvider = () => Awaitable<ApiSignatureCredentials | undefined>
export type HttpUnauthorizedHandler = () => Awaitable<void>
export type HttpAuthFailureHandler = () => void

export interface HttpRequestConfig extends AxiosRequestConfig {
  skipAuth?: boolean
  /** Used for the OAuth request before the H5 session exists. */
  signatureCredentials?: ApiSignatureCredentials
}

export interface HttpClientOptions {
  baseURL?: string
  timeoutMs?: number
  authHeadersProvider?: HttpAuthHeadersProvider
  signatureCredentialsProvider?: HttpSignatureCredentialsProvider
  /** Override only for focused tests; production follows runtime API mode. */
  signatureEnabled?: boolean
  onUnauthorized?: HttpUnauthorizedHandler
  onAuthFailure?: HttpAuthFailureHandler
  adapter?: AxiosAdapter
}

export interface HttpClient {
  request<TResponse>(config: HttpRequestConfig): Promise<TResponse>
}

let defaultAuthHeadersProvider: HttpAuthHeadersProvider | undefined
let defaultSignatureCredentialsProvider: HttpSignatureCredentialsProvider | undefined
let defaultUnauthorizedHandler: HttpUnauthorizedHandler | undefined
let defaultAuthFailureHandler: HttpAuthFailureHandler | undefined

export function setHttpAuthHeadersProvider(provider: HttpAuthHeadersProvider | undefined) {
  defaultAuthHeadersProvider = provider
}

export function setHttpSignatureCredentialsProvider(provider: HttpSignatureCredentialsProvider | undefined) {
  defaultSignatureCredentialsProvider = provider
}

export function setHttpUnauthorizedHandler(handler: HttpUnauthorizedHandler | undefined) {
  defaultUnauthorizedHandler = handler
}

export function setHttpAuthFailureHandler(handler: HttpAuthFailureHandler | undefined) {
  defaultAuthFailureHandler = handler
}

function normalizeBaseURL(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function isAbsoluteHttpUrl(url: string | undefined) {
  return Boolean(url && /^https?:\/\//i.test(url))
}

function createConfigurationError() {
  return new AppError({
    kind: 'configuration',
    code: 'HTTP_BASE_URL_MISSING',
    message: 'HTTP base URL 未配置',
  })
}

function isBusinessUnauthorized(data: unknown) {
  if (!data || typeof data !== 'object') return false
  const code = (data as { code?: unknown }).code
  return code === 401 || code === '401'
}

function isUnauthorizedError(error: AppError) {
  return error.status === 401 || (error.kind === 'business' && error.status === 401)
}

function belongsToBaseURL(config: AxiosRequestConfig, baseURL: string | undefined) {
  if (!baseURL || !config.url) return !/^https?:\/\//i.test(config.url ?? '')
  try {
    return new URL(config.url, baseURL).origin === new URL(baseURL).origin
  } catch {
    return false
  }
}

function getConfiguredBaseURL() {
  return normalizeBaseURL(import.meta.env.VITE_API_BASE_URL)
}

function getRuntimeBaseURL() {
  const configured = getConfiguredBaseURL()
  if (configured) return configured

  // H013/H014: browser Mock still crosses a real HTTP boundary. In dev/preview Mock mode,
  // use the current H5 origin so MSW can intercept relative business requests. API mode keeps
  // the H007 missing-base failure instead of silently falling back to the H5 origin.
  if (runtimePolicy.dataMode === 'mock' && typeof window !== 'undefined') {
    return window.location.origin
  }

  return undefined
}

export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const instance = axios.create({
    baseURL: normalizeBaseURL(options.baseURL),
    timeout: options.timeoutMs ?? DEFAULT_HTTP_TIMEOUT_MS,
    adapter: options.adapter,
    headers: {
      Accept: 'application/json',
    },
  })

  instance.interceptors.request.use(async (config) => {
    const effectiveBaseURL = normalizeBaseURL(config.baseURL ?? instance.defaults.baseURL)
    if (!effectiveBaseURL && !isAbsoluteHttpUrl(config.url)) {
      throw createConfigurationError()
    }

    const headersProvider = options.authHeadersProvider ?? (() => defaultAuthHeadersProvider?.())
    const authHeaders =
      (config as HttpRequestConfig).skipAuth || !belongsToBaseURL(config, effectiveBaseURL)
        ? undefined
        : await headersProvider()
    const headers = AxiosHeaders.from(config.headers)
    if (authHeaders) {
      for (const [name, value] of Object.entries(authHeaders)) headers.set(name, value)
    }

    // skipAuth suppresses Bearer on OAuth, but DOES NOT suppress the API signature.
    // The backend signs the received query + body; all parameters are encoded only
    // after computing secstr. Never attach Native credentials to a foreign origin.
    const sameOrigin = belongsToBaseURL(config, effectiveBaseURL)
    const requestUrl = new URL(config.url ?? '', effectiveBaseURL).toString()
    if ((options.signatureEnabled ?? runtimePolicy.dataMode === 'api') &&
        sameOrigin && new URL(requestUrl).pathname.startsWith('/api/')) {
      const credentials = (config as HttpRequestConfig).signatureCredentials ??
        await (options.signatureCredentialsProvider ?? defaultSignatureCredentialsProvider)?.()
      if (!credentials?.salt) {
        throw new AppError({
          kind: 'configuration', code: 'API_SIGNATURE_CREDENTIALS_MISSING',
          message: '当前 App 未提供签名凭据，请重新进入登录流程',
        })
      }
      config.url = signCardApiUrl(requestUrl, config.params as Record<string, unknown> | URLSearchParams | undefined,
        config.data, credentials)
      config.params = undefined
      headers.set('salt', credentials.salt)
    }
    config.headers = headers
    return config
  })

  return {
    async request<TResponse>(config: AxiosRequestConfig) {
      let retried = false
      while (true) {
        try {
          const response: AxiosResponse<TResponse> = await instance.request<TResponse>(config)
          if (isBusinessUnauthorized(response.data)) {
            throw new AppError({
              kind: 'business',
              code: '401',
              status: 401,
              message: '业务鉴权已失效',
              details: response.data,
            })
          }
          return response.data
        } catch (error) {
          const appError = toAppError(error)
          const unauthorizedHandler = options.onUnauthorized ?? defaultUnauthorizedHandler
          const authFailureHandler = options.onAuthFailure ?? defaultAuthFailureHandler
          if (retried && !(config as HttpRequestConfig).skipAuth && isUnauthorizedError(appError)) {
            authFailureHandler?.()
            throw appError
          }
          if (
            !unauthorizedHandler ||
            (config as HttpRequestConfig).skipAuth ||
            /\/api\/oauth\/login(?:\?|$)/.test(config.url ?? '') ||
            !belongsToBaseURL(config, normalizeBaseURL(config.baseURL ?? instance.defaults.baseURL)) ||
            !isUnauthorizedError(appError)
          ) {
            throw appError
          }

          retried = true
          await unauthorizedHandler()
        }
      }
    },
  }
}

export const httpClient = createHttpClient({
  baseURL: getRuntimeBaseURL(),
  authHeadersProvider: () => defaultAuthHeadersProvider?.(),
})

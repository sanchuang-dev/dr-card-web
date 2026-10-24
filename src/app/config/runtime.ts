export type AppEnvironment = 'preview' | 'dev' | 'test' | 'prod'
export type DataMode = 'mock' | 'api'
export type BridgeMode = 'disabled' | 'mock' | 'native'

export interface BuildIdentity {
  sha: string
  id: string
  sourceBranch: string
}

const APP_ENVIRONMENTS: AppEnvironment[] = ['preview', 'dev', 'test', 'prod']
const DATA_MODES: DataMode[] = ['mock', 'api']
const BRIDGE_MODES: BridgeMode[] = ['disabled', 'mock', 'native']

const DEFAULT_DATA_MODE: Record<AppEnvironment, DataMode> = {
  preview: 'mock',
  dev: 'mock',
  test: 'api',
  prod: 'api',
}

const DEFAULT_BRIDGE_MODE: Record<AppEnvironment, BridgeMode> = {
  preview: 'disabled',
  dev: 'disabled',
  test: 'native',
  prod: 'native',
}

function asAppEnvironment(value: string | undefined): AppEnvironment | undefined {
  return APP_ENVIRONMENTS.includes(value as AppEnvironment) ? (value as AppEnvironment) : undefined
}

function asDataMode(value: string | undefined): DataMode | undefined {
  return DATA_MODES.includes(value as DataMode) ? (value as DataMode) : undefined
}

function asBridgeMode(value: string | undefined): BridgeMode | undefined {
  return BRIDGE_MODES.includes(value as BridgeMode) ? (value as BridgeMode) : undefined
}

function inferAppEnvironment(mode: string): AppEnvironment | undefined {
  if (mode === 'development') return 'dev'
  if (mode === 'preview') return 'preview'
  if (mode === 'test') return 'test'
  if (mode === 'production') return 'prod'
  return undefined
}

function trimOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function validateApiBaseUrl(raw: string | undefined, errors: string[]): string | null {
  const value = trimOrUndefined(raw)
  if (!value) return null

  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      errors.push('VITE_API_BASE_URL must use http:// or https://.')
      return null
    }
    return value
  } catch {
    errors.push('VITE_API_BASE_URL must be an absolute http(s) URL when provided.')
    return null
  }
}

function validateSocketBaseUrl(
  raw: string | undefined,
  apiBaseUrl: string | null,
  errors: string[],
): string | null {
  const value = trimOrUndefined(raw)
  if (!value) return apiBaseUrl ? new URL(apiBaseUrl).origin : null

  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      errors.push('VITE_SOCKET_BASE_URL must use http:// or https://.')
      return null
    }
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
      errors.push('VITE_SOCKET_BASE_URL must be an origin only; configure Engine.IO path with VITE_SOCKET_PATH.')
      return null
    }
    return parsed.origin
  } catch {
    errors.push('VITE_SOCKET_BASE_URL must be an absolute http(s) origin when provided.')
    return null
  }
}

function validateSocketPath(raw: string | undefined, errors: string[]): string {
  const value = trimOrUndefined(raw) ?? '/socket.io'
  if (!value.startsWith('/') || value.includes('?') || value.includes('#')) {
    errors.push('VITE_SOCKET_PATH must be an absolute path without query or hash.')
    return '/socket.io'
  }
  return value.endsWith('/') ? value : value + '/'
}

const configErrors: string[] = []
const inferredAppEnvironment = inferAppEnvironment(import.meta.env.MODE)
const rawAppEnvironment = trimOrUndefined(import.meta.env.VITE_APP_ENV)
const explicitAppEnvironment = asAppEnvironment(rawAppEnvironment)

if (!inferredAppEnvironment) {
  configErrors.push(`Unsupported Vite mode "${import.meta.env.MODE}".`)
}
if (rawAppEnvironment && !explicitAppEnvironment) {
  configErrors.push(`Unknown VITE_APP_ENV=${rawAppEnvironment}.`)
}
if (
  explicitAppEnvironment &&
  inferredAppEnvironment &&
  explicitAppEnvironment !== inferredAppEnvironment
) {
  configErrors.push(
    `VITE_APP_ENV=${explicitAppEnvironment} contradicts Vite mode ${import.meta.env.MODE} (${inferredAppEnvironment}).`,
  )
}

const appEnvironment = explicitAppEnvironment ?? inferredAppEnvironment ?? 'dev'

const rawDataMode = trimOrUndefined(import.meta.env.VITE_DATA_MODE)
const parsedDataMode = asDataMode(rawDataMode)
if (rawDataMode && !parsedDataMode) configErrors.push(`Unknown VITE_DATA_MODE=${rawDataMode}.`)
const dataMode = parsedDataMode ?? DEFAULT_DATA_MODE[appEnvironment]

const rawBridgeMode = trimOrUndefined(import.meta.env.VITE_BRIDGE_MODE)
const parsedBridgeMode = asBridgeMode(rawBridgeMode)
if (rawBridgeMode && !parsedBridgeMode) {
  configErrors.push(`Unknown VITE_BRIDGE_MODE=${rawBridgeMode}.`)
}
const bridgeMode = parsedBridgeMode ?? DEFAULT_BRIDGE_MODE[appEnvironment]

const isDevLike = appEnvironment === 'dev' || appEnvironment === 'preview'
const isProdLike = !isDevLike

if (isProdLike && dataMode === 'mock') {
  configErrors.push(`${appEnvironment} runtime forbids VITE_DATA_MODE=mock.`)
}
if (isProdLike && bridgeMode !== 'native') {
  configErrors.push(`${appEnvironment} runtime requires VITE_BRIDGE_MODE=native.`)
}

const apiBaseUrl = validateApiBaseUrl(import.meta.env.VITE_API_BASE_URL, configErrors)
const socketBaseUrl = validateSocketBaseUrl(import.meta.env.VITE_SOCKET_BASE_URL, apiBaseUrl, configErrors)
const socketPath = validateSocketPath(import.meta.env.VITE_SOCKET_PATH, configErrors)
const build: BuildIdentity = Object.freeze({
  sha: trimOrUndefined(import.meta.env.VITE_BUILD_SHA) ?? 'local',
  id: trimOrUndefined(import.meta.env.VITE_BUILD_ID) ?? `${appEnvironment}-local`,
  sourceBranch: trimOrUndefined(import.meta.env.VITE_SOURCE_BRANCH) ?? 'local',
})

if (configErrors.length > 0) {
  throw new Error(`[runtime-config] ${configErrors.join(' ')}`)
}

const fixtureEnvironment = dataMode === 'mock' && isDevLike
const bridgeLabEnabled = appEnvironment !== 'prod'

/**
 * H036: test/prod carry real API + Native Bridge integration only, so their only legal runtime
 * container is the App WebView. This flag is derived from the static environment (never from a
 * new env var): whether the *current* host qualifies is a runtime probe and belongs to
 * getNativeHost(), because the same bundle is opened both in browsers and in the App WebView.
 */
const requiresNativeHost = isProdLike

/**
 * Single runtime truth for the embedded H5.
 *
 * H006 makes environment/build identity explicit without inventing H008 backend contracts or H015
 * JSBridge methods. An empty apiBaseUrl means "backend not configured yet"; it never means fallback
 * to Mock. test/prod reject both API Mock and Bridge Mock at build time (scripts/build-h5.mjs) and
 * again here at runtime as defense in depth.
 */
export const runtimePolicy = Object.freeze({
  mode: import.meta.env.MODE,
  appEnvironment,
  dataMode,
  bridgeMode,
  apiBaseUrl,
  apiBaseConfigured: apiBaseUrl != null,
  socketBaseUrl,
  socketPath,
  isDevLike,
  isProdLike,
  fixtureQueriesEnabled: fixtureEnvironment,
  debugPanelEnabled: fixtureEnvironment,
  bridgeLabEnabled,
  requiresNativeHost,
  build,
})

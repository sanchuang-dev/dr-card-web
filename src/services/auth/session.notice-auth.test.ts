import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosAdapter } from 'axios'

const probes = vi.hoisted(() => ({
  getLoginToken: vi.fn(),
  requests: [] as Array<{ url: string; authorization: string | undefined }>,
  issuedToken: 'access-A',
  unread401Once: false,
}))

vi.mock('../../app/config/runtime', () => ({
  runtimePolicy: { apiBaseUrl: 'https://api.example.test', dataMode: 'api' },
}))

vi.mock('../nativeBridge', () => ({
  getLoginToken: probes.getLoginToken,
}))

// Keep the real Axios interceptors and notice service. Substitute only the transport.
vi.mock('../http/httpClient', async importOriginal => {
  const actual = await importOriginal<typeof import('../http/httpClient')>()
  const adapter: AxiosAdapter = async (config) => {
    const url = config.url ?? ''
    const parsedUrl = new URL(url, 'https://api.example.test')
    const sameOrigin = parsedUrl.origin === 'https://api.example.test'
    const route = sameOrigin ? parsedUrl.pathname : url
    probes.requests.push({
      url: route,
      authorization: config.headers.get('Authorization')?.toString(),
    })
    let data: unknown = { ok: true }
    if (route === '/api/oauth/login') {
      data = { code: 0, data: { userInfo: { id: 9 }, accessToken: probes.issuedToken } }
    } else if (route === '/api/notices/unread-count') {
      if (probes.unread401Once) {
        probes.unread401Once = false
        data = { code: 401, message: '请先登录' }
      } else {
        data = { code: 0, data: { total: 2, items: [] } }
      }
    }
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  return {
    ...actual,
    createHttpClient: (options: Parameters<typeof actual.createHttpClient>[0]) =>
      actual.createHttpClient({ ...options, adapter }),
    httpClient: actual.createHttpClient({ baseURL: 'https://api.example.test', adapter }),
  }
})

import { authenticate, clearAuthSession, setAuthFlowEnabled } from './session'
import { fetchNoticeUnreadCounts } from '../notices'
import { httpClient } from '../http'

describe('#213 notice auth header follows the session, not the current route', () => {
  beforeEach(() => {
    clearAuthSession()
    setAuthFlowEnabled(false)
    probes.requests.length = 0
    probes.issuedToken = 'access-A'
    probes.unread401Once = false
    probes.getLoginToken.mockReset().mockResolvedValue({ token: 'native-token', salt: 'native-salt' })
  })

  it('attaches the stored Bearer token to the real unread-count service even on a deferred route', async () => {
    await authenticate()
    setAuthFlowEnabled(false) // MobileLayout does this for /mall and other deferred routes.

    await expect(fetchNoticeUnreadCounts()).resolves.toMatchObject({ total: 2 })
    expect(probes.requests.filter(request => request.url === '/api/notices/unread-count'))
      .toEqual([{ url: '/api/notices/unread-count', authorization: 'Bearer access-A' }])
  })

  it('does not silently send an unsigned API request when no Native session exists', async () => {
    await expect(fetchNoticeUnreadCounts()).rejects.toMatchObject({
      code: 'AUTH_SIGNATURE_CREDENTIALS_MISSING',
    })
    expect(probes.requests).toHaveLength(0)
  })

  it('excludes Bearer from OAuth skipAuth, explicit skipAuth and cross-origin requests', async () => {
    await authenticate()
    setAuthFlowEnabled(true)
    await httpClient.request({ method: 'GET', url: '/api/notices/unread-count', skipAuth: true })
    await httpClient.request({ method: 'GET', url: 'https://other.example.test/resource' })

    expect(probes.requests).toEqual([
      { url: '/api/oauth/login', authorization: undefined },
      { url: '/api/notices/unread-count', authorization: undefined },
      { url: 'https://other.example.test/resource', authorization: undefined },
    ])
  })

  it('preserves a single 401 reauthentication and retries with the renewed token', async () => {
    await authenticate()
    setAuthFlowEnabled(true)
    probes.issuedToken = 'access-B'
    probes.unread401Once = true

    await expect(fetchNoticeUnreadCounts()).resolves.toMatchObject({ total: 2 })
    expect(probes.requests.filter(request => request.url === '/api/notices/unread-count'))
      .toEqual([
        { url: '/api/notices/unread-count', authorization: 'Bearer access-A' },
        { url: '/api/notices/unread-count', authorization: 'Bearer access-B' },
      ])
    expect(probes.requests.filter(request => request.url === '/api/oauth/login')).toHaveLength(2)
  })
})

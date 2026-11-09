import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  getLoginToken: vi.fn(),
  setAuthHeadersProvider: vi.fn(),
  setSignatureCredentialsProvider: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
  setAuthFailureHandler: vi.fn(),
}))

vi.mock('../../app/config/runtime', () => ({
  runtimePolicy: {
    apiBaseUrl: 'https://api.example.test',
    dataMode: 'api',
  },
}))

vi.mock('../nativeBridge', () => ({
  getLoginToken: mocks.getLoginToken,
}))

vi.mock('../http/httpClient', () => ({
  createHttpClient: () => ({
    request: mocks.request,
  }),
  setHttpAuthHeadersProvider: mocks.setAuthHeadersProvider,
  setHttpSignatureCredentialsProvider: mocks.setSignatureCredentialsProvider,
  setHttpUnauthorizedHandler: mocks.setUnauthorizedHandler,
  setHttpAuthFailureHandler: mocks.setAuthFailureHandler,
}))

describe('bootstrap auth 401 handling', () => {
  beforeEach(() => {
    vi.resetModules()
    mocks.request.mockReset()
    mocks.getLoginToken.mockReset()
    mocks.setAuthHeadersProvider.mockReset()
    mocks.setSignatureCredentialsProvider.mockReset()
    mocks.setUnauthorizedHandler.mockReset()
    mocks.setAuthFailureHandler.mockReset()
    mocks.getLoginToken.mockResolvedValue({ token: 'native-token', salt: 'native-salt' })
  })

  it('retries the initial login once after a 401 and succeeds without expiring the WebView', async () => {
    const { bootstrapAuthSession, AUTH_EXPIRED_EVENT } = await import('./session')
    const { AppError } = await import('../http/appError')
    const expired = vi.fn()
    window.addEventListener(AUTH_EXPIRED_EVENT, expired)

    mocks.request
      .mockRejectedValueOnce(
        new AppError({ kind: 'business', message: 'unauthorized', status: 401, code: '401' }),
      )
      .mockResolvedValueOnce({
        code: 0,
        data: { userInfo: { id: 'user-1' }, accessToken: 'access-1' },
      })

    await expect(bootstrapAuthSession()).resolves.toEqual({
      userInfo: { id: 'user-1' },
      accessToken: 'access-1',
    })
    expect(mocks.request).toHaveBeenCalledTimes(2)
    expect(expired).not.toHaveBeenCalled()

    window.removeEventListener(AUTH_EXPIRED_EVENT, expired)
  })

  it('emits auth-expired when the initial login and its single retry both return 401', async () => {
    const { bootstrapAuthSession, AUTH_EXPIRED_EVENT } = await import('./session')
    const { AppError } = await import('../http/appError')
    const expired = vi.fn()
    window.addEventListener(AUTH_EXPIRED_EVENT, expired)

    mocks.request
      .mockRejectedValueOnce(
        new AppError({ kind: 'business', message: 'unauthorized', status: 401, code: '401' }),
      )
      .mockRejectedValueOnce(
        new AppError({ kind: 'business', message: 'unauthorized', status: 401, code: '401' }),
      )

    await expect(bootstrapAuthSession()).rejects.toMatchObject({ status: 401 })
    expect(mocks.request).toHaveBeenCalledTimes(2)
    expect(expired).toHaveBeenCalledTimes(1)

    window.removeEventListener(AUTH_EXPIRED_EVENT, expired)
  })

  it('shares the whole initial retry flow with concurrent bootstrap callers', async () => {
    const { bootstrapAuthSession, AUTH_EXPIRED_EVENT } = await import('./session')
    const { AppError } = await import('../http/appError')
    const expired = vi.fn()
    window.addEventListener(AUTH_EXPIRED_EVENT, expired)

    let rejectFirst!: (error: unknown) => void
    const firstAttempt = new Promise<never>((_, reject) => {
      rejectFirst = reject
    })

    mocks.request
      .mockReturnValueOnce(firstAttempt)
      .mockResolvedValueOnce({
        code: 0,
        data: { userInfo: { id: 'user-1' }, accessToken: 'access-1' },
      })

    const first = bootstrapAuthSession()
    const concurrent = bootstrapAuthSession()

    expect(concurrent).toBe(first)

    rejectFirst(
      new AppError({ kind: 'business', message: 'unauthorized', status: 401, code: '401' }),
    )

    await expect(first).resolves.toEqual({
      userInfo: { id: 'user-1' },
      accessToken: 'access-1',
    })
    await expect(concurrent).resolves.toEqual({
      userInfo: { id: 'user-1' },
      accessToken: 'access-1',
    })
    expect(mocks.request).toHaveBeenCalledTimes(2)
    expect(expired).not.toHaveBeenCalled()

    window.removeEventListener(AUTH_EXPIRED_EVENT, expired)
  })

  it('does not relabel a non-401 bootstrap failure as expired', async () => {
    const { bootstrapAuthSession, AUTH_EXPIRED_EVENT } = await import('./session')
    const { AppError } = await import('../http/appError')
    const expired = vi.fn()
    window.addEventListener(AUTH_EXPIRED_EVENT, expired)

    mocks.request.mockRejectedValueOnce(
      new AppError({ kind: 'network', message: 'network failed' }),
    )

    await expect(bootstrapAuthSession()).rejects.toMatchObject({ kind: 'network' })
    expect(mocks.request).toHaveBeenCalledTimes(1)
    expect(expired).not.toHaveBeenCalled()

    window.removeEventListener(AUTH_EXPIRED_EVENT, expired)
  })
})

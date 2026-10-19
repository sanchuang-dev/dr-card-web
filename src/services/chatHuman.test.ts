import { beforeEach, describe, expect, it, vi } from 'vitest'
import { connectChatSocket, transferChatToHuman } from './chatHuman'
import { AppError } from './http'

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, (...args: any[]) => void>()
  const socket = {
    connected: false,
    on: vi.fn((event: string, callback: (...args: any[]) => void) => { handlers.set(event, callback) }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(() => handlers.clear()),
    io: { reconnection: vi.fn() },
  }
  return {
    socket, handlers, io: vi.fn(() => socket), fetch: vi.fn(),
    token: 'secret-token', refresh: vi.fn(), signature: vi.fn(),
  }
})
vi.mock('socket.io-client', () => ({ io: mocks.io }))
vi.mock('../app/config/runtime', () => ({
  runtimePolicy: { apiBaseUrl: 'https://api.example.test/api', dataMode: 'api' },
}))
vi.mock('./auth/session', () => ({
  getAuthSession: () => ({ accessToken: mocks.token }),
  refreshChatAuthAfterUnauthorized: mocks.refresh,
  getApiSignatureCredentials: mocks.signature,
}))

beforeEach(() => {
  mocks.handlers.clear()
  mocks.io.mockClear(); mocks.socket.on.mockClear(); mocks.socket.connect.mockClear()
  mocks.socket.disconnect.mockClear(); mocks.socket.removeAllListeners.mockClear()
  mocks.socket.io.reconnection.mockClear()
  mocks.socket.connected = false
  mocks.token = 'secret-token'
  mocks.fetch.mockReset(); mocks.refresh.mockReset()
  mocks.signature.mockReset().mockResolvedValue({ token: 'native-token', salt: 'test-salt' })
  vi.stubGlobal('fetch', mocks.fetch)
})

describe('#138 Socket.IO client contract', () => {
  it('connects same-origin default namespace using auth.token, never URL/query credentials', () => {
    const status = vi.fn(), onMessage = vi.fn(), onConnected = vi.fn()
    const handle = connectChatSocket('secret-token', { onStatus: status, onMessage, onConnected })
    expect(mocks.io).toHaveBeenCalledWith('https://api.example.test', expect.objectContaining({
      auth: { token: 'secret-token' }, autoConnect: false, reconnection: true,
    }))
    expect(mocks.socket.connect).toHaveBeenCalledOnce()
    mocks.socket.connected = true
    mocks.handlers.get('connect')?.()
    expect(onConnected).toHaveBeenCalledWith(false)
    mocks.handlers.get('chat:message')?.({
      id: 45, user_id: '9', sender_id: '0', content: '真人回复',
      msg_type: 1, create_time: 1790000000,
    })
    expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ id: 45, sender_id: '0' }))
    mocks.handlers.get('chat:message')?.({ id: -1, content: '非法数据' })
    expect(onMessage).toHaveBeenCalledTimes(1)
    mocks.handlers.get('disconnect')?.('transport close')
    mocks.handlers.get('connect')?.()
    expect(onConnected).toHaveBeenLastCalledWith(true)
    handle.disconnect()
    expect(mocks.socket.disconnect).toHaveBeenCalled()
    expect(mocks.socket.removeAllListeners).toHaveBeenCalled()
    expect(handle.connected()).toBe(false)
  })

  it('stops reconnection on authorization error and does not leak token to callbacks', () => {
    const status = vi.fn()
    connectChatSocket('secret-token', { onStatus: status, onMessage: vi.fn(), onConnected: vi.fn() })
    mocks.handlers.get('error')?.({ message: '请先登录' })
    expect(status).toHaveBeenLastCalledWith('unauthorized', expect.any(String))
    expect(mocks.socket.io.reconnection).toHaveBeenCalledWith(false)
    expect(mocks.socket.disconnect).toHaveBeenCalled()
    expect(JSON.stringify(status.mock.calls)).not.toContain('secret-token')
  })

  it('POST /transfer only after auth, parses human mode, no client identity', async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      code: 0, msg: 'success', data: { mode: 'human' },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    await expect(transferChatToHuman()).resolves.toBeUndefined()
    const [url, request] = mocks.fetch.mock.calls[0]
    const signedUrl = new URL(url)
    expect(signedUrl.origin + signedUrl.pathname).toBe('https://api.example.test/api/chatmessages/transfer')
    expect(signedUrl.searchParams.get('token')).toBe('native-token')
    expect(signedUrl.searchParams.get('secstr')).toMatch(/^[0-9a-f]{32}$/)
    expect(request.headers.salt).toBe('test-salt')
    expect(request.headers.Authorization).toBe('Bearer secret-token')
    expect(request.method).toBe('POST')
    expect(JSON.parse(request.body)).toEqual({})
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it.each([
    'AUTH_SIGNATURE_CREDENTIALS_MISSING',
    'AUTH_NATIVE_CREDENTIALS_INVALID',
    'AUTH_NATIVE_CREDENTIALS_UNAVAILABLE',
  ])('preserves %s before sending any transfer request', async code => {
    const error = new AppError({
      kind: 'contract', code, message: 'Native 登录凭据缺少 token 或 salt',
    })
    mocks.signature.mockRejectedValueOnce(error)
    await expect(transferChatToHuman()).rejects.toBe(error)
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('does not fake transfer success on business error, network failure or invalid mode', async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      code: 500, message: '没有对应服务', data: [],
    }), { status: 200 }))
    await expect(transferChatToHuman()).rejects.toMatchObject({ kind: 'business' })
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      code: 0, data: { mode: 'ai' },
    }), { status: 200 }))
    await expect(transferChatToHuman()).rejects.toMatchObject({ kind: 'contract' })
    mocks.fetch.mockRejectedValueOnce(new Error('token secret-token'))
    let error: unknown
    try { await transferChatToHuman() } catch (cause) { error = cause }
    expect(error).toMatchObject({ kind: 'network' })
    expect(JSON.stringify(error)).not.toContain('secret-token')
  })

  it('preserves 401 even when refreshing and never repeats non-idempotent transfer', async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      code: 401, message: '请先登录',
    }), { status: 401 }))
    mocks.refresh.mockResolvedValueOnce(undefined)
    await expect(transferChatToHuman()).rejects.toMatchObject({ status: 401 })
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
  })

  it('refreshes authorization on an empty 401 response without repeating transfer', async () => {
    mocks.refresh.mockResolvedValueOnce(undefined)
    mocks.fetch.mockResolvedValueOnce(new Response('', { status: 401 }))
    await expect(transferChatToHuman()).rejects.toMatchObject({ kind: 'http', status: 401 })
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(mocks.refresh).toHaveBeenCalledTimes(1)
  })

  it('preserves HTTP error classification for HTML gateway failures', async () => {
    mocks.fetch.mockResolvedValueOnce(new Response('<html>bad gateway</html>', { status: 502 }))
    await expect(transferChatToHuman()).rejects.toMatchObject({ kind: 'http', status: 502 })
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it('respects already-cancelled transfer without opening the network', async () => {
    const controller = new AbortController(); controller.abort()
    await expect(transferChatToHuman(controller.signal)).rejects.toMatchObject({ kind: 'cancelled' })
    expect(mocks.fetch).not.toHaveBeenCalled()
  })
})

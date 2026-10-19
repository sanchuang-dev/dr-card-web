import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendChatStream, CHAT_ADD_PATH } from './chatStream'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getSession: vi.fn(() => ({ accessToken: 'secret-token', userInfo: null })),
  bootstrap: vi.fn(),
  refresh: vi.fn(),
  getSignature: vi.fn(),
}))
vi.mock('../app/config/runtime', () => ({
  runtimePolicy: { dataMode: 'api', apiBaseUrl: 'https://api.test.example' },
}))
vi.mock('./auth/session', () => ({
  getAuthSession: mocks.getSession,
  bootstrapAuthSession: mocks.bootstrap,
  refreshChatAuthAfterUnauthorized: mocks.refresh,
  getApiSignatureCredentials: mocks.getSignature,
}))

const encode = (value: string) => new TextEncoder().encode(value)
function sse(chunks: Uint8Array[], status = 200) {
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach(chunk => controller.enqueue(chunk))
      controller.close()
    },
  }), { status, headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } })
}
const stream = (...pieces: string[]) => sse(pieces.map(encode))

beforeEach(() => {
  mocks.fetch.mockReset()
  mocks.getSession.mockReset().mockReturnValue({ accessToken: 'secret-token', userInfo: null })
  mocks.bootstrap.mockReset().mockResolvedValue({ accessToken: 'new-token', userInfo: null })
  mocks.refresh.mockReset().mockResolvedValue(undefined)
  mocks.getSignature.mockReset().mockResolvedValue({ token: 'upstream-token', salt: 'test-salt' })
  vi.stubGlobal('fetch', mocks.fetch)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('#136 non-idempotent AI stream transport', () => {
  it('posts exactly one authorized request and merges incremental delta chunks', async () => {
    const delta: string[] = []
    const unicode = encode(': ok\n\ndata: {"type":"text","content":"你🙂好"}\r\n\r\ndata: {"type":"done","message_id":456}\r\n\r\n')
    mocks.fetch.mockResolvedValueOnce(sse(Array.from(unicode, b => Uint8Array.of(b))))
    await expect(sendChatStream('  你好  ', { onDelta: text => delta.push(text) }))
      .resolves.toEqual({ mode: 'ai', text: '你🙂好', messageId: 456 })
    expect(delta).toEqual(['你🙂好'])
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    const [url, options] = mocks.fetch.mock.calls[0]
    const signedUrl = new URL(url)
    expect(signedUrl.origin + signedUrl.pathname).toBe('https://api.test.example' + CHAT_ADD_PATH)
    expect(signedUrl.searchParams.get('token')).toBe('upstream-token')
    expect(signedUrl.searchParams.get('secstr')).toMatch(/^[0-9a-f]{32}$/)
    expect(options.headers.salt).toBe('test-salt')
    expect(options.method).toBe('POST')
    expect(options.headers).toMatchObject({
      Authorization: 'Bearer secret-token',
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(options.body)).toEqual({ content: '你好', msg_type: 1 })
    expect(options.credentials).toBe('omit')
  })

  it('reports human mode only on a real SSE event (never invents socket success)', async () => {
    const modes: string[] = []
    mocks.fetch.mockResolvedValueOnce(stream('data: {"type":"human"}\n\ndata: {"type":"done"}\n\n'))
    await expect(sendChatStream('人工客服', { onMode: mode => modes.push(mode) }))
      .resolves.toEqual({ mode: 'human', text: '' })
    expect(modes).toEqual(['human'])
  })

  it('treats an HTTP 200 error frame after a partial response as an error', async () => {
    const seen: string[] = []
    mocks.fetch.mockResolvedValueOnce(stream(
      'data: {"type":"text","content":"半句"}\n\n',
      'data: {"type":"error","message":"AI客服未配置"}\n\n',
    ))
    await expect(sendChatStream('test', { onDelta: delta => seen.push(delta) })).rejects
      .toMatchObject({ kind: 'business', code: 'CHAT_STREAM_ERROR', message: 'AI客服未配置' })
    expect(seen).toEqual(['半句'])
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it('does not retry POST after 401 JSON and uses existing re-authentication', async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(
      JSON.stringify({ code: 401, message: '请先登录', data: [] }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    ))
    await expect(sendChatStream('hi')).rejects.toMatchObject({ kind: 'http', status: 401 })
    expect(mocks.refresh).toHaveBeenCalledOnce()
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it('preserves 401 when auth refresh itself clears the old session', async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(
      JSON.stringify({ code: 401, message: '请登录' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    ))
    mocks.refresh.mockImplementationOnce(async () => {
      mocks.getSession.mockReturnValue({ accessToken: 'new-token', userInfo: null })
      window.dispatchEvent(new Event('dr-card-ui:auth-session-cleared'))
    })
    await expect(sendChatStream('hello')).rejects.toMatchObject({
      kind: 'http', status: 401, code: '401',
    })
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it('rejects HTTP 200 JSON business failures and wrong content-type without false success', async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(
      JSON.stringify({ code: 500, message: '内容参数缺失', data: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    await expect(sendChatStream('hi')).rejects.toMatchObject({ kind: 'business', message: '内容参数缺失' })
    mocks.fetch.mockResolvedValueOnce(new Response(
      JSON.stringify({ code: 0, data: { message: 'not SSE' } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    await expect(sendChatStream('hi')).rejects.toMatchObject({ kind: 'contract' })
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
  })

  it('does not accept missing done, broken frames or an unreadable stream', async () => {
    mocks.fetch.mockResolvedValueOnce(stream('data: {"type":"text","content":"中断"}\n\n'))
    await expect(sendChatStream('hi')).rejects.toMatchObject({ kind: 'contract' })
    mocks.fetch.mockResolvedValueOnce(stream('data: {"type":"done"}\n\ndata: {"type":"done"}\n\n'))
    await expect(sendChatStream('hi')).rejects.toThrow('重复的结束帧')
    mocks.fetch.mockResolvedValueOnce(new Response(null, {
      status: 200, headers: { 'Content-Type': 'text/event-stream' },
    }))
    await expect(sendChatStream('hi')).rejects.toThrow('不可读取')
  })

  it('respects cancellation and never replays a POST after abort', async () => {
    mocks.fetch.mockImplementationOnce((_url: string, options: RequestInit) =>
      new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort',
          () => reject(new DOMException('aborted', 'AbortError')), { once: true })
      }))
    const controller = new AbortController()
    const request = sendChatStream('取消测试', { signal: controller.signal })
    await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce())
    controller.abort()
    await expect(request).rejects.toMatchObject({ kind: 'cancelled' })
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it('cancels before fetch when signature credentials resolve after abort', async () => {
    let resolveCredentials!: (value: { token: string; salt: string }) => void
    mocks.getSignature.mockReturnValueOnce(new Promise(resolve => {
      resolveCredentials = resolve
    }))
    const controller = new AbortController()
    const request = sendChatStream('取消前置签名', { signal: controller.signal })
    controller.abort()
    resolveCredentials({ token: 'upstream-token', salt: 'test-salt' })
    await expect(request).rejects.toMatchObject({ kind: 'cancelled' })
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('times out an unresponsive stream and does not issue another request', async () => {
    vi.useFakeTimers()
    mocks.fetch.mockImplementationOnce((_url: string, options: RequestInit) =>
      new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort',
          () => reject(new DOMException('aborted', 'AbortError')), { once: true })
      }))
    const request = sendChatStream('超时测试', { timeoutMs: 40 })
    const assertion = expect(request).rejects.toMatchObject({ kind: 'timeout' })
    await vi.advanceTimersByTimeAsync(40)
    await assertion
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it('aborts when the signed-in account changes mid-stream', async () => {
    mocks.fetch.mockImplementationOnce((_url: string, options: RequestInit) =>
      new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort',
          () => reject(new DOMException('aborted', 'AbortError')), { once: true })
      }))
    const request = sendChatStream('账号切换')
    await vi.waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce())
    mocks.getSession.mockReturnValue({ accessToken: 'other-token', userInfo: null })
    window.dispatchEvent(new Event('dr-card-ui:auth-session-changed'))
    await expect(request).rejects.toMatchObject({ kind: 'cancelled' })
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it('bootstraps session when missing before sending the only POST', async () => {
    mocks.getSession.mockReturnValue(undefined as unknown as { accessToken: string; userInfo: null })
    mocks.bootstrap.mockImplementationOnce(async () => {
      const session = { accessToken: 'new-token', userInfo: null }
      mocks.getSession.mockReturnValue(session)
      return session
    })
    mocks.fetch.mockResolvedValueOnce(stream('data: {"type":"done"}\n\n'))
    await expect(sendChatStream('hello')).resolves.toMatchObject({ mode: 'ai', text: '' })
    expect(mocks.bootstrap).toHaveBeenCalledOnce()
    expect(mocks.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer new-token')
  })

  it('validates length before network access and never puts secrets in thrown error details', async () => {
    await expect(sendChatStream('  ')).rejects.toMatchObject({ kind: 'business' })
    await expect(sendChatStream('x'.repeat(5001))).rejects.toMatchObject({ kind: 'business' })
    expect(mocks.fetch).not.toHaveBeenCalled()
    mocks.fetch.mockRejectedValueOnce(new Error('network failed with token secret-token'))
    let failure: unknown
    try { await sendChatStream('hello') } catch (error) { failure = error }
    expect(failure).toMatchObject({ kind: 'network' })
    expect(JSON.stringify(failure)).not.toContain('secret-token')
  })
})

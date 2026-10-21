import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppError } from '../http'
import {
  MALL_SHOPS,
  SSO_PROTOCOL,
  SSO_VERSION,
  createMallSsoBridge,
  isSsoMessageFresh,
  mapSsoTicketErrorCode,
  parseSsoMessage,
  resolveMallTarget,
  type MallSsoBridge,
} from './mallSso'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
}))

vi.mock('../http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../http')>()
  return { ...actual, httpClient: { request: mocks.request } }
})

interface FakeIframe {
  iframe: HTMLIFrameElement
  frame: Window
  postMessage: ReturnType<typeof vi.fn>
}

function createFakeIframe(): FakeIframe {
  const postMessage = vi.fn()
  const frame = { postMessage } as unknown as Window
  return {
    iframe: { contentWindow: frame } as unknown as HTMLIFrameElement,
    frame,
    postMessage,
  }
}

function requestMessage(overrides: Record<string, unknown> = {}, payload: Record<string, unknown> = {}) {
  return {
    protocol: SSO_PROTOCOL,
    version: SSO_VERSION,
    type: 'SSO.REQUEST',
    requestId: 'sso_1790000000000_ab12cd34',
    timestamp: Date.now(),
    payload: { target: 'kbs_shop', ...payload },
    ...overrides,
  }
}

function dispatch(data: unknown, origin: string, source: MessageEventSource | null) {
  window.dispatchEvent(
    new MessageEvent('message', {
      data,
      origin,
      source,
    }),
  )
}

const ticketEnvelope = {
  code: 0,
  msg: 'success',
  status: 'succ',
  data: { ticket: 't'.repeat(40), expiresIn: 30 },
}

describe('mall SSO 配置', () => {
  it('binds each target to the exact shop origin and configured entry', () => {
    expect(MALL_SHOPS.kbs_shop).toEqual({
      origin: 'https://kbs-shop.3cgroup.cn',
      url: 'https://kbs-shop.3cgroup.cn/',
    })
    expect(MALL_SHOPS.kbs_shop2).toEqual({
      origin: 'https://kbs-shop2.3cgroup.cn',
      url: 'https://kbs-shop2.3cgroup.cn/h5',
    })
  })

  it('defaults to kbs_shop and rejects unknown build targets', () => {
    expect(resolveMallTarget(undefined)).toBe('kbs_shop')
    expect(resolveMallTarget('  ')).toBe('kbs_shop')
    expect(resolveMallTarget('kbs_shop2')).toBe('kbs_shop2')
    expect(() => resolveMallTarget('kbs_shop3')).toThrow('VITE_MALL_TARGET')
  })
})

describe('mall SSO 消息校验', () => {
  it('accepts a complete envelope and rejects malformed ones', () => {
    const valid = requestMessage()
    expect(parseSsoMessage(valid)).toMatchObject({
      protocol: SSO_PROTOCOL,
      version: SSO_VERSION,
      type: 'SSO.REQUEST',
      requestId: valid.requestId,
    })

    expect(parseSsoMessage({ ...valid, protocol: 'OTHER' })).toBeNull()
    expect(parseSsoMessage({ ...valid, version: '2.0' })).toBeNull()
    expect(parseSsoMessage({ ...valid, requestId: 'short' })).toBeNull()
    expect(parseSsoMessage({ ...valid, requestId: 'bad id with spaces' })).toBeNull()
    expect(parseSsoMessage({ ...valid, timestamp: 'now' })).toBeNull()
    expect(parseSsoMessage({ ...valid, payload: [] })).toBeNull()
    expect(parseSsoMessage(null)).toBeNull()
  })

  it('only accepts recent messages', () => {
    const now = 1_790_000_000_000
    expect(isSsoMessageFresh(now, now + 60_000)).toBe(true)
    expect(isSsoMessageFresh(now, now + 6 * 60_000)).toBe(false)
  })

  it('maps A API failures to stable SSO error codes', () => {
    expect(
      mapSsoTicketErrorCode(
        new AppError({ kind: 'http', message: 'HTTP 401', status: 401 }),
      ),
    ).toBe('SSO_UNAUTHORIZED')
    expect(
      mapSsoTicketErrorCode(
        new AppError({ kind: 'http', message: 'HTTP 403', status: 403 }),
      ),
    ).toBe('SSO_FORBIDDEN')
    expect(
      mapSsoTicketErrorCode(new AppError({ kind: 'timeout', message: 'timeout' })),
    ).toBe('SSO_TIMEOUT')
    expect(mapSsoTicketErrorCode(new Error('boom'))).toBe('SSO_INTERNAL_ERROR')
  })
})

describe('createMallSsoBridge', () => {
  let bridge: MallSsoBridge | undefined

  beforeEach(() => {
    mocks.request.mockReset()
    mocks.request.mockResolvedValue(ticketEnvelope)
  })

  afterEach(() => {
    bridge?.dispose()
    bridge = undefined
  })

  it('requests a ticket for the configured target and replies to that iframe only', async () => {
    const fake = createFakeIframe()
    bridge = createMallSsoBridge(fake.iframe, 'kbs_shop')

    dispatch(requestMessage(), MALL_SHOPS.kbs_shop.origin, fake.frame)

    await vi.waitFor(() => expect(fake.postMessage).toHaveBeenCalledTimes(1))

    expect(mocks.request).toHaveBeenCalledWith({
      method: 'POST',
      url: '/api/sso/tickets',
      data: {
        target: 'kbs_shop',
        requestId: 'sso_1790000000000_ab12cd34',
      },
      timeout: 10_000,
    })
    expect(fake.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SSO.TICKET',
        requestId: 'sso_1790000000000_ab12cd34',
        payload: { ticket: 't'.repeat(40), expiresIn: 30 },
      }),
      MALL_SHOPS.kbs_shop.origin,
    )
  })

  it('rejects messages from another origin', () => {
    const fake = createFakeIframe()
    bridge = createMallSsoBridge(fake.iframe, 'kbs_shop')

    dispatch(requestMessage(), 'https://kbs-shop2.3cgroup.cn', fake.frame)

    expect(mocks.request).not.toHaveBeenCalled()
    expect(fake.postMessage).not.toHaveBeenCalled()
  })

  it('rejects messages from another window even with the right origin', () => {
    const fake = createFakeIframe()
    const otherFrame = { postMessage: vi.fn() } as unknown as Window
    bridge = createMallSsoBridge(fake.iframe, 'kbs_shop')

    dispatch(requestMessage(), MALL_SHOPS.kbs_shop.origin, otherFrame)

    expect(mocks.request).not.toHaveBeenCalled()
    expect(fake.postMessage).not.toHaveBeenCalled()
  })

  it('rejects a forged target from the wrong shop iframe', () => {
    const fake = createFakeIframe()
    bridge = createMallSsoBridge(fake.iframe, 'kbs_shop')

    dispatch(
      requestMessage({}, { target: 'kbs_shop2' }),
      MALL_SHOPS.kbs_shop.origin,
      fake.frame,
    )

    expect(mocks.request).not.toHaveBeenCalled()
  })

  it('processes a requestId only once', async () => {
    const fake = createFakeIframe()
    bridge = createMallSsoBridge(fake.iframe, 'kbs_shop')

    dispatch(requestMessage(), MALL_SHOPS.kbs_shop.origin, fake.frame)
    dispatch(requestMessage(), MALL_SHOPS.kbs_shop.origin, fake.frame)

    await vi.waitFor(() => expect(fake.postMessage).toHaveBeenCalledTimes(1))
    expect(mocks.request).toHaveBeenCalledTimes(1)
  })

  it('drops stale requests without asking the backend', () => {
    const fake = createFakeIframe()
    bridge = createMallSsoBridge(fake.iframe, 'kbs_shop')

    dispatch(
      requestMessage({ timestamp: Date.now() - 6 * 60_000 }),
      MALL_SHOPS.kbs_shop.origin,
      fake.frame,
    )

    expect(mocks.request).not.toHaveBeenCalled()
    expect(fake.postMessage).not.toHaveBeenCalled()
  })

  it('returns SSO_UNAUTHORIZED when the A session is rejected', async () => {
    mocks.request.mockRejectedValue(
      new AppError({ kind: 'http', message: 'HTTP 401', status: 401 }),
    )
    const fake = createFakeIframe()
    bridge = createMallSsoBridge(fake.iframe, 'kbs_shop')

    dispatch(requestMessage(), MALL_SHOPS.kbs_shop.origin, fake.frame)

    await vi.waitFor(() =>
      expect(fake.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SSO.ERROR',
          payload: expect.objectContaining({ code: 'SSO_UNAUTHORIZED' }),
        }),
        MALL_SHOPS.kbs_shop.origin,
      ),
    )
  })

  it('does not reply after the bridge is disposed', async () => {
    let resolveRequest: ((value: unknown) => void) | undefined
    mocks.request.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )
    const fake = createFakeIframe()
    bridge = createMallSsoBridge(fake.iframe, 'kbs_shop')

    dispatch(requestMessage(), MALL_SHOPS.kbs_shop.origin, fake.frame)
    await vi.waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(1))

    bridge.dispose()
    resolveRequest?.(ticketEnvelope)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fake.postMessage).not.toHaveBeenCalled()
  })

  it('surfaces SSO.RESULT and SSO.ERROR callbacks', () => {
    const fake = createFakeIframe()
    const onSsoResult = vi.fn()
    const onSsoError = vi.fn()
    bridge = createMallSsoBridge(fake.iframe, 'kbs_shop', { onSsoResult, onSsoError })

    dispatch(
      {
        protocol: SSO_PROTOCOL,
        version: SSO_VERSION,
        type: 'SSO.RESULT',
        requestId: 'sso_1790000000000_ab12cd34',
        timestamp: Date.now(),
        payload: { success: true, code: 'SSO_SUCCESS' },
      },
      MALL_SHOPS.kbs_shop.origin,
      fake.frame,
    )
    expect(onSsoResult).toHaveBeenCalledWith({ success: true, code: 'SSO_SUCCESS' })

    dispatch(
      {
        protocol: SSO_PROTOCOL,
        version: SSO_VERSION,
        type: 'SSO.ERROR',
        requestId: 'sso_1790000000000_ab12cd34',
        timestamp: Date.now(),
        payload: { code: 'SSO_TICKET_EXPIRED', message: '登录凭证已失效' },
      },
      MALL_SHOPS.kbs_shop.origin,
      fake.frame,
    )
    expect(onSsoError).toHaveBeenCalledWith({
      code: 'SSO_TICKET_EXPIRED',
      message: '登录凭证已失效',
    })
  })
})

import { z } from 'zod'

import { runtimePolicy } from '../../app/config/runtime'
import { parseApiEnvelope } from '../contracts/apiEnvelope'
import { AppError, httpClient, isAppError } from '../http'

/**
 * A 站（https://kbs.3cgroup.cn）嵌入商城 B 的 postMessage SSO 客户端。
 *
 * 协议事实源：C:\SINGING\kbs\docs\postMessage登录对接文档-kbs商城.md
 * - B 发起 SSO.REQUEST，A 申请一次性 Ticket 后回 SSO.TICKET；
 * - A 只传 Ticket，不传 A 的 JWT；
 * - target 由当前 iframe 的配置决定，绝不采用消息里的 target 作为实际目标。
 */

export const MALL_TARGETS = ['kbs_shop', 'kbs_shop2'] as const
export type MallTarget = (typeof MALL_TARGETS)[number]

export interface MallShop {
  /** 精确 Origin，不带路径和末尾斜杠。 */
  origin: string
  /** 商城正式入口；商城换地址时只改这里。 */
  url: string
}

export const MALL_SHOPS: Record<MallTarget, MallShop> = {
  kbs_shop: {
    origin: 'https://kbs-shop.3cgroup.cn',
    url: 'https://kbs-shop.3cgroup.cn/h5',
  },
  kbs_shop2: {
    origin: 'https://kbs-shop2.3cgroup.cn',
    url: 'https://kbs-shop2.3cgroup.cn/h5',
  },
}

export const DEFAULT_MALL_TARGET: MallTarget = 'kbs_shop'

export const SSO_PROTOCOL = 'APP_EMBED_SSO'
export const SSO_VERSION = '1.0'
export const SSO_REQUEST_MAX_AGE_MS = 5 * 60 * 1000

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/
const MAX_HANDLED_REQUEST_IDS = 50

export interface SsoMessage {
  protocol: typeof SSO_PROTOCOL
  version: typeof SSO_VERSION
  type: string
  requestId: string
  timestamp: number
  payload: Record<string, unknown>
}

export interface MallSsoResult {
  success: boolean
  code: string
}

export interface MallSsoError {
  code: string
  message: string
}

export interface MallSsoBridgeOptions {
  onSsoResult?: (result: MallSsoResult) => void
  onSsoError?: (error: MallSsoError) => void
}

export interface MallSsoBridge {
  dispose: () => void
}

const ticketSchema = z.object({
  ticket: z.string().min(20).max(2048),
  expiresIn: z.number().int().positive(),
})

export type MallSsoTicket = z.infer<typeof ticketSchema>

export function isMallTarget(value: unknown): value is MallTarget {
  return typeof value === 'string' && (MALL_TARGETS as readonly string[]).includes(value)
}

/**
 * 商城目标来自部署配置，默认 kbs_shop。
 * 非法值直接失败，避免生产构建悄悄落到错误商城。
 */
export function resolveMallTarget(
  raw: string | undefined = import.meta.env.VITE_MALL_TARGET,
): MallTarget {
  const value = raw?.trim()
  if (!value) return DEFAULT_MALL_TARGET
  if (isMallTarget(value)) return value
  throw new Error(
    `Unknown VITE_MALL_TARGET=${value}. Expected one of: ${MALL_TARGETS.join(', ')}.`,
  )
}

/** 校验不可信的 postMessage 数据；结构不合法时不回复、不兑换。 */
export function parseSsoMessage(input: unknown): SsoMessage | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null

  const value = input as Record<string, unknown>
  if (value.protocol !== SSO_PROTOCOL) return null
  if (value.version !== SSO_VERSION) return null
  if (typeof value.type !== 'string' || !value.type) return null
  if (typeof value.requestId !== 'string' || !REQUEST_ID_PATTERN.test(value.requestId)) return null
  if (typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp)) return null
  if (!value.payload || typeof value.payload !== 'object' || Array.isArray(value.payload)) return null

  return {
    protocol: SSO_PROTOCOL,
    version: SSO_VERSION,
    type: value.type,
    requestId: value.requestId,
    timestamp: value.timestamp,
    payload: value.payload as Record<string, unknown>,
  }
}

export function isSsoMessageFresh(timestamp: number, now = Date.now()): boolean {
  return Math.abs(now - timestamp) <= SSO_REQUEST_MAX_AGE_MS
}

/** A 后端 /api 错误体沿用项目业务码，这里按 HTTP 状态映射成 SSO 协议错误码。 */
export function mapSsoTicketErrorCode(error: unknown): string {
  if (!isAppError(error)) return 'SSO_INTERNAL_ERROR'
  if (error.status === 401) return 'SSO_UNAUTHORIZED'
  if (error.status === 403) return 'SSO_FORBIDDEN'
  if (error.kind === 'timeout') return 'SSO_TIMEOUT'
  return 'SSO_INTERNAL_ERROR'
}

function publicErrorMessage(code: string): string {
  switch (code) {
    case 'SSO_UNAUTHORIZED':
      return '主站登录状态不可用，请重新登录'
    case 'SSO_FORBIDDEN':
      return '当前账号无权访问该商城'
    case 'SSO_TIMEOUT':
      return '登录凭证申请超时，请重试'
    default:
      return '商城登录暂不可用，请稍后重试'
  }
}

/**
 * 申请一次性 Ticket。
 *
 * Mock 预览没有 A 的真实登录态，明确失败而不是伪造 Ticket；
 * API 模式下由 httpClient 统一附加 Bearer、timesp/token/secstr。
 */
export async function requestMallTicket(
  target: MallTarget,
  requestId: string,
): Promise<MallSsoTicket> {
  if (runtimePolicy.dataMode === 'mock') {
    throw new AppError({
      kind: 'configuration',
      code: 'SSO_MOCK_MODE',
      message: 'Mock 预览模式不签发真实商城 Ticket',
    })
  }

  const payload = await httpClient.request<unknown>({
    method: 'POST',
    url: '/api/sso/tickets',
    data: { target, requestId },
    timeout: 10_000,
  })

  return parseApiEnvelope(payload, ticketSchema, {
    contract: 'sso.ticket',
    fallbackMessage: '商城登录凭证申请失败',
  })
}

function sendToMall(
  iframe: HTMLIFrameElement,
  target: MallTarget,
  type: string,
  requestId: string,
  payload: Record<string, unknown>,
) {
  const frame = iframe.contentWindow
  if (!frame) return

  frame.postMessage(
    {
      protocol: SSO_PROTOCOL,
      version: SSO_VERSION,
      type,
      requestId,
      timestamp: Date.now(),
      payload,
    },
    MALL_SHOPS[target].origin,
  )
}

/**
 * 把某个商城 iframe 接入 SSO。
 *
 * 必须在 iframe 开始加载前调用（页面先挂载 iframe，再在 effect 中建桥并设置 src），
 * 否则 B 初始化后立即发出的 SSO.REQUEST 可能丢失。
 */
export function createMallSsoBridge(
  iframe: HTMLIFrameElement,
  target: MallTarget,
  options: MallSsoBridgeOptions = {},
): MallSsoBridge {
  const shop = MALL_SHOPS[target]
  const handledRequestIds = new Set<string>()
  let disposed = false

  const rememberRequestId = (requestId: string) => {
    handledRequestIds.add(requestId)
    if (handledRequestIds.size <= MAX_HANDLED_REQUEST_IDS) return
    const oldest = handledRequestIds.values().next().value
    if (oldest) handledRequestIds.delete(oldest)
  }

  const handleRequest = async (message: SsoMessage) => {
    // target 只认当前 iframe 的配置；payload.target 仅用于确认双方认知一致。
    if (message.payload.target !== target) return
    if (handledRequestIds.has(message.requestId)) return
    rememberRequestId(message.requestId)

    try {
      const ticket = await requestMallTicket(target, message.requestId)
      if (disposed) return
      sendToMall(iframe, target, 'SSO.TICKET', message.requestId, ticket)
    } catch (error) {
      if (disposed) return
      const code = mapSsoTicketErrorCode(error)
      console.warn('[mall-sso] ticket request failed', {
        target,
        requestId: message.requestId,
        code,
      })
      sendToMall(iframe, target, 'SSO.ERROR', message.requestId, {
        code,
        message: publicErrorMessage(code),
      })
    }
  }

  const onMessage = (event: MessageEvent) => {
    // 两个商城同时存在时，origin 与 source 必须同时命中当前 iframe。
    if (event.origin !== shop.origin) return
    const frame = iframe.contentWindow
    if (!frame || event.source !== frame) return

    const message = parseSsoMessage(event.data)
    if (!message) return
    if (!isSsoMessageFresh(message.timestamp)) return

    if (message.type === 'SSO.REQUEST') {
      void handleRequest(message)
      return
    }

    if (message.type === 'SSO.RESULT') {
      if (typeof message.payload.success !== 'boolean') return
      options.onSsoResult?.({
        success: message.payload.success,
        code: typeof message.payload.code === 'string' ? message.payload.code : '',
      })
      return
    }

    if (message.type === 'SSO.ERROR') {
      if (typeof message.payload.code !== 'string') return
      options.onSsoError?.({
        code: message.payload.code,
        message:
          typeof message.payload.message === 'string'
            ? message.payload.message
            : publicErrorMessage(message.payload.code),
      })
    }
  }

  window.addEventListener('message', onMessage)

  return {
    dispose: () => {
      disposed = true
      window.removeEventListener('message', onMessage)
    },
  }
}

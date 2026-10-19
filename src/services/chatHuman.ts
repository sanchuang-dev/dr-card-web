import { io, type Socket } from 'socket.io-client'
import { runtimePolicy } from '../app/config/runtime'
import { getApiSignatureCredentials, getAuthSession, refreshChatAuthAfterUnauthorized } from './auth/session'
import { chatRecordSchema, type BackendChatRecord } from './chatMessages'
import { AppError, createBusinessError, createContractError } from './http'
import { signCardApiUrl } from './http/apiSignature'

export const CHAT_TRANSFER_PATH = '/api/chatmessages/transfer'
const transferResultSchema = { mode: 'human' } as const

export type ChatSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'unauthorized'
export interface ChatSocketEvents {
  onStatus(status: ChatSocketStatus, detail?: string): void
  onMessage(message: BackendChatRecord): void
  onConnected(reconnected: boolean): void
}

export interface ChatSocketHandle { disconnect(): void; connected(): boolean }

/** Socket is RECEIVE ONLY; it must never send user chat messages. */
export function connectChatSocket(token: string, callbacks: ChatSocketEvents): ChatSocketHandle {
  if (!token) throw new AppError({ kind: 'http', status: 401, message: '请先登录' })
  const base = runtimePolicy.apiBaseUrl
  if (!base) throw new AppError({ kind: 'configuration', message: '客服连接地址尚未配置' })
  const socket: Socket = io(new URL(base).origin, {
    auth: { token },
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    timeout: 8000,
    // No token in URL/query; backend authenticates socket.handshake.auth.token
  })
  let ended = false
  let connectedBefore = false
  let unauthorized = false
  const status = (value: ChatSocketStatus, detail?: string) => {
    if (!ended) callbacks.onStatus(value, detail)
  }
  const failAuth = () => {
    if (ended || unauthorized) return
    unauthorized = true
    status('unauthorized', '登录凭证已失效，请重新登录')
    socket.io.reconnection(false)
    socket.disconnect()
  }
  socket.on('connect', () => {
    if (ended || unauthorized) return
    const reconnected = connectedBefore
    connectedBefore = true
    status('connected')
    callbacks.onConnected(reconnected)
  })
  socket.on('chat:message', raw => {
    if (ended || unauthorized) return
    const parsed = chatRecordSchema.safeParse(raw)
    if (parsed.success) callbacks.onMessage(parsed.data)
    // Invalid server pushes are ignored, never rendered as another account's chat.
  })
  socket.on('error', payload => {
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? String(payload.message) : 'Socket.IO 服务错误'
    if (/登录|token|auth|401|unauthor/i.test(message)) failAuth()
    else status('disconnected', '实时客服连接发生错误，正在尝试恢复')
  })
  socket.on('connect_error', error => {
    if (/登录|token|auth|401|unauthor/i.test(error.message)) failAuth()
    else status('disconnected', '实时客服暂时无法连接，正在尝试恢复')
  })
  socket.on('disconnect', reason => {
    if (ended || unauthorized) return
    status('disconnected', reason === 'io server disconnect'
      ? '客服连接被服务器断开，请重新进入页面'
      : '实时客服连接中断，正在尝试恢复')
    if (reason === 'io server disconnect') socket.connect()
  })
  status('connecting')
  socket.connect()
  return {
    connected: () => !ended && !unauthorized && socket.connected,
    disconnect: () => {
      ended = true
      socket.removeAllListeners()
      socket.io.reconnection(false)
      socket.disconnect()
    },
  }
}

export async function transferChatToHuman(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new AppError({ kind: 'cancelled', message: '人工转接已取消' })
  const token = getAuthSession()?.accessToken
  const base = runtimePolicy.apiBaseUrl
  if (!token) throw new AppError({ kind: 'http', status: 401, message: '请先登录' })
  if (!base) throw new AppError({ kind: 'configuration', message: '人工客服接口未配置' })
  // Complete signature preflight before entering the network-only error handler.
  // Missing Native credentials cannot be mistaken for an uncertain transfer.
  const credentials = await getApiSignatureCredentials()
  const url = signCardApiUrl(base.replace(/\/+$/, '').replace(/\/api$/, '') + CHAT_TRANSFER_PATH,
    undefined, {}, credentials)
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, salt: credentials.salt, 'Content-Type': 'application/json',
        Accept: 'application/json' },
      body: JSON.stringify({}),
      signal,
      credentials: 'omit',
    })
  } catch (error) {
    if (signal?.aborted) throw new AppError({ kind: 'cancelled', message: '人工转接已取消' })
    throw new AppError({ kind: 'network', message: '人工转接请求失败，请检查历史后决定是否重试',
      cause: error })
  }
  // A gateway may send a bare 401, HTML or an empty body; do not let JSON parsing
  // suppress authentication recovery. A non-idempotent transfer is never replayed.
  let payload: unknown = null
  try { payload = await response.json() } catch { /* non-JSON gateway error */ }
  const value = payload && typeof payload === 'object'
    ? payload as { code?: unknown; msg?: unknown; message?: unknown; data?: unknown } : null
  if (response.status === 401 || value?.code === 401 || value?.code === '401') {
    await refreshChatAuthAfterUnauthorized().catch(() => undefined)
    throw new AppError({ kind: 'http', status: 401,
      message: '登录已过期，人工转接结果待确认，请检查聊天历史' })
  }
  if (!response.ok) {
    throw new AppError({ kind: 'http', status: response.status,
      message: typeof value?.message === 'string' ? value.message : '人工转接服务暂不可用' })
  }
  if (!value) throw createContractError('人工转接响应无效')
  if (value.code !== 0 && value.code !== '0') {
    throw createBusinessError(typeof value.message === 'string' ? value.message
      : typeof value.msg === 'string' ? value.msg : '人工转接未完成')
  }
  if (!value.data || typeof value.data !== 'object' ||
      (value.data as typeof transferResultSchema).mode !== 'human') {
    throw createContractError('人工转接未返回 human 状态')
  }
}

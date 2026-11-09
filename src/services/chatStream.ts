import { runtimePolicy } from '../app/config/runtime'
import { bootstrapAuthSession, getApiSignatureCredentials, getAuthSession, refreshChatAuthAfterUnauthorized } from './auth/session'
import { AppError, createBusinessError, createContractError } from './http'
import { signCardApiUrl } from './http/apiSignature'
import { ChatSseDecoder, type ChatSseFrame } from './chatSse'

export const CHAT_ADD_PATH = '/api/chatmessages/add'
export const CHAT_STREAM_TIMEOUT_MS = 120_000
const MAX_REPLY_LENGTH = 1024 * 1024

export interface ChatStreamOptions {
  signal?: AbortSignal
  timeoutMs?: number
  onDelta?: (text: string) => void
  onMode?: (mode: 'human') => void
}
export type ChatStreamResult =
  | { mode: 'ai'; text: string; messageId?: number }
  | { mode: 'human'; text: '' }

function parseErrorEnvelope(raw: unknown): { code?: string; message?: string } {
  if (!raw || typeof raw !== 'object') return {}
  const payload = raw as Record<string, unknown>
  const code = typeof payload.code === 'string' || typeof payload.code === 'number' ? String(payload.code) : undefined
  const message = typeof payload.message === 'string' ? payload.message
    : typeof payload.msg === 'string' ? payload.msg : undefined
  return { code, message: message?.slice(0, 250) }
}

/** Non-idempotent POST: failures never automatically retry; check history before resending. */
export async function sendChatStream(content: string, options: ChatStreamOptions = {}): Promise<ChatStreamResult> {
  const message = content.trim()
  if (!message || message.length > 5000) throw createBusinessError('消息内容须为 1–5000 字')
  if (options.signal?.aborted) throw new AppError({ kind: 'cancelled', message: '客服发送已取消' })
  const timeout = options.timeoutMs ?? CHAT_STREAM_TIMEOUT_MS
  if (!Number.isFinite(timeout) || timeout <= 0) throw createContractError('客服流超时参数无效')
  const base = runtimePolicy.apiBaseUrl ??
    (runtimePolicy.dataMode === 'mock' && typeof window !== 'undefined' ? window.location.origin : null)
  if (!base) throw new AppError({ kind: 'configuration', message: '客服 API 地址未配置' })

  const controller = new AbortController()
  let timedOut = false
  let sessionChanged = false
  let authToken = ''
  const cancel = () => controller.abort()
  const onSessionChange = () => {
    if (authToken && getAuthSession()?.accessToken !== authToken) {
      sessionChanged = true
      controller.abort()
    }
  }
  options.signal?.addEventListener('abort', cancel, { once: true })
  const timeoutHandle = setTimeout(() => { timedOut = true; controller.abort() }, timeout)
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    const session = getAuthSession() ?? await bootstrapAuthSession()
    authToken = session.accessToken
    if (!authToken) throw new AppError({ kind: 'http', status: 401, message: '请先登录' })
    if (controller.signal.aborted) throw new AppError({ kind: 'cancelled', message: '客服发送已取消' })
    window.addEventListener('dr-card-ui:auth-session-changed', onSessionChange)
    window.addEventListener('dr-card-ui:auth-session-cleared', onSessionChange)
    const body = { content: message, msg_type: 1 }
    const credentials = await getApiSignatureCredentials()
    // Native credential resolution may complete after cancellation or account switch.
    if (controller.signal.aborted || getAuthSession()?.accessToken !== authToken) {
      throw new AppError({ kind: 'cancelled', message: '客服发送已取消或账号已变化' })
    }
    const url = signCardApiUrl(base.replace(/\/+$/, '').replace(/\/api$/, '') + CHAT_ADD_PATH,
      undefined, body, credentials)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        salt: credentials.salt,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      credentials: 'omit',
    })

    if (!response.ok || !response.headers.get('content-type')?.toLowerCase().includes('text/event-stream')) {
      const raw: unknown = await response.json().catch(() => null)
      const error = parseErrorEnvelope(raw)
      if (response.status === 401 || error.code === '401') {
        // Refresh credentials, but NEVER repeat the non-idempotent POST.
        await refreshChatAuthAfterUnauthorized().catch(() => {})
        throw new AppError({ kind: 'http', code: '401', status: 401, message: '登录已过期，请检查历史后重新发送' })
      }
      if (!response.ok) throw new AppError({
        kind: 'http', status: response.status, code: error.code,
        message: error.message ?? `客服请求失败（HTTP ${response.status}）`,
      })
      if (error.code && error.code !== '0') {
        throw createBusinessError(error.message ?? '客服请求失败', { code: error.code })
      }
      throw createContractError('客服接口未返回流式响应')
    }
    if (!response.body) throw createContractError('客服流式响应不可读取')

    reader = response.body.getReader()
    const parser = new ChatSseDecoder()
    let reply = ''
    let human = false
    let terminal = false
    let messageId: number | undefined
    const process = (frames: ChatSseFrame[]) => {
      for (const frame of frames) {
        if (terminal) throw createContractError('客服流出现重复的结束帧')
        switch (frame.type) {
          case 'text':
            if (human) throw createContractError('人工模式不能同时接收 AI 回复')
            reply += frame.content
            if (reply.length > MAX_REPLY_LENGTH) throw createContractError('客服回复超出安全长度')
            options.onDelta?.(frame.content)
            break
          case 'human':
            if (reply) throw createContractError('AI 回复与人工模式状态冲突')
            human = true
            options.onMode?.('human')
            break
          case 'error':
            throw createBusinessError(frame.message || '客服暂不可用', { code: 'CHAT_STREAM_ERROR' })
          case 'done':
            terminal = true
            messageId = frame.message_id
            break
        }
      }
    }
    while (!terminal) {
      const { done, value } = await reader.read()
      if (done) { process(parser.finish()); break }
      if (value) process(parser.push(value))
    }
    if (!terminal) throw createContractError('客服流在完成帧前断开，请检查历史后再决定是否重发')
    return human ? { mode: 'human', text: '' } : { mode: 'ai', text: reply, ...(messageId ? { messageId } : {}) }
  } catch (error) {
    if (timedOut) throw new AppError({ kind: 'timeout', message: '客服回复超时，请检查历史后再决定是否重发' })
    // A server 401 may trigger our own auth refresh, which clears the old session.
    // Preserve the authoritative 401 error instead of misreporting it as user cancellation.
    if (error instanceof AppError && error.status === 401) throw error
    if (sessionChanged) throw new AppError({ kind: 'cancelled', message: '账号已变化，客服发送中止' })
    if (options.signal?.aborted) throw new AppError({ kind: 'cancelled', message: '客服发送已取消' })
    if (controller.signal.aborted && !(error instanceof AppError)) {
      throw new AppError({ kind: 'cancelled', message: '客服发送已取消' })
    }
    if (error instanceof AppError) throw error
    throw new AppError({ kind: 'network', message: '客服连接中断，请检查历史后再决定是否重发' })
  } finally {
    clearTimeout(timeoutHandle)
    options.signal?.removeEventListener('abort', cancel)
    if (typeof window !== 'undefined') {
      window.removeEventListener('dr-card-ui:auth-session-changed', onSessionChange)
      window.removeEventListener('dr-card-ui:auth-session-cleared', onSessionChange)
    }
    if (reader) {
      try { await reader.cancel() } catch { /* already ended */ }
      try { reader.releaseLock() } catch { /* already released */ }
    }
  }
}

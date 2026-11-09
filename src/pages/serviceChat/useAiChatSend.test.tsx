import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { combineChatMessages, useAiChatSend } from './useAiChatSend'
import type { ChatHistoryMessage } from '../../services/chatMessages'
import { AppError } from '../../services/http'

const mocks = vi.hoisted(() => ({ token: 'token-A', send: vi.fn() }))
vi.mock('../../services/auth/session', () => ({
  getAuthSession: () => ({ accessToken: mocks.token, userInfo: null }),
  isApiSignaturePreflightError: (error: unknown) =>
    error instanceof Error && 'code' in error &&
    ['AUTH_SIGNATURE_CREDENTIALS_MISSING', 'AUTH_NATIVE_CREDENTIALS_INVALID',
      'AUTH_NATIVE_CREDENTIALS_UNAVAILABLE'].includes(String(error.code)),
}))
vi.mock('../../services/chatStream', () => ({ sendChatStream: mocks.send }))
const message = (id: number, role: 'bot' | 'user' = 'bot', text = '回复'): ChatHistoryMessage => ({
  id: String(id), role, text, status: 'sent', kind: role === 'bot' ? 'service' : 'user',
  msgType: 1, createdAt: '2026-10-09 10:00:00',
})
beforeEach(() => { mocks.token = 'token-A'; mocks.send.mockReset() })
afterEach(() => mocks.send.mockReset())

describe('#137 AI stream UI state machine', () => {
  it('renders delta incrementally, blocks double submission, and reconciles by server message ID', async () => {
    let complete!: (value: { mode: 'ai'; text: string; messageId: number }) => void
    let push!: (delta: string) => void
    mocks.send.mockImplementationOnce((_content, options) =>
      new Promise(resolve => {
        push = options.onDelta
        complete = resolve
      }))
    const sync = vi.fn().mockResolvedValue([message(42, 'bot', '你好')])
    const hook = renderHook(() => useAiChatSend(sync))
    let first!: Promise<boolean>
    await act(async () => {
      first = hook.result.current.send('你好?', [message(30)])
    })
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(hook.result.current.phase).toBe('sending')
    await act(async () => { push('你'); push('好') })
    expect(hook.result.current.phase).toBe('streaming')
    expect(hook.result.current.messages.find(m => m.role === 'bot')?.text).toBe('你好')
    await act(async () => {
      expect(await hook.result.current.send('第二条', [message(30)])).toBe(false)
    })
    expect(mocks.send).toHaveBeenCalledTimes(1)
    await act(async () => { complete({ mode: 'ai', text: '你好', messageId: 42 }); await first })
    expect(sync).toHaveBeenCalledTimes(1)
    expect(hook.result.current.messages).toEqual([])
    expect(hook.result.current.phase).toBe('idle')
    hook.unmount()
  })

  it('reconciles bare done without message_id when both messages exist in server history', async () => {
    mocks.send.mockImplementationOnce(async (_content, options) => {
      options.onDelta?.('真实回答')
      return { mode: 'ai', text: '真实回答' }
    })
    const sync = vi.fn().mockResolvedValue([
      message(35, 'user', '问题'),
      message(36, 'bot', '真实回答'),
    ])
    const hook = renderHook(() => useAiChatSend(sync))
    await act(async () => { await hook.result.current.send('问题', [message(31)]) })
    expect(hook.result.current.messages).toEqual([])
    expect(hook.result.current.phase).toBe('idle')
    expect(hook.result.current.error).toBeNull()
    hook.unmount()
  })

  it('removes only persisted bubbles if missing-id completion is not fully confirmed', async () => {
    mocks.send.mockImplementationOnce(async (_content, options) => {
      options.onDelta?.('尚未落库')
      return { mode: 'ai', text: '尚未落库' }
    })
    const sync = vi.fn().mockResolvedValue([message(35, 'user', '问题')])
    const hook = renderHook(() => useAiChatSend(sync))
    await act(async () => { await hook.result.current.send('问题', [message(31)]) })
    expect(hook.result.current.phase).toBe('failed')
    expect(hook.result.current.error).toContain('检查聊天历史')
    expect(hook.result.current.messages.map(m => m.role)).toEqual(['bot'])
    expect(hook.result.current.messages[0]?.text).toBe('尚未落库')
    hook.unmount()
  })

  it.each([
    'AUTH_SIGNATURE_CREDENTIALS_MISSING',
    'AUTH_NATIVE_CREDENTIALS_INVALID',
    'AUTH_NATIVE_CREDENTIALS_UNAVAILABLE',
  ])('marks unsent user bubble failed on %s without claiming delivery', async code => {
    mocks.send.mockRejectedValueOnce(new AppError({
      kind: 'contract', code, message: 'Native 签名凭据不可用',
    }))
    const sync = vi.fn()
    const hook = renderHook(() => useAiChatSend(sync))
    await act(async () => {
      expect(await hook.result.current.send('未发出去的消息', [])).toBe(false)
    })
    expect(hook.result.current.phase).toBe('failed')
    expect(hook.result.current.error).toBe('Native 签名凭据不可用')
    expect(hook.result.current.messages).toEqual([
      expect.objectContaining({ role: 'user', text: '未发出去的消息', status: 'failed' }),
    ])
    expect(sync).not.toHaveBeenCalled()
    expect(mocks.send).toHaveBeenCalledTimes(1)
    hook.unmount()
  })

  it('retains uncertain server results with an explicit history check, not silent resend', async () => {
    mocks.send.mockResolvedValueOnce({ mode: 'ai', text: '完成', messageId: 42 })
    const sync = vi.fn().mockResolvedValueOnce(null)
    const hook = renderHook(() => useAiChatSend(sync))
    await act(async () => { await hook.result.current.send('是否有券', []) })
    expect(hook.result.current.phase).toBe('failed')
    expect(hook.result.current.error).toContain('检查聊天历史')
    expect(hook.result.current.messages).toHaveLength(1)
    await act(async () => {
      expect(await hook.result.current.send('重发', [])).toBe(false)
    })
    expect(mocks.send).toHaveBeenCalledOnce()
    act(() => hook.result.current.clear())
    expect(hook.result.current.phase).toBe('idle')
    hook.unmount()
  })

  it('does not fabricate a seat and still sends subsequent messages through SSE', async () => {
    mocks.send.mockImplementationOnce(async (_content, options) => {
      options.onMode?.('human')
      return { mode: 'human', text: '' }
    })
    const sync = vi.fn().mockResolvedValueOnce([message(32, 'user', '转人工')])
    const hook = renderHook(() => useAiChatSend(sync))
    await act(async () => { await hook.result.current.send('转人工', [message(20)]) })
    expect(hook.result.current.humanAwait).toBe(true)
    expect(hook.result.current.phase).toBe('human')
    expect(hook.result.current.blocked).toBe(false)
    expect(hook.result.current.messages).toEqual([])
    hook.unmount()
  })

  it('does not silently leave backend human mode when checking history after send failure', async () => {
    const sync = vi.fn().mockResolvedValueOnce(null)
    const hook = renderHook(() => useAiChatSend(sync))
    act(() => hook.result.current.activateHuman())
    mocks.send.mockRejectedValueOnce(new Error('人工模式发言网络中断'))
    await act(async () => { await hook.result.current.send('转人工后的一条留言', []) })
    expect(hook.result.current.phase).toBe('failed')
    expect(hook.result.current.humanAwait).toBe(true)
    act(() => hook.result.current.clear())
    expect(hook.result.current.phase).toBe('human')
    expect(hook.result.current.humanAwait).toBe(true)
    expect(hook.result.current.messages).toEqual([])
    expect(hook.result.current.error).toBeNull()
    hook.unmount()
  })

  it('cancels in-flight requests and never retries or shows a guessed success', async () => {
    let observedSignal!: AbortSignal
    mocks.send.mockImplementationOnce((_content, options) => {
      observedSignal = options.signal
      return new Promise(() => {})
    })
    const hook = renderHook(() => useAiChatSend(vi.fn()))
    await act(async () => { void hook.result.current.send('需要帮助', []) })
    act(() => hook.result.current.cancel())
    expect(observedSignal.aborted).toBe(true)
    expect(hook.result.current.phase).toBe('failed')
    expect(hook.result.current.error).toContain('避免重复发送')
    expect(mocks.send).toHaveBeenCalledTimes(1)
    hook.unmount()
  })

  it('drops previous account pending bubbles and late responses', async () => {
    let complete!: (value: { mode: 'ai'; text: string; messageId: number }) => void
    mocks.send.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    const sync = vi.fn().mockResolvedValue([])
    const hook = renderHook(() => useAiChatSend(sync))
    await act(async () => { void hook.result.current.send('A用户问题', []) })
    expect(hook.result.current.messages).toHaveLength(1)
    await act(async () => {
      mocks.token = 'token-B'
      window.dispatchEvent(new Event('dr-card-ui:auth-session-changed'))
    })
    expect(hook.result.current.messages).toEqual([])
    await act(async () => { complete({ mode: 'ai', text: 'A的回答', messageId: 1 }) })
    expect(hook.result.current.messages).toEqual([])
    expect(sync).not.toHaveBeenCalled()
    hook.unmount()
  })

  it('retains a content-free warning when re-authentication clears and replaces the session mid-POST', async () => {
    let complete!: (value: { mode: 'ai'; text: string; messageId: number }) => void
    mocks.send.mockImplementationOnce(() => new Promise(resolve => { complete = resolve }))
    const hook = renderHook(() => useAiChatSend(vi.fn()))
    await act(async () => { void hook.result.current.send('仅A用户可见的敏感问题', []) })
    expect(hook.result.current.messages).toHaveLength(1)

    await act(async () => {
      mocks.token = ''
      window.dispatchEvent(new Event('dr-card-ui:auth-session-cleared'))
    })
    expect(hook.result.current.messages).toEqual([])
    expect(hook.result.current.phase).toBe('failed')
    expect(hook.result.current.error).toContain('检查聊天历史')
    expect(hook.result.current.error).not.toContain('敏感问题')
    await act(async () => {
      mocks.token = 'refreshed-token'
      window.dispatchEvent(new Event('dr-card-ui:auth-session-changed'))
    })
    expect(hook.result.current.messages).toEqual([])
    expect(hook.result.current.error).toContain('检查聊天历史')
    await act(async () => { complete({ mode: 'ai', text: '旧用户回复', messageId: 32 }) })
    expect(hook.result.current.messages).toEqual([])
    expect(hook.result.current.error).not.toContain('敏感问题')
    act(() => hook.result.current.clear())
    expect(hook.result.current.phase).toBe('idle')
    hook.unmount()
  })

  it('deduplicates confirmed server AI bubbles against transient bubbles by ID', () => {
    const official = message(50, 'bot', '服务器的回答')
    const transient = { id: '50', role: 'bot' as const, text: '流中回答', status: 'sent' as const }
    const local = { id: 'local-user-1', role: 'user' as const, text: '新问题', status: 'sending' as const }
    expect(combineChatMessages([official], [transient, local])).toEqual([official, local])
  })
})

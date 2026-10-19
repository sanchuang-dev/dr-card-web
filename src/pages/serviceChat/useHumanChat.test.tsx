import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useHumanChat } from './useHumanChat'
import type { ChatSocketEvents } from '../../services/chatHuman'
import { AppError } from '../../services/http'

const mocks = vi.hoisted(() => ({
  token: 'user-a-token', events: null as ChatSocketEvents | null,
  connect: vi.fn(), transfer: vi.fn(), disconnect: vi.fn(), connected: true,
}))
vi.mock('../../services/auth/session', () => ({
  getAuthSession: () => mocks.token ? { accessToken: mocks.token } : undefined,
  isApiSignaturePreflightError: (error: unknown) =>
    error instanceof Error && 'code' in error &&
    ['AUTH_SIGNATURE_CREDENTIALS_MISSING', 'AUTH_NATIVE_CREDENTIALS_INVALID',
      'AUTH_NATIVE_CREDENTIALS_UNAVAILABLE'].includes(String(error.code)),
}))
vi.mock('../../services/chatHuman', () => ({
  connectChatSocket: mocks.connect,
  transferChatToHuman: mocks.transfer,
}))
const fakeRecord = {
  id: 25, user_id: '9', sender_id: '0', content: '人工客服回复', msg_type: 1, create_time: 1790000000,
}
beforeEach(() => {
  mocks.token = 'user-a-token'
  mocks.events = null; mocks.connected = true
  mocks.connect.mockReset().mockImplementation((_token, events: ChatSocketEvents) => {
    mocks.events = events
    return { disconnect: mocks.disconnect, connected: () => mocks.connected }
  })
  mocks.disconnect.mockReset(); mocks.transfer.mockReset().mockResolvedValue(undefined)
})

describe('#138 human chat connection, transfer, and lifecycle', () => {
  it('connects, synchronizes history and receives real server pushes', async () => {
    const receive = vi.fn()
    const sync = vi.fn().mockResolvedValue(true)
    const onTransferred = vi.fn()
    const hook = renderHook(() => useHumanChat(receive, sync, 22, onTransferred))
    expect(mocks.connect).toHaveBeenCalledWith('user-a-token', expect.any(Object))
    await act(async () => { mocks.events?.onStatus('connected'); mocks.events?.onConnected(false) })
    expect(hook.result.current.status).toBe('connected')
    expect(sync).toHaveBeenCalledWith(22)
    act(() => mocks.events?.onMessage(fakeRecord))
    expect(receive).toHaveBeenCalledWith(fakeRecord)
    hook.unmount()
    expect(mocks.disconnect).toHaveBeenCalled()
  })

  it('does not report initial-history-loading as a failed reconnect', async () => {
    const sync = vi.fn().mockResolvedValue(false)
    const hook = renderHook(() => useHumanChat(vi.fn(), sync, 0, vi.fn()))
    await act(async () => {
      mocks.events?.onStatus('connected')
      mocks.events?.onConnected(false)
    })
    expect(sync).toHaveBeenCalled()
    expect(hook.result.current.error).toBeNull()
    await act(async () => { mocks.events?.onConnected(true) })
    expect(hook.result.current.error).toContain('重连后历史同步未完成')
    hook.unmount()
  })

  it('only sends HTTP transfer when socket is connected, backend confirms it and blocks duplicates', async () => {
    const onTransferred = vi.fn()
    const hook = renderHook(() => useHumanChat(vi.fn(), vi.fn().mockResolvedValue(true), 10, onTransferred))
    await act(async () => { expect(await hook.result.current.transfer()).toBe(false) })
    expect(mocks.transfer).not.toHaveBeenCalled()
    act(() => mocks.events?.onStatus('connected'))
    await act(async () => { expect(await hook.result.current.transfer()).toBe(true) })
    expect(mocks.transfer).toHaveBeenCalledOnce()
    expect(onTransferred).toHaveBeenCalledOnce()
    expect(hook.result.current.active).toBe(true)
    await act(async () => { expect(await hook.result.current.transfer()).toBe(false) })
    expect(mocks.transfer).toHaveBeenCalledOnce()
    hook.unmount()
  })

  it('preserves backend refusal without falsely claiming an agent exists', async () => {
    mocks.transfer.mockRejectedValueOnce(new Error('无服务'))
    const hook = renderHook(() => useHumanChat(vi.fn(), vi.fn().mockResolvedValue(true), 0, vi.fn()))
    act(() => mocks.events?.onStatus('connected'))
    await act(async () => { expect(await hook.result.current.transfer()).toBe(false) })
    expect(hook.result.current.active).toBe(false)
    expect(hook.result.current.error).toContain('无服务')
    hook.unmount()
  })

  it.each([
    'AUTH_SIGNATURE_CREDENTIALS_MISSING',
    'AUTH_NATIVE_CREDENTIALS_INVALID',
    'AUTH_NATIVE_CREDENTIALS_UNAVAILABLE',
  ])('shows %s as a preflight error without an uncertain-transfer warning', async code => {
    mocks.transfer.mockRejectedValueOnce(new AppError({
      kind: 'contract', code, message: 'Native 登录凭据缺少 token 或 salt',
    }))
    const onTransferred = vi.fn()
    const hook = renderHook(() => useHumanChat(vi.fn(), vi.fn().mockResolvedValue(true), 0, onTransferred))
    act(() => mocks.events?.onStatus('connected'))
    await act(async () => { expect(await hook.result.current.transfer()).toBe(false) })
    expect(hook.result.current.active).toBe(false)
    expect(hook.result.current.needsHistoryCheck).toBe(false)
    expect(hook.result.current.error).toBe('Native 登录凭据缺少 token 或 salt')
    expect(hook.result.current.canTransfer).toBe(true)
    expect(onTransferred).not.toHaveBeenCalled()
    hook.unmount()
  })

  it('retains a content-free uncertain-transfer warning across 401 auth reset', async () => {
    const onTransferred = vi.fn()
    mocks.transfer.mockImplementationOnce(async () => {
      mocks.token = ''
      window.dispatchEvent(new Event('dr-card-ui:auth-session-cleared'))
      throw new Error('HTTP 401')
    })
    const hook = renderHook(() => useHumanChat(vi.fn(), vi.fn().mockResolvedValue(true), 0, onTransferred))
    act(() => mocks.events?.onStatus('connected'))
    await act(async () => { expect(await hook.result.current.transfer()).toBe(false) })
    expect(hook.result.current.needsHistoryCheck).toBe(true)
    expect(hook.result.current.error).toContain('转接结果尚未确认')
    expect(hook.result.current.error).not.toContain('user-a-token')
    expect(onTransferred).not.toHaveBeenCalled()
    await act(async () => {
      mocks.token = 'refreshed-token'
      window.dispatchEvent(new Event('dr-card-ui:auth-session-changed'))
    })
    act(() => mocks.events?.onStatus('connected'))
    expect(hook.result.current.needsHistoryCheck).toBe(true)
    expect(hook.result.current.canTransfer).toBe(false)
    act(() => hook.result.current.acknowledgeHistory())
    expect(hook.result.current.needsHistoryCheck).toBe(false)
    expect(hook.result.current.error).toBeNull()
    hook.unmount()
  })

  it('disconnects old socket on token rotation and ignores late old user pushes', async () => {
    const receive = vi.fn()
    const hook = renderHook(() => useHumanChat(receive, vi.fn().mockResolvedValue(true), 10, vi.fn()))
    const previous = mocks.events
    await act(async () => {
      mocks.token = 'user-b-token'
      window.dispatchEvent(new Event('dr-card-ui:auth-session-changed'))
    })
    await waitFor(() => expect(mocks.connect).toHaveBeenCalledTimes(2))
    expect(mocks.disconnect).toHaveBeenCalled()
    act(() => previous?.onMessage(fakeRecord))
    expect(receive).not.toHaveBeenCalled()
    hook.unmount()
  })

  it('flags unauthorized and does not claim the socket is live', () => {
    const hook = renderHook(() => useHumanChat(vi.fn(), vi.fn().mockResolvedValue(true), 0, vi.fn()))
    act(() => mocks.events?.onStatus('unauthorized', '请重新登录'))
    expect(hook.result.current.status).toBe('unauthorized')
    expect(hook.result.current.canTransfer).toBe(false)
    hook.unmount()
  })

  it('aborts pending transfer and never reports success after leaving the page', async () => {
    let settle!: () => void
    mocks.transfer.mockImplementationOnce(() => new Promise(resolve => { settle = () => resolve(undefined) }))
    const confirm = vi.fn()
    const hook = renderHook(() => useHumanChat(vi.fn(), vi.fn(), 0, confirm))
    act(() => mocks.events?.onStatus('connected'))
    await act(async () => { void hook.result.current.transfer() })
    hook.unmount()
    await act(async () => settle())
    expect(confirm).not.toHaveBeenCalled()
  })
})

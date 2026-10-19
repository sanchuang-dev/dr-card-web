import { useCallback, useEffect, useRef, useState } from 'react'
import { getAuthSession, isApiSignaturePreflightError } from '../../services/auth/session'
import { connectChatSocket, transferChatToHuman, type ChatSocketHandle, type ChatSocketStatus } from '../../services/chatHuman'
import type { BackendChatRecord } from '../../services/chatMessages'

type State = {
  key: string
  status: ChatSocketStatus
  active: boolean
  transferring: boolean
  error: string | null
  syncing: boolean
  needsHistoryCheck: boolean
}

const tokenKey = () => getAuthSession()?.accessToken ?? ''
const initial = (key = tokenKey()): State => ({
  key, status: 'disconnected', active: false, transferring: false, error: null, syncing: false, needsHistoryCheck: false,
})

/** Owns exactly one live socket per active auth session and component lifetime. */
export function useHumanChat(
  acceptPush: (message: BackendChatRecord) => void,
  syncMissed: (sinceId: number) => Promise<boolean>,
  latestHistoryId: number,
  onTransferred: () => void,
) {
  const [snapshot, setSnapshot] = useState<State>(() => initial())
  const currentToken = tokenKey()
  const state = snapshot.key === currentToken ? snapshot : initial(currentToken)
  const [session, setSession] = useState(currentToken)
  const client = useRef<ChatSocketHandle | null>(null)
  const request = useRef<AbortController | null>(null)
  const locking = useRef(false)
  const authInterrupted = useRef(false)
  const generation = useRef(0)
  const handlers = useRef({ acceptPush, syncMissed })
  handlers.current = { acceptPush, syncMissed }
  const latest = useRef(latestHistoryId)
  latest.current = Math.max(latest.current, latestHistoryId)

  useEffect(() => {
    const onChange = () => {
      // A transfer may have reached the backend before auth refresh clears the token.
      // Discard account-specific messages, but retain a content-free uncertainty warning.
      if (locking.current) authInterrupted.current = true
      const key = tokenKey()
      setSnapshot({
        ...initial(key),
        ...(authInterrupted.current ? {
          needsHistoryCheck: true,
          error: '登录状态已变化，人工转接结果尚未确认，请先检查聊天历史，避免重复转接',
        } : {}),
      })
      setSession(key)
    }
    window.addEventListener('dr-card-ui:auth-session-changed', onChange)
    window.addEventListener('dr-card-ui:auth-session-cleared', onChange)
    return () => {
      window.removeEventListener('dr-card-ui:auth-session-changed', onChange)
      window.removeEventListener('dr-card-ui:auth-session-cleared', onChange)
    }
  }, [])

  useEffect(() => {
    const epoch = ++generation.current
    request.current?.abort()
    request.current = null
    locking.current = false
    client.current?.disconnect()
    client.current = null
    latest.current = latestHistoryId
    setSnapshot({
      ...initial(session),
      ...(authInterrupted.current ? {
        needsHistoryCheck: true,
        error: '登录状态已变化，人工转接结果尚未确认，请先检查聊天历史，避免重复转接',
      } : {}),
    })
    if (!session) return
    const alive = () => generation.current === epoch && tokenKey() === session
    try {
      const socket = connectChatSocket(session, {
        onStatus: (status, detail) => {
          if (!alive()) return
          setSnapshot(old => ({
            ...old, key: session, status,
            error: old.needsHistoryCheck ? old.error : status === 'connected' ? null : detail ?? null,
            active: status === 'unauthorized' ? false : old.active,
          }))
        },
        onMessage: message => {
          if (!alive()) return
          handlers.current.acceptPush(message)
          latest.current = Math.max(latest.current, message.id)
        },
        onConnected: (reconnected) => {
          if (!alive()) return
          const sinceId = latest.current
          setSnapshot(old => ({ ...old, syncing: true }))
          void handlers.current.syncMissed(sinceId).then(ok => {
            if (!alive()) return
            setSnapshot(old => ({
              ...old, syncing: false,
              error: old.needsHistoryCheck ? old.error : ok ? null : reconnected ? '重连后历史同步未完成，请手动刷新历史确认是否有漏消息' : old.error,
            }))
          })
        },
      })
      client.current = socket
    } catch {
      setSnapshot(old => ({ ...old, status: 'disconnected', error: '人工客服连接无法建立' }))
    }
    return () => {
      generation.current++
      request.current?.abort()
      client.current?.disconnect()
      client.current = null
      locking.current = false
    }
  }, [session])

  const transfer = useCallback(async (): Promise<boolean> => {
    const key = tokenKey()
    if (locking.current || !key || snapshot.key !== key || snapshot.active || snapshot.needsHistoryCheck ||
        snapshot.status !== 'connected' || !client.current?.connected()) return false
    locking.current = true
    const epoch = generation.current
    const controller = new AbortController()
    request.current = controller
    setSnapshot(old => ({ ...old, transferring: true, error: null }))
    try {
      await transferChatToHuman(controller.signal)
      if (generation.current !== epoch || tokenKey() !== key) return false
      // A backend mode switch is not proof that an agent is actually online.
      setSnapshot(old => ({ ...old, active: true, transferring: false, error: null }))
      onTransferred()
      void syncMissed(latest.current)
      return true
    } catch (error) {
      if (generation.current !== epoch || tokenKey() !== key) return false
      // Only these signature preflight failures guarantee that no HTTP transfer was sent.
      // Keep the history-check guard for failures after the network request may have started.
      const noRequestSent = isApiSignaturePreflightError(error)
      if (!noRequestSent) authInterrupted.current = true
      setSnapshot(old => ({
        ...old, transferring: false, needsHistoryCheck: !noRequestSent,
        error: noRequestSent
          ? error.message
          : (error instanceof Error ? error.message : '转人工失败') +
            '。如请求已经送达，请先检查历史，避免重复转接。',
      }))
      return false
    } finally {
      if (generation.current === epoch) {
        locking.current = false
        request.current = null
      }
    }
  }, [snapshot, syncMissed, onTransferred])

  const acknowledgeHistory = useCallback(() => {
    authInterrupted.current = false
    setSnapshot(old => old.key === tokenKey()
      ? { ...old, needsHistoryCheck: false, error: null } : initial())
  }, [])

  const confirmAiMode = useCallback(() => {
    setSnapshot(old => old.key === tokenKey() && old.active
      ? { ...old, active: false } : old)
  }, [])

  const refresh = useCallback(() => {
    const token = tokenKey()
    // Explicit user retry after failed socket auth/connect; never retry unauthorized automatically.
    client.current?.disconnect()
    client.current = null
    setSession('')
    queueMicrotask(() => setSession(token))
  }, [])

  return {
    ...state, transfer, refresh, confirmAiMode, acknowledgeHistory,
    canTransfer: state.status === 'connected' && !state.active && !state.transferring && !state.needsHistoryCheck,
  }
}

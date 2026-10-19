import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../../app/fixtures'
import { getAuthSession, isApiSignaturePreflightError } from '../../services/auth/session'
import type { ChatHistoryMessage } from '../../services/chatMessages'
import { sendChatStream } from '../../services/chatStream'

type Phase = 'idle' | 'sending' | 'streaming' | 'syncing' | 'failed' | 'human'
type State = {
  token: string
  messages: ChatMessage[]
  phase: Phase
  error: string | null
  humanAwait: boolean
}
const tokenKey = () => getAuthSession()?.accessToken ?? ''
const blank = (token = tokenKey()): State => ({
  token, messages: [], phase: 'idle', error: null, humanAwait: false,
})
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : '客服通信失败'
const CHECK_HISTORY = '本次消息可能已保存，请先检查聊天历史，避免重复发送。'

/** Pending bubbles exist only for this mounted session. Backend history is authoritative. */
export function useAiChatSend(syncLatest: () => Promise<ChatHistoryMessage[] | null>) {
  const [snapshot, setSnapshot] = useState<State>(() => blank())
  const state = snapshot.token === tokenKey() ? snapshot : blank()
  const controller = useRef<AbortController | null>(null)
  const locked = useRef(false)
  const generation = useRef(0)
  const sequence = useRef(0)
  const authInterrupted = useRef(false)
  const mounted = useRef(true)

  const clear = useCallback((preserveMode = true) => {
    generation.current++
    authInterrupted.current = false
    controller.current?.abort()
    controller.current = null
    locked.current = false
    if (mounted.current) setSnapshot(previous => {
      const next = blank()
      // Checking history must not silently switch a confirmed human session to AI.
      // Auth/account changes always drop the previous account's human mode instead.
      return preserveMode && previous.token === next.token && previous.humanAwait
        ? { ...next, humanAwait: true, phase: 'human' } : next
    })
  }, [])

  useEffect(() => {
    mounted.current = true
    const onAuthChange = () => {
      // Re-authentication and a genuine account switch both invalidate private bubbles.
      // Keep ONLY a content-free warning across transient token loss/new token events,
      // or a 401-cleared session would hide the uncertain-delivery warning entirely.
      const interrupted = locked.current || authInterrupted.current
      clear(false)
      if (interrupted) {
        authInterrupted.current = true
        setSnapshot({
          ...blank(), phase: 'failed',
          error: '登录状态变化，当前消息结果尚未确认。' + CHECK_HISTORY,
        })
      }
    }
    window.addEventListener('dr-card-ui:auth-session-changed', onAuthChange)
    window.addEventListener('dr-card-ui:auth-session-cleared', onAuthChange)
    return () => {
      mounted.current = false
      generation.current++
      controller.current?.abort()
      locked.current = false
      window.removeEventListener('dr-card-ui:auth-session-changed', onAuthChange)
      window.removeEventListener('dr-card-ui:auth-session-cleared', onAuthChange)
    }
  }, [clear])

  const send = useCallback(async (
    input: string, existingHistory: readonly ChatHistoryMessage[],
  ): Promise<boolean> => {
    const text = input.trim()
    const key = tokenKey()
    if (!text || text.length > 5000 || !key || locked.current ||
      snapshot.token !== key || snapshot.phase === 'failed') return false

    locked.current = true
    const id = ++sequence.current
    const userId = `local-user-${id}`
    const botId = `local-bot-${id}`
    const requestRevision = ++generation.current
    const abort = new AbortController()
    controller.current = abort
    const highestBefore = Math.max(0, ...existingHistory.map(message => Number(message.id)))
    const alive = () => mounted.current && generation.current === requestRevision && tokenKey() === key
    const update = (fn: (value: State) => State) => {
      if (!alive()) return
      setSnapshot(previous => previous.token === key ? fn(previous) : previous)
    }

    update(previous => ({
      ...previous, phase: 'sending', error: null,
      messages: [...previous.messages, { id: userId, role: 'user', text, status: 'sending' }],
    }))
    try {
      const result = await sendChatStream(text, {
        signal: abort.signal,
        onDelta: (delta) => update(previous => {
          const bubble = previous.messages.find(message => message.id === botId)
          return {
            ...previous, phase: 'streaming',
            messages: bubble
              ? previous.messages.map(item => item.id === botId ? { ...item, text: item.text + delta } : item)
              : [...previous.messages, { id: botId, role: 'bot', text: delta, status: 'sent' }],
          }
        }),
        onMode: () => update(previous => ({ ...previous, humanAwait: true, phase: 'human' })),
      })
      if (!alive()) return false
      update(previous => ({
        ...previous, phase: 'syncing',
        messages: previous.messages.map(item => item.id === userId
          ? { ...item, status: 'sent' }
          : result.mode === 'ai' && item.id === botId && result.messageId
            ? { ...item, id: String(result.messageId) } : item),
      }))

      const latest = await syncLatest()
      if (!alive()) return false
      // Backend emits done.message_id for AI, but the SSE envelope permits a bare
      // done. Reconcile missing IDs against the server's new persisted messages
      // before deciding delivery is uncertain; never show duplicate optimistic bubbles.
      const matchedUser = Boolean(latest?.some(item =>
        item.role === 'user' && item.text === text && Number(item.id) > highestBefore))
      const matchedBot = result.mode === 'ai' && Boolean(latest?.some(item =>
        item.role === 'bot' && item.text === result.text && Number(item.id) > highestBefore))
      const confirmed = result.mode === 'ai'
        ? Boolean(result.messageId
          ? latest?.some(item => item.id === String(result.messageId))
          : matchedUser && matchedBot)
        : matchedUser
      if (confirmed) {
        update(previous => ({
          ...previous, messages: [], error: null,
          phase: result.mode === 'human' ? 'human' : 'idle',
          humanAwait: result.mode === 'human',
        }))
      } else {
        update(previous => ({
          ...previous, phase: 'failed',
          humanAwait: result.mode === 'human',
          messages: previous.messages.filter(item =>
            !(matchedUser && item.id === userId) && !(matchedBot && item.id === botId)),
          error: '消息已发送，但最新历史尚未确认。' + CHECK_HISTORY,
        }))
      }
      return true
    } catch (error) {
      if (!alive()) return false
      // Signature preflight happens before fetch; the optimistic message was never sent.
      // All other failures retain the history-check warning and no-auto-retry guard.
      const noRequestSent = isApiSignaturePreflightError(error)
      update(previous => ({
        ...previous, phase: 'failed',
        messages: previous.messages.map(item => item.id === userId
          ? { ...item, status: noRequestSent ? 'failed' : 'sent' } : item),
        error: noRequestSent ? errorText(error) : errorText(error) + '。' + CHECK_HISTORY,
      }))
      return false
    } finally {
      if (alive()) {
        controller.current = null
        locked.current = false
      }
    }
  }, [snapshot, syncLatest])

  const cancel = useCallback(() => {
    if (!locked.current) return
    const key = tokenKey()
    generation.current++
    controller.current?.abort()
    controller.current = null
    locked.current = false
    if (mounted.current) setSnapshot(previous => previous.token === key ? {
      ...previous, phase: 'failed', error: '已中止等待回复。' + CHECK_HISTORY,
      messages: previous.messages.map(item => item.role === 'user' ? { ...item, status: 'sent' } : item),
    } : blank(key))
  }, [])

  const activateHuman = useCallback(() => {
    if (!locked.current && mounted.current) setSnapshot(previous => previous.token === tokenKey()
      ? { ...previous, humanAwait: true, phase: 'human', error: null } : previous)
  }, [])

  return {
    ...state, activateHuman, busy: locked.current && state.phase !== 'failed',
    blocked: state.phase === 'failed',
    send, cancel, clear,
  }
}

/** Avoid rendering a persisted AI reply twice during eventual history reconciliation. */
export function combineChatMessages(
  history: readonly ChatMessage[], pending: readonly ChatMessage[],
): ChatMessage[] {
  const persisted = new Set(history.map(item => item.id))
  return [...history, ...pending.filter(item => !persisted.has(item.id))]
}

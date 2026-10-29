import { useEffect, useRef, useState } from 'react'
import { Send, UserRound } from 'lucide-react'
import PageContainer from '../components/mobile/PageContainer'
import ChatMessageList from '../components/mobile/ChatMessageList'
import DebugPanel from '../components/mobile/DebugPanel'
import { LoadingIndicator } from '../components/ui'
import { findRouteByPathname } from '../app/router/routes'
import { useFixtureState } from '../app/fixtures/useFixture'
import {
  CHAT_AGENT_GREETING,
  CHAT_BOT,
  CHAT_CONVERSATION_MESSAGES,
  CHAT_QUEUE,
  CHAT_SEND_LATENCY_MS,
  resolveChatSendStatus,
  type ChatMessage,
} from '../app/fixtures'

type QueueState = 'queuing' | 'connected'

export default function ServiceHuman() {
  const route = findRouteByPathname('/service/chat/human')
  const { state } = useFixtureState(route)
  const queueState: QueueState = state?.key === 'connected' ? 'connected' : 'queuing'
  const connected = queueState === 'connected'

  /** 原型 §11：智能客服历史消息保留在当前页面，接入后仅追加一条人工开场语 */
  const [extra, setExtra] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const timers = useRef<number[]>([])
  const seq = useRef(0)

  useEffect(() => {
    setExtra([])
    setDraft('')
  }, [queueState])

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])

  const messages = connected
    ? [...CHAT_CONVERSATION_MESSAGES, CHAT_AGENT_GREETING, ...extra]
    : CHAT_CONVERSATION_MESSAGES

  /**
   * 已接入态只发送并回显用户自己的消息。
   * 原型未给出坐席后续问答，故不编造回复，见 CHAT_RULE_STATUS.agentReplies。
   */
  const send = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    seq.current += 1
    const id = `human-user-${seq.current}`
    setExtra((prev) => [...prev, { id, role: 'user', text, status: 'sending' }])
    timers.current.push(
      window.setTimeout(() => {
        setExtra((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: resolveChatSendStatus(text) } : item)),
        )
      }, CHAT_SEND_LATENCY_MS),
    )
  }

  return (
    <PageContainer className="h-full !min-h-0 flex flex-col pb-0" inset={false}>
      <div className="shrink-0 px-4 pt-3" data-queue-state={queueState}>
        {connected ? (
          <div className="flex items-center gap-2.5 rounded-container bg-surface px-3.5 py-3 shadow-sm">
            <span
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-reward-subtle text-reward-text"
              aria-hidden
            >
              <UserRound className="h-5 w-5" />
            </span>
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
              {CHAT_QUEUE.connected.title}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-container bg-surface px-4 py-5 text-center shadow-sm">
            <LoadingIndicator label={CHAT_QUEUE.queuing.title} />
            <p className="text-xs text-text-tertiary">{CHAT_QUEUE.queuing.aheadText}</p>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-4" data-chat-scroll>
        {/* 历史消息仍是小诗说的，头像保持「诗」；坐席开场语自带 glyph 区分说话人 */}
        <ChatMessageList messages={messages} />
      </div>

      <div className="shrink-0 border-t border-border-subtle bg-background px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        <div className="flex items-end gap-2">
          <div className="flex min-h-11 flex-1 items-center rounded-container border-2 border-transparent bg-surface px-3 focus-within:border-border-focused">
            <input
              type="text"
              inputMode="text"
              autoComplete="off"
              value={draft}
              disabled={!connected}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  send()
                }
              }}
              placeholder={connected ? CHAT_BOT.inputPlaceholder : '接入人工客服后可继续发送'}
              aria-label="输入你的问题"
              className="h-11 w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-placeholder disabled:cursor-not-allowed"
            />
          </div>

          <button
            type="button"
            data-chat-send
            onClick={send}
            disabled={!connected || !draft.trim()}
            aria-label="发送"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-primary text-text-inverse active:bg-primary-pressed disabled:bg-disabled disabled:text-text-disabled"
          >
            <Send className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <DebugPanel route={route} />
    </PageContainer>
  )
}

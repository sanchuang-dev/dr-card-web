import { AlertCircle, RotateCcw } from 'lucide-react'
import { CHAT_BOT, CHAT_RETRY_LABEL, CHAT_SEND_FAILED_HINT, type ChatMessage } from '../../app/fixtures'
import { hasChatRichText, sanitizeChatRichText } from './safeRichText'

export interface ChatMessageListProps {
  messages: ChatMessage[]
  /** 传入后失败消息会显示重试入口；已接入的人工对话不需要则可省略 */
  onRetry?: (id: string) => void
  /** 机器人一侧的默认头像字形；单条消息带 glyph 时以消息自身为准 */
  botGlyph?: string
  className?: string
}

/**
 * 客服对话消息列表。#58 智能客服与 #70 人工客服共用，
 * 因为原型 §11 明确「智能客服历史消息保留在当前页面中，不另起完整客服系统」。
 */
export default function ChatMessageList({
  messages,
  onRetry,
  botGlyph = CHAT_BOT.glyph,
  className = '',
}: ChatMessageListProps) {
  return (
    <ul className={`flex flex-col gap-4 ${className}`} data-chat-list>
      {messages.map((message) => {
        const isBot = message.role === 'bot'
        return (
          <li
            key={message.id}
            data-chat-message
            data-chat-role={message.role}
            data-chat-status={message.status}
            className={`flex w-full min-w-0 gap-2 ${isBot ? 'justify-start' : 'justify-end'}`}
          >
            {isBot && (
              <span
                className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-reward-subtle text-xs font-semibold text-reward-text"
                aria-hidden
              >
                {message.glyph ?? botGlyph}
              </span>
            )}

            <div className={`flex min-w-0 max-w-[76%] flex-col ${isBot ? 'items-start' : 'items-end'}`}>
              <div
                data-chat-bubble
                className={`min-w-0 max-w-full whitespace-pre-wrap [overflow-wrap:anywhere] rounded-container px-3.5 py-2.5 text-sm leading-6 ${
                  isBot
                    ? 'bg-surface text-text-primary shadow-sm'
                    : `bg-primary text-text-inverse ${message.status === 'sending' ? 'opacity-70' : ''}`
                }`}
              >
                {hasChatRichText(message.text) ? (
                  <div
                    data-chat-rich-text
                    className="min-w-0 max-w-full whitespace-normal [overflow-wrap:anywhere] [&_blockquote]:border-l-2 [&_blockquote]:pl-2 [&_code]:font-mono [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                    dangerouslySetInnerHTML={{ __html: sanitizeChatRichText(message.text) }}
                  />
                ) : (
                  message.text
                )}
              </div>

              {message.status === 'sending' && (
                <span className="mt-1 text-xs text-text-tertiary" role="status">
                  发送中…
                </span>
              )}

              {message.status === 'failed' && (
                <div className="mt-1 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 flex-none text-danger" aria-hidden />
                  <span className="text-xs text-danger-text">{CHAT_SEND_FAILED_HINT}</span>
                  {onRetry && (
                    <button
                      type="button"
                      data-chat-retry
                      onClick={() => onRetry(message.id)}
                      className="ml-0.5 inline-flex min-h-8 items-center gap-1 rounded-control px-1.5 text-xs font-medium text-text-brand active:bg-surface-selected"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                      {CHAT_RETRY_LABEL}
                    </button>
                  )}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

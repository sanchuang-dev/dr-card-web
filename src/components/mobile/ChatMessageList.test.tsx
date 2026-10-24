import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ChatMessageList from './ChatMessageList'
import PageContainer from './PageContainer'

const longUrl = 'https://hexxueyantest.oss-cn-guangzhou.aliyuncs.com/storage/20261008/' + 'a'.repeat(90)

describe('ChatMessageList mobile layout', () => {
  it('constrains plain and sanitized rich-text URLs to the bubble width', () => {
    const { container } = render(
      <ChatMessageList messages={[
        { id: '1', role: 'bot', text: longUrl, status: 'sent' },
        { id: '2', role: 'user', text: longUrl, status: 'sent' },
        { id: '3', role: 'bot', text: `<p>${longUrl}</p>`, status: 'sent' },
      ]} />,
    )
    expect(screen.getAllByText(longUrl)).toHaveLength(3)
    const rows = Array.from(container.querySelectorAll('[data-chat-message]'))
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(row.className).toContain('min-w-0')
      const bubble = row.querySelector('[data-chat-bubble]')
      expect(bubble?.className).toContain('[overflow-wrap:anywhere]')
      expect(bubble?.className).toContain('max-w-full')
    }
    expect(container.querySelector('[data-chat-rich-text]')?.className).toContain('[overflow-wrap:anywhere]')
  })

  it('scrolls new messages when already near bottom but preserves history reading position', () => {
    const makeMessages = (count: number) => Array.from({ length: count }, (_, index) => ({
      id: String(index + 1), role: 'user' as const, text: `消息 ${index + 1}`, status: 'sent' as const,
    }))
    const { container, rerender } = render(
      <div data-chat-scroll style={{ height: 100, overflowY: 'auto' }}>
        <ChatMessageList messages={makeMessages(2)} />
      </div>,
    )
    const scroller = container.querySelector<HTMLElement>('[data-chat-scroll]')!
    Object.defineProperties(scroller, {
      scrollHeight: { configurable: true, value: 500 },
      clientHeight: { configurable: true, value: 100 },
    })

    // First render starts at the newest message.
    rerender(
      <div data-chat-scroll style={{ height: 100, overflowY: 'auto' }}>
        <ChatMessageList messages={makeMessages(3)} />
      </div>,
    )
    expect(scroller.scrollTop).toBe(500)

    // A reader who has scrolled up should not be forced to the bottom.
    scroller.scrollTop = 0
    fireEvent.scroll(scroller)
    rerender(
      <div data-chat-scroll style={{ height: 100, overflowY: 'auto' }}>
        <ChatMessageList messages={makeMessages(4)} />
      </div>,
    )
    expect(scroller.scrollTop).toBe(0)

    // Returning near the bottom restores follow-new-message behavior.
    scroller.scrollTop = 350
    fireEvent.scroll(scroller)
    rerender(
      <div data-chat-scroll style={{ height: 100, overflowY: 'auto' }}>
        <ChatMessageList messages={makeMessages(5)} />
      </div>,
    )
    expect(scroller.scrollTop).toBe(500)
  })


  it('follows new messages near the bottom and preserves position when reading history', () => {
    const makeMessages = (count: number) => Array.from({ length: count }, (_, index) => ({
      id: String(index + 1), role: 'user' as const, text: `消息 ${index + 1}`, status: 'sent' as const,
    }))
    let scrollHeight = 200
    const renderChat = (messages: ReturnType<typeof makeMessages>) => (
      <PageContainer className="h-full !min-h-0 min-w-0 w-full flex flex-col pb-0" inset={false}>
        <div className="shrink-0">客服标题</div>
        <section
          className="min-w-0 min-h-0 w-full flex-1 overflow-y-auto"
          data-chat-scroll
          ref={(node) => {
            if (node) {
              Object.defineProperty(node, 'clientHeight', { configurable: true, value: 100 })
              Object.defineProperty(node, 'scrollHeight', { configurable: true, get: () => scrollHeight })
            }
          }}
        >
          <ChatMessageList messages={messages} />
        </section>
        <div className="shrink-0">消息输入区</div>
      </PageContainer>
    )
    const { container, rerender } = render(renderChat(makeMessages(2)))
    const page = container.querySelector<HTMLElement>('[data-page-container]')!
    const scroller = container.querySelector<HTMLElement>('[data-chat-scroll]')!
    expect(page.className).toContain('h-full')
    expect(page.className).toContain('!min-h-0')
    expect(scroller.className).toContain('min-h-0')
    expect(scroller.className).toContain('overflow-y-auto')
    expect(scroller.scrollTop).toBe(100)

    scrollHeight = 300
    rerender(renderChat(makeMessages(3)))
    expect(scroller.scrollTop).toBe(200)

    scroller.scrollTop = 0
    fireEvent.scroll(scroller)
    scrollHeight = 400
    rerender(renderChat(makeMessages(4)))
    expect(scroller.scrollTop).toBe(0)

    scrollHeight = 500
    rerender(renderChat([{ id: '0', role: 'user', text: '更早的消息', status: 'sent' }, ...makeMessages(4)]))
    expect(scroller.scrollTop).toBe(100)
  })
})

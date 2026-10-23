import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ChatMessageList from './ChatMessageList'

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

})

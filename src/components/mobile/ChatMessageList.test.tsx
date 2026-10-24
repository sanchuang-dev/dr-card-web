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

  it('uses the constrained page-height chain for follow-bottom and history preservation', () => {
    const makeMessages = (count: number) => Array.from({ length: count }, (_, index) => ({
      id: String(index + 1), role: 'user' as const, text: `消息 ${index + 1}`, status: 'sent' as const,
    }))
    const renderChat = (count: number) => (
      <div data-page-scroll style={{ height: 800, overflowY: 'auto' }}>
        <PageContainer className="h-full !min-h-0 min-w-0 w-full flex flex-col pb-0" inset={false}>
          <div className="shrink-0">客服标题</div>
          <section className="min-w-0 min-h-0 w-full flex-1 overflow-y-auto" data-chat-scroll>
            <ChatMessageList messages={makeMessages(count)} />
          </section>
          <div className="shrink-0">消息输入区</div>
        </PageContainer>
      </div>
    )
    const { container, rerender } = render(renderChat(2))
    const page = container.querySelector<HTMLElement>('[data-page-container]')!
    const scroller = container.querySelector<HTMLElement>('[data-chat-scroll]')!
    expect(page.className).toContain('h-full')
    expect(page.className).toContain('!min-h-0')
    expect(scroller.className).toContain('min-h-0')
    expect(scroller.className).toContain('overflow-y-auto')

    Object.defineProperties(scroller, {
      scrollHeight: { configurable: true, value: 500 },
      clientHeight: { configurable: true, value: 100 },
    })

    rerender(renderChat(3))
    expect(scroller.scrollTop).toBe(500)

    scroller.scrollTop = 0
    fireEvent.scroll(scroller)
    rerender(renderChat(4))
    expect(scroller.scrollTop).toBe(0)

    scroller.scrollTop = 350
    fireEvent.scroll(scroller)
    rerender(renderChat(5))
    expect(scroller.scrollTop).toBe(500)
  })
})

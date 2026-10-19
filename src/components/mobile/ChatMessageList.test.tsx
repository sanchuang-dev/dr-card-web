import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})

// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { hasChatRichText, sanitizeChatRichText } from './safeRichText'

describe('safeRichText', () => {
  it('keeps the supported formatting subset', () => {
    const html = sanitizeChatRichText('<p>第一段<br><strong>重点</strong></p><ul><li>一项</li></ul>')

    expect(html).toContain('<p>第一段<br><strong>重点</strong></p>')
    expect(html).toContain('<ul><li>一项</li></ul>')
  })

  it('removes active content, embeds and attributes', () => {
    const html = sanitizeChatRichText(
      '<p onclick="alert(1)" style="color:red">安全文字<img src=x onerror="alert(2)"><script>alert(3)</script></p><iframe src="https://example.com"></iframe>',
    )

    expect(html).toContain('安全文字')
    expect(html).not.toMatch(/onclick|onerror|style=|<img|<script|<iframe/i)
  })

  it('does not treat ordinary angle brackets as html', () => {
    expect(hasChatRichText('1 < 2，3 > 2')).toBe(false)
    expect(hasChatRichText('<p>富文本</p>')).toBe(true)
  })

  it('drops unsupported link markup while keeping its text', () => {
    expect(sanitizeChatRichText('<a href="javascript:alert(1)">点这里</a>')).toBe('点这里')
  })
})

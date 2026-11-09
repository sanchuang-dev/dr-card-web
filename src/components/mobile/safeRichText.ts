import DOMPurify from 'dompurify'

const CHAT_RICH_TEXT_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'blockquote',
  'code',
]

const HTML_TAG_PATTERN = /<\/?[a-z][^>]*>/i

export function hasChatRichText(value: string): boolean {
  return HTML_TAG_PATTERN.test(value)
}

/**
 * Render backend rich text as a deliberately tiny, formatting-only HTML subset.
 *
 * No attributes are allowed, so links, inline styles, event handlers, images,
 * iframes and other active/embed content cannot survive sanitization.
 */
export function sanitizeChatRichText(value: string): string {
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: CHAT_RICH_TEXT_TAGS,
    ALLOWED_ATTR: [],
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false,
  })
}

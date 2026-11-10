import { md5 } from 'js-md5'

/** Card API /api/** request signing; matches backend src/middleware/auth.ts. */
export interface ApiSignatureCredentials {
  token: string
  salt: string
}

function wireValue(value: unknown): string {
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

function bodyFields(body: unknown): Record<string, unknown> {
  if (body == null) return {}
  if (body instanceof URLSearchParams) return Object.fromEntries(body.entries())
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    // Uploaded binary files aren't ordinary body fields in the backend signature middleware.
    return Object.fromEntries(Array.from(body.entries()).filter(([, v]) => typeof v === 'string'))
  }
  if (typeof body === 'string') {
    try {
      const parsed: unknown = JSON.parse(body)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown> : {}
    } catch {
      return Object.fromEntries(new URLSearchParams(body).entries())
    }
  }
  if (typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>
  return {}
}

function shanghaiTimestamp(now: Date): string {
  // Shanghai is fixed UTC+08:00; do not inherit the WebView's device timezone.
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ')
}

/** Matches server: query merged with JSON body, body takes precedence; nullish keys skipped. */
export function cardApiSecstr(params: Record<string, unknown>, salt: string): string {
  const sorted = Object.keys(params)
    .filter(key => key !== 'secstr' && key !== 'callback' && params[key] != null)
    .sort()
    .map(key => key + wireValue(params[key]))
    .join('')
  return md5(salt + sorted + salt)
}

export function signCardApiUrl(
  absoluteUrl: string,
  query: Record<string, unknown> | URLSearchParams | undefined,
  body: unknown,
  credentials: ApiSignatureCredentials,
  now: Date = new Date(),
): string {
  if (!credentials.salt?.trim()) throw new Error('Native 签名凭据缺少 salt')
  const url = new URL(absoluteUrl)
  const incoming = query instanceof URLSearchParams
    ? Object.fromEntries(query.entries())
    : query ?? {}
  for (const [key, value] of Object.entries(incoming)) {
    if (value == null) url.searchParams.delete(key)
    else url.searchParams.set(key, wireValue(value))
  }
  url.searchParams.delete('secstr')
  url.searchParams.set('timesp', shanghaiTimestamp(now))
  url.searchParams.set('token', credentials.token)
  const merged = {
    ...Object.fromEntries(url.searchParams.entries()),
    ...bodyFields(body),
    // Token and timestamp are authoritative, including for /api/oauth/login.
    token: credentials.token,
    timesp: url.searchParams.get('timesp'),
  }
  url.searchParams.set('secstr', cardApiSecstr(merged, credentials.salt))
  return url.toString()
}

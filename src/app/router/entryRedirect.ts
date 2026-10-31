import { matchPath, replace, type LoaderFunctionArgs } from 'react-router-dom'
import { ROUTES } from './routes'
import { isActiveFormalH5Route } from './routeScope'

const ENTRY_ORIGIN = 'https://h5-entry.invalid'

/**
 * Accept only active formal H5 routes from the existing registry.  Never feed an
 * untrusted URL directly into React Router's redirect response.
 */
export function resolveEntryRedirect(raw: string | null): string | null {
  if (!raw || raw.length > 2048 || !raw.startsWith('/') || raw.startsWith('//') ||
      raw.includes('\\') || /[\u0000-\u001f\u007f]/.test(raw)) return null

  let target: URL
  try {
    target = new URL(raw, ENTRY_ORIGIN)
  } catch {
    return null
  }
  if (target.origin !== ENTRY_ORIGIN || target.username || target.password) return null

  // URL normalizes ../ and encoded dot segments. Reject them instead of
  // silently routing a different path from what the host requested.
  const requestedPath = raw.split(/[?#]/, 1)[0]
  if (target.pathname !== requestedPath || /%(?:2f|5c|2e)/i.test(requestedPath)) return null
  if (requestedPath === '/' || requestedPath === '/index.html') return null

  const route = ROUTES.find((candidate) =>
    matchPath({ path: candidate.path, end: true }, target.pathname),
  )
  if (!isActiveFormalH5Route(route)) return null

  return target.pathname + target.search + target.hash
}

/** Snapshot before the initial loader replaces the OSS document URL. */
export const initialEntryRedirect = (() => {
  if (typeof window === 'undefined') return null
  const basename = import.meta.env.VITE_ROUTER_BASENAME?.replace(/\/$/, '') || ''
  const pathname = window.location.pathname
  const relativePath = basename && pathname.startsWith(basename + '/')
    ? pathname.slice(basename.length)
    : pathname
  if (relativePath !== '/' && relativePath !== '/index.html') return null
  return resolveEntryRedirect(new URLSearchParams(window.location.search).get('redirect'))
})()

/**
 * Data-router loader runs before the matched element mounts, so Home and its
 * effects never render for a valid deep-link entry.
 */
export function entryRedirectLoader({ request }: LoaderFunctionArgs) {
  const target = resolveEntryRedirect(new URL(request.url).searchParams.get('redirect'))
  return target ? replace(target) : null
}

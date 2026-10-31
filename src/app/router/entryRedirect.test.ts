import { describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'
import { createMemoryRouter } from 'react-router-dom'
import { entryRedirectLoader, resolveEntryRedirect } from './entryRedirect'
import type { LoaderFunctionArgs } from 'react-router-dom'

describe('OSS index.html redirect entry', () => {
  it('accepts active, formal H5 pages and preserves query/hash', () => {
    expect(resolveEntryRedirect('/service/chat/human')).toBe('/service/chat/human')
    expect(resolveEntryRedirect('/notifications/42?view=detail#top')).toBe('/notifications/42?view=detail#top')
  })

  it.each([
    null, '', '/', '/index.html', '//external.example/x',
    'https://external.example/', 'javascript:alert(1)', '/unknown-route',
    '/legacy-home', '/device/shower', '/mall/cart', '/__debug/bridge-lab',
    '/kbs-web/test/service/chat/human', '/service/../profile',
    '/service/%2e%2e/profile', '/notifications/1%2f2', '/service\\chat',
  ])('rejects unsafe or nonformal target %s', (target) => {
    expect(resolveEntryRedirect(target)).toBeNull()
  })

  it('returns a replace redirect response, never a client-side Home render', () => {
    const request = new Request(
      'https://example.test/index.html?redirect=%2Fservice%2Fchat%2Fhuman',
    )
    const result = entryRedirectLoader({ request, params: {}, context: {} } as LoaderFunctionArgs)
    expect(result).toBeInstanceOf(Response)
    if (!(result instanceof Response)) throw new Error('Expected response')
    expect(result.headers.get('Location')).toBe('/service/chat/human')
    expect(result.headers.get('X-Remix-Replace')).toBe('true')
  })

  it('does nothing when redirect is missing or rejected', () => {
    for (const url of [
      'https://example.test/index.html',
      'https://example.test/?redirect=https%3A%2F%2Fevil.example',
    ]) {
      const request = new Request(url)
      expect(entryRedirectLoader({ request, params: {}, context: {} } as LoaderFunctionArgs)).toBeNull()
    }
  })

  it.each(['/kbs-web/dev', '/kbs-web/test', '/kbs-web/prod/last'])(
    'honors an OSS router basename (%s) on initial replace',
    async (basename) => {
      const router = createMemoryRouter([
        { path: '/index.html', loader: entryRedirectLoader },
        { path: '/service/chat/human', element: null },
      ], {
        basename,
        initialEntries: [
          basename + '/index.html?redirect=%2Fservice%2Fchat%2Fhuman',
        ],
      })
      try {
        await waitFor(() => {
          expect(router.state.location.pathname).toBe(basename + '/service/chat/human')
          expect(router.state.errors).toBeNull()
        })
      } finally {
        router.dispose()
      }
    },
  )
})

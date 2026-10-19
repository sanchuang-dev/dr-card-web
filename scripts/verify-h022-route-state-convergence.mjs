import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createServer as createViteServer } from 'vite'

process.env.VITE_APP_ENV = 'dev'
process.env.VITE_DATA_MODE = 'mock'

const vite = await createViteServer({
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
})

try {
  const { ROUTES } = await vite.ssrLoadModule('/src/app/router/routes.ts')
  const byPath = new Map(ROUTES.map((route) => [route.path, route]))
  const route = (path) => {
    const value = byPath.get(path)
    assert.ok(value, 'missing route metadata: ' + path)
    return value
  }

  assert.equal(route('/membership').implementationKey, 'membership')
  assert.equal(route('/dearseed/membership').implementationKey, 'membership')
  assert.equal(route('/claim/success').implementationKey, 'claim-success')
  assert.equal(route('/claim/success').implementationVariant, 'campaign')
  assert.equal(route('/onboarding/success').implementationKey, 'claim-success')
  assert.equal(route('/onboarding/success').implementationVariant, 'onboarding')

  const stateFamilies = {
    '/card/verify/confirm': ['done', 'repeat'],
    '/orders': ['completed', 'ongoing', 'aftersale', 'empty'],
    '/address': ['empty'],
    '/address/new': ['invalid'],
    '/service/chat/human': ['queuing', 'connected'],
  }

  // Coupon transfer has no backend write API yet: the former fixture-only
  // "success" state must never be advertised as a business success.
  assert.ok(!(route('/card/share').states ?? []).some((state) => state.key === 'success'))

  for (const [path, expectedStates] of Object.entries(stateFamilies)) {
    const keys = new Set((route(path).states ?? []).map((state) => state.key))
    for (const state of expectedStates) {
      assert.ok(keys.has(state), path + ' must keep state "' + state + '" on the same route implementation')
    }
  }

  const routerSource = fs.readFileSync('src/app/router/index.tsx', 'utf8')
  for (const path of ['/membership', '/dearseed/membership', '/claim/success', '/onboarding/success']) {
    assert.ok(!routerSource.includes("'" + path + "': <"), path + ' must not have a duplicated path-level page entry')
  }
  assert.match(routerSource, /sharedRouteImplementations/)
  assert.match(routerSource, /route\.implementationKey/)

  console.log('H022 PASS: legal multi-URL routes resolve through shared implementations and representative prototype states remain state-driven on one route.')
} finally {
  await vite.close()
}

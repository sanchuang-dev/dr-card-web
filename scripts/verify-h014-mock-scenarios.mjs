import assert from 'node:assert/strict'
import fs from 'node:fs'
import { performance } from 'node:perf_hooks'
import { createServer as createViteServer } from 'vite'
import { setupServer } from 'msw/node'

process.env.VITE_API_BASE_URL = 'https://h014.mock.invalid'

const vite = await createViteServer({
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
})

let mockServer

try {
  const { handlers } = await vite.ssrLoadModule('/src/mocks/handlers/index.ts')
  const {
    searchBuddyByPhone,
    sendBuddyPhoneInvite,
    getBuddyPhoneInvitations,
    acceptBuddyPhoneInvitation,
  } = await vite.ssrLoadModule('/src/services/buddyPhone.ts')
  const { redeemExchangeProduct } = await vite.ssrLoadModule('/src/services/exchange.ts')
  const { fetchCouponProjects } = await vite.ssrLoadModule('/src/services/couponProjects.ts')
  const { AppError } = await vite.ssrLoadModule('/src/services/http/appError.ts')
  const {
    H014_BUDDY_PHONE_SCENARIOS,
    H014_SLOW_RESPONSE_MS,
  } = await vite.ssrLoadModule('/src/mocks/fixtures/h014Scenarios.ts')

  mockServer = setupServer(...handlers)
  mockServer.listen({ onUnhandledRequest: 'error' })

  assert.equal((await searchBuddyByPhone(H014_BUDDY_PHONE_SCENARIOS.success)).outcome, 'invitable')
  assert.equal((await searchBuddyByPhone(H014_BUDDY_PHONE_SCENARIOS.empty)).outcome, 'not-found')
  assert.equal((await searchBuddyByPhone(H014_BUDDY_PHONE_SCENARIOS.invited)).outcome, 'invited')

  await assert.rejects(
    searchBuddyByPhone(H014_BUDDY_PHONE_SCENARIOS.businessError),
    (error) => error instanceof AppError && error.kind === 'business',
  )
  await assert.rejects(
    searchBuddyByPhone(H014_BUDDY_PHONE_SCENARIOS.http4xx),
    (error) => error instanceof AppError && error.kind === 'http' && error.status === 422,
  )
  await assert.rejects(
    searchBuddyByPhone(H014_BUDDY_PHONE_SCENARIOS.http5xx),
    (error) => error instanceof AppError && error.kind === 'http' && error.status === 503,
  )
  await assert.rejects(
    searchBuddyByPhone(H014_BUDDY_PHONE_SCENARIOS.networkFailure),
    (error) => error instanceof AppError && error.kind === 'network',
  )

  const slowStartedAt = performance.now()
  assert.equal((await searchBuddyByPhone(H014_BUDDY_PHONE_SCENARIOS.slow)).outcome, 'invitable')
  assert.ok(
    performance.now() - slowStartedAt >= H014_SLOW_RESPONSE_MS - 50,
    'slow scenario must be delayed at the network handler boundary',
  )

  const newlyInvitedPhone = '13900000088'
  assert.equal((await searchBuddyByPhone(newlyInvitedPhone)).outcome, 'invitable')
  await sendBuddyPhoneInvite(newlyInvitedPhone)
  assert.equal((await searchBuddyByPhone(newlyInvitedPhone)).outcome, 'invited')

  // #111 mock-specific invitation/notification semantics; no fake backend claims.
  assert.equal((await searchBuddyByPhone(H014_BUDDY_PHONE_SCENARIOS.self)).outcome, 'self')
  assert.equal((await searchBuddyByPhone(H014_BUDDY_PHONE_SCENARIOS.alreadyBuddies)).outcome, 'already-buddies')
  const incoming = await searchBuddyByPhone(H014_BUDDY_PHONE_SCENARIOS.incoming)
  assert.equal(incoming.outcome, 'incoming-pending')
  assert.ok(incoming.invitationId)
  assert.equal((await getBuddyPhoneInvitations())[0].status, 'pending')
  assert.equal(await acceptBuddyPhoneInvitation(incoming.invitationId), 'accepted')
  assert.equal((await getBuddyPhoneInvitations())[0].status, 'completed')
  assert.equal((await searchBuddyByPhone(H014_BUDDY_PHONE_SCENARIOS.incoming)).outcome, 'already-buddies')
  assert.equal(await acceptBuddyPhoneInvitation(incoming.invitationId), 'already-buddies')

  const projects = await fetchCouponProjects('', 1)
  assert.equal(projects.per_page, 15)
  assert.equal(projects.data.length, 15)
  const matches = await fetchCouponProjects('南沙', 1)
  assert.ok(matches.data.length > 0)
  assert.ok(matches.data.every(project => project.shop_name.includes('南沙')))
  assert.deepEqual(await redeemExchangeProduct(1, projects.data[0].id), { couponId: 1, points: 1080 })

  const buddyPageSource = fs.readFileSync('src/pages/BuddyPhoneInvite.tsx', 'utf8')
  assert.doesNotMatch(buddyPageSource, /setTimeout|resolveBuddyPhoneOutcome|markPhoneInvited/)
  assert.match(buddyPageSource, /searchBuddyByPhone/)
  assert.match(buddyPageSource, /sendBuddyPhoneInvite/)

  const exchangePageSource = fs.readFileSync('src/pages/Exchange.tsx', 'utf8')
  assert.doesNotMatch(exchangePageSource, /setTimeout/)
  assert.match(exchangePageSource, /redeemExchangeProduct/)

  const buddyServiceSource = fs.readFileSync('src/services/buddyPhone.ts', 'utf8')
  const exchangeServiceSource = fs.readFileSync('src/services/exchange.ts', 'utf8')
  assert.doesNotMatch(buddyServiceSource, /runtimePolicy|VITE_DATA_MODE|mockScenario/)
  assert.doesNotMatch(exchangeServiceSource, /runtimePolicy|VITE_DATA_MODE|mockScenario/)

  console.log(
    'H014 PASS: BuddyPhoneInvite keeps deterministic H014 scenarios; Exchange uses its production /api/coupons/exchange contract through service → HTTP → MSW.',
  )
} finally {
  mockServer?.close()
  await vite.close()
}

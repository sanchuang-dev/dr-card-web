import { afterEach, describe, expect, it, vi } from 'vitest'

const live = vi.hoisted(() => ({
  mode: { dataMode: 'mock' },
  lookup: vi.fn(),
  profile: vi.fn(),
  relations: vi.fn(),
}))
vi.mock('../app/config/runtime', () => ({ runtimePolicy: live.mode }))
vi.mock('./buddyBackend', () => ({
  fetchUserByIdentifyCode: live.lookup,
  fetchBackendBuddyList: live.relations,
}))
vi.mock('./userProfile', () => ({ fetchUserProfile: live.profile }))
afterEach(() => {
  live.mode.dataMode = 'mock'
  live.lookup.mockReset()
  live.profile.mockReset()
  live.relations.mockReset()
  vi.unstubAllEnvs()
})

import {
  acceptBuddyQr,
  loadBuddyRelations,
  MOCK_BUDDY_SCAN_URL,
  previewBuddyQr,
  readBuddyScanNavigation,
  parseBuddyInviteCode,
  type BuddyRelationsBackend,
} from './buddyRelations'

const valid = 'https://card.example.org/buddy/invite/scan?token=opaque-qr-reference-12345678'
const member = { id: 'real-backend-user', nickname: '服务端姓名', avatarUrl: null }
function backend(overrides: Partial<BuddyRelationsBackend> = {}): BuddyRelationsBackend {
  return {
    trustedOrigin: 'https://card.example.org',
    previewQr: vi.fn().mockResolvedValue({ inviter: member, relationship: 'available' }),
    acceptQr: vi.fn().mockResolvedValue({ result: 'accepted' }),
    list: vi.fn().mockResolvedValue({ items: [member] }),
    ...overrides,
  }
}

describe('QR recognition and relationship backend boundary', () => {
  it('consumes only the eventual Native dedicated-QR route-state payload', () => {
    expect(readBuddyScanNavigation({ buddyScan: { source: 'native-buddy-recognition', raw: valid } })).toBe(valid)
    expect(readBuddyScanNavigation({ buddyScan: { source: 'native-verify-transaction', raw: valid } })).toBeNull()
    expect(readBuddyScanNavigation({ nativeScanCode: valid })).toBeNull()
    expect(readBuddyScanNavigation({ buddyScan: { raw: valid } })).toBeNull()
    expect(readBuddyScanNavigation({ buddyScan: { source: 'native-buddy-recognition', raw: '' } })).toBeNull()
    expect(readBuddyScanNavigation(null)).toBeNull()
  })

  it('shows labeled mock preview but never mutates any real or fixture relationship', async () => {
    const preview = await previewBuddyQr(MOCK_BUDDY_SCAN_URL)
    expect(preview).toMatchObject({ demo: true, relationship: 'available', inviter: { nickname: '演示搭子' } })
    expect(await acceptBuddyQr(MOCK_BUDDY_SCAN_URL)).toEqual({ result: 'demo-only', demo: true })
    await expect(loadBuddyRelations()).rejects.toMatchObject({ reason: 'not-configured' })
  })

  it('renders only backend-provided nickname/avatar/status and does not auto-confirm during preview', async () => {
    const api = backend()
    const preview = await previewBuddyQr(valid, api)
    expect(preview).toEqual({ demo: false, inviter: member, relationship: 'available' })
    expect(api.previewQr).toHaveBeenCalledWith(valid)
    expect(api.acceptQr).not.toHaveBeenCalled()
    expect(await acceptBuddyQr(valid, api)).toEqual({ result: 'accepted', demo: false })
    expect(api.acceptQr).toHaveBeenCalledOnce()
    expect(await loadBuddyRelations(api)).toEqual([member])
  })

  it.each(['self', 'already-buddies', 'unavailable'] as const)(
    'preserves backend relationship state %s for the UI', async status => {
      const api = backend({ previewQr: vi.fn().mockResolvedValue({ inviter: member, relationship: status }) })
      expect((await previewBuddyQr(valid, api)).relationship).toBe(status)
    },
  )

  it('rejects untrusted QR URLs and malformed business payloads', async () => {
    const api = backend()
    await expect(previewBuddyQr('http://card.example.org/buddy/invite/scan?token=opaque-qr-reference-12345678', api))
      .rejects.toMatchObject({ reason: 'invalid-code' })
    await expect(previewBuddyQr(valid, backend({ previewQr: async () => ({ nickname: 'untrusted-only' }) })))
      .rejects.toMatchObject({ reason: 'invalid-response' })
    await expect(acceptBuddyQr(valid, backend({ acceptQr: async () => ({ result: 'ok' }) })))
      .rejects.toMatchObject({ reason: 'invalid-response' })
    await expect(loadBuddyRelations(backend({ list: async () => ({ items: [{ id: 'id' }] }) })))
      .rejects.toMatchObject({ reason: 'invalid-response' })
  })

  it('turns transport failures into retryable UI errors', async () => {
    await expect(previewBuddyQr(valid, backend({ previewQr: async () => { throw new Error('timeout') } })))
      .rejects.toMatchObject({ reason: 'request-failed' })
    await expect(acceptBuddyQr(valid, backend({ acceptQr: async () => { throw new Error('network') } })))
      .rejects.toMatchObject({ reason: 'request-failed' })
  })

  it('cannot create a relationship without a configured backend', async () => {
    await expect(acceptBuddyQr(valid)).rejects.toMatchObject({ reason: 'not-configured' })
  })
})

describe('real H5 UUID invitation preview without the unsigned binding API', () => {
  const origin = 'https://kbs.3cgroup.cn'
  const uuid = '550e8400-e29b-41d4-a716-446655440000'
  const qr = `${origin}/buddy/invite/scan?code=${uuid}`

  function prepare() {
    live.mode.dataMode = 'api'
    vi.stubEnv('VITE_BUDDY_PUBLIC_ORIGIN', origin)
    live.lookup.mockResolvedValue({ id: '9', nickname: '真实邀请人', avatarUrl: null })
    live.profile.mockResolvedValue({ identifyCode: '550e8400-e29b-41d4-a716-446655440111' })
    live.relations.mockResolvedValue({ items: [] })
  }

  it('parses exactly the trusted UUID and reads real account data without any write', async () => {
    prepare()
    expect(parseBuddyInviteCode(qr, origin)).toBe(uuid)
    const preview = await previewBuddyQr(qr)
    expect(preview).toEqual({
      demo: false,
      inviter: { id: '9', nickname: '真实邀请人', avatarUrl: null },
      relationship: 'available',
      confirmationAvailable: false,
    })
    expect(live.lookup).toHaveBeenCalledWith(uuid)
    expect(live.profile).not.toHaveBeenCalled()
    expect(live.relations).not.toHaveBeenCalled()
    await expect(acceptBuddyQr(qr)).rejects.toMatchObject({ reason: 'not-configured' })
  })

  it('does not preflight the friendship or self state before showing an inviter', async () => {
    prepare()
    live.profile.mockRejectedValue(new Error('profile unavailable'))
    live.relations.mockRejectedValue(new Error('friends unavailable'))
    expect((await previewBuddyQr(qr)).relationship).toBe('available')
    expect(live.lookup).toHaveBeenCalledWith(uuid)
    expect(live.profile).not.toHaveBeenCalled()
    expect(live.relations).not.toHaveBeenCalled()
  })

  it.each([
    'http://kbs.3cgroup.cn/buddy/invite/scan?code=550e8400-e29b-41d4-a716-446655440000',
    'https://evil.3cgroup.cn/buddy/invite/scan?code=550e8400-e29b-41d4-a716-446655440000',
    'https://kbs.3cgroup.cn/buddy/invite/scan?code=invalid',
    'https://kbs.3cgroup.cn/buddy/invite/scan?code=550e8400-e29b-41d4-a716-446655440000&code=550e8400-e29b-41d4-a716-446655440111',
    'https://kbs.3cgroup.cn/buddy/invite/scan?code=550e8400-e29b-41d4-a716-446655440000&redirect=/buddy/accept',
    '550e8400-e29b-41d4-a716-446655440000',
  ])('rejects untrusted or malformed recognition, never queries the backend: %s', async raw => {
    prepare()
    await expect(previewBuddyQr(raw)).rejects.toMatchObject({ reason: 'invalid-code' })
    expect(live.lookup).not.toHaveBeenCalled()
  })

  it('fails closed on a read endpoint outage and never reports relation creation', async () => {
    prepare()
    live.lookup.mockRejectedValue(new Error('down'))
    await expect(previewBuddyQr(qr)).rejects.toMatchObject({ reason: 'request-failed' })
  })
})

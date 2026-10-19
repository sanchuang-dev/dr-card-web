import { describe, expect, it } from 'vitest'
import { cardApiSecstr, signCardApiUrl } from './apiSignature'

const SALT = 'tqNGAU30Ij5mqZycGtDYa4eKo5!CeTke'

describe('Card API secstr matches the Midway middleware', () => {
  it('reproduces both backend documentation vectors', () => {
    expect(cardApiSecstr({ page: '1', token: '', timesp: '2026-10-16 12:00:00' }, SALT))
      .toBe('994de3ccc47ee80a380637484825f7d2')
    expect(cardApiSecstr({
      phone: '13800000000', timesp: '2026-10-16 12:00:00',
      token: 'eyJhbGciOiJIUzI1NiJ9.abc',
    }, 'kbs-salt-from-login')).toBe('64693e641aca2e4f0686718ff8674a7f')
  })

  it('signs raw decoded query+body including login salt; never signs secstr/callback', () => {
    const credentials = { salt: SALT, token: 'native-token' }
    const url = new URL(signCardApiUrl('https://api.example.test/api/oauth/login?trace=a%20b&callback=ignore',
      undefined, { salt: SALT, token: 'native-token', optional: null, count: 1 },
      credentials, new Date('2026-10-16T04:00:00Z')))
    const received = Object.fromEntries(url.searchParams.entries())
    expect(received.timesp).toBe('2026-10-16 12:00:00')
    expect(received.token).toBe('native-token')
    expect(received.trace).toBe('a b')
    expect(received.secstr).toBe(cardApiSecstr({
      ...received, salt: SALT, count: 1, optional: null,
    }, SALT))
    expect(received.secstr).not.toBe(cardApiSecstr({ ...received, count: 1 }, SALT))
    expect(url.searchParams.get('callback')).toBe('ignore')
  })

  it('preserves query business fields, serializes nested POST values, and ignores nullish', () => {
    const url = new URL(signCardApiUrl('https://api.example.test/api/thing?page=1',
      { term: 'a b&c=d', unused: null, bool: false },
      { obj: { a: 1 }, list: [1, 'a'] }, { token: '', salt: SALT },
      new Date('2026-10-16T00:00:00Z')))
    expect(url.searchParams.get('term')).toBe('a b&c=d')
    expect(url.searchParams.has('unused')).toBe(false)
    const body = { obj: { a: 1 }, list: [1, 'a'] }
    expect(url.searchParams.get('secstr')).toBe(cardApiSecstr({
      ...Object.fromEntries(url.searchParams.entries()), ...body,
    }, SALT))
  })
})

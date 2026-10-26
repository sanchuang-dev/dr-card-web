import { describe, expect, it } from 'vitest'

import { parseLoginResponse } from './session'

describe('login response contract', () => {
  it('accepts the original top-level login response', () => {
    expect(parseLoginResponse({ userInfo: { id: 'user-1' }, accessToken: 'token-1' })).toEqual({
      userInfo: { id: 'user-1' },
      accessToken: 'token-1',
    })
  })

  it('unwraps a successful code/data response from the backend', () => {
    expect(parseLoginResponse({
      code: 0,
      data: { userInfo: { id: 'user-1' }, accessToken: 'token-1', is_new_user: false },
    })).toEqual({ userInfo: { id: 'user-1' }, accessToken: 'token-1', is_new_user: false })
  })

  it('preserves new-user popup content from the backend envelope', () => {
    expect(parseLoginResponse({ code: 0, data: {
      userInfo: { id: 'user-2' }, accessToken: 'token-2', is_new_user: true,
      popup: { title: '注册成功', description: '已获得泡泡值奖励', points: 120 },
    } })).toEqual({ userInfo: { id: 'user-2' }, accessToken: 'token-2', is_new_user: true,
      popup: { title: '注册成功', description: '已获得泡泡值奖励', points: 120 } })
  })

  it('ignores malformed popup content and preserves ordinary login', () => {
    expect(parseLoginResponse({ userInfo: {}, accessToken: 'token-3', is_new_user: true,
      popup: { title: 'Hi', description: '', points: 5 } })).toEqual({
      userInfo: {}, accessToken: 'token-3', is_new_user: true,
    })
  })

  it('does not treat a non-success envelope as a valid session', () => {
    expect(() => parseLoginResponse({ code: 500, data: { message: 'backend failure' } }))
      .toThrowError(expect.objectContaining({ code: 'AUTH_LOGIN_RESPONSE_INVALID' }))
  })
})

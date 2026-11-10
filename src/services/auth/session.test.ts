import { describe, expect, it } from 'vitest'

import { getNewUserPopup, parseLoginResponse } from './session'

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

  it('preserves new-user metadata returned beside the data envelope', () => {
    expect(parseLoginResponse({
      code: 0,
      is_new_user: true,
      popup: { title: '注册成功', description: '已获得泡泡值奖励', points: 120 },
      data: { userInfo: { id: 'user-2' }, accessToken: 'token-2' },
    })).toEqual({
      userInfo: { id: 'user-2' },
      accessToken: 'token-2',
      is_new_user: true,
      popup: { title: '注册成功', description: '已获得泡泡值奖励', points: 120 },
    })
  })

  it('preserves new-user metadata nested inside the data envelope', () => {
    expect(parseLoginResponse({ code: 0, data: {
      userInfo: { id: 'user-3' }, accessToken: 'token-3', is_new_user: true,
      popup: { title: '注册成功', description: '已获得泡泡值奖励', points: 120 },
    } })).toEqual({
      userInfo: { id: 'user-3' },
      accessToken: 'token-3',
      is_new_user: true,
      popup: { title: '注册成功', description: '已获得泡泡值奖励', points: 120 },
    })
  })

  it('shows a default new-user notice when the backend omits optional popup content', () => {
    const session = parseLoginResponse({
      code: 0,
      data: { userInfo: { id: 'user-4' }, accessToken: 'token-4', is_new_user: true },
    })
    expect(getNewUserPopup(session)).toEqual({
      title: '欢迎加入卡博士',
      description: '恭喜成为卡博士新用户，欢迎开启卡博士体验。',
    })
  })

  it('does not show a notice for an existing user', () => {
    const session = parseLoginResponse({
      code: 0,
      data: { userInfo: { id: 'user-5' }, accessToken: 'token-5', is_new_user: false },
    })
    expect(getNewUserPopup(session)).toBeNull()
  })

  it('ignores malformed popup content but keeps the new-user flag', () => {
    const session = parseLoginResponse({
      userInfo: {}, accessToken: 'token-6', is_new_user: true,
      popup: { title: 'Hi', description: '', points: 5 },
    })
    expect(session).toEqual({
      userInfo: {}, accessToken: 'token-6', is_new_user: true,
      popup: {
        title: 'Hi',
        description: '恭喜成为卡博士新用户，欢迎开启卡博士体验。',
        points: 5,
      },
    })
    expect(getNewUserPopup(session)).toEqual(session.popup)
  })

  it('does not treat a non-success envelope as a valid session', () => {
    expect(() => parseLoginResponse({ code: 500, data: { message: 'backend failure' } }))
      .toThrowError(expect.objectContaining({ code: 'AUTH_LOGIN_RESPONSE_INVALID' }))
  })
})

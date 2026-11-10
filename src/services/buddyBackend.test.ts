import { beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({ request: vi.fn(), noticePage: vi.fn() }))
vi.mock('./http', async importOriginal => {
  const actual = await importOriginal<typeof import('./http')>()
  return { ...actual, httpClient: { request: mock.request } }
})
vi.mock('./notices', () => ({ fetchNoticePage: mock.noticePage, noticeText: (value: string | null) => value || '' }))
import {
  fetchBackendBuddyList, sendBackendBuddyApplication, sendBackendBuddyQrApplication, agreeBackendBuddyApplication,
  fetchBackendBuddyApplications, fetchUserByIdentifyCode,
} from './buddyBackend'

const friend = (id: number, name = '真实好友', avatar: string | null = '') =>
  ({ status: 20, friend: { id, nick_name: name, avatar_img: avatar } })
const envelope = (data: unknown) => ({ code: 0, msg: 'success', data })
const page = (items: unknown[], current = 1, last = 1, total = items.length) =>
  ({ data: items, current_page: current, per_page: 100, total, last_page: last })

beforeEach(() => { mock.request.mockReset(); mock.noticePage.mockReset() })

describe('existing backend buddy contract (kbs/API master@b6d2821)', () => {
  it('reads all friend pages, maps only the other user fields and does not pass a client user_id', async () => {
    mock.request.mockResolvedValueOnce(envelope(page([friend(8)], 1, 2, 2)))
      .mockResolvedValueOnce(envelope(page([friend(9, '第二位')], 2, 2, 2)))
    expect(await fetchBackendBuddyList()).toEqual({ items: [
      { id: '8', nickname: '真实好友', avatarUrl: null },
      { id: '9', nickname: '第二位', avatarUrl: null },
    ] })
    expect(mock.request.mock.calls.map(call => call[0])).toEqual([
      { method: 'GET', url: '/api/friends/index', params: { page: 1, pageSize: 100 } },
      { method: 'GET', url: '/api/friends/index', params: { page: 2, pageSize: 100 } },
    ])
    expect(mock.request.mock.calls[0]?.[0].params.user_id).toBeUndefined()
  })

  it('does not silently accept unauthorized business errors, invalid friend objects or misleading pagination', async () => {
    mock.request.mockResolvedValueOnce({ code: 401, message: '请先登录', data: [] })
    await expect(fetchBackendBuddyList()).rejects.toThrow('请先登录')
    mock.request.mockResolvedValueOnce(envelope(page([{ status: 20, friend: null }])))
    await expect(fetchBackendBuddyList()).rejects.toThrow()
    mock.request.mockResolvedValueOnce(envelope(page([friend(8)], 2, 3)))
    await expect(fetchBackendBuddyList()).rejects.toThrow('分页异常')
  })

  it('submits only the full phone, source=search, and accepts status=10 as pending, never bound', async () => {
    mock.request.mockResolvedValue(envelope({ id: 12, status: 10 }))
    await sendBackendBuddyApplication('13800000000')
    expect(mock.request).toHaveBeenCalledWith({
      method: 'POST', url: '/api/friends/add', data: { mobile: '13800000000', source: 10 },
    })
    await expect(sendBackendBuddyApplication('123')).rejects.toThrow('手机号')
    expect(mock.request).toHaveBeenCalledTimes(1)
  })

  it('submits QR source=20 with the looked-up numeric friend_id, never a mobile number or an accepted relation', async () => {
    mock.request.mockResolvedValueOnce(envelope({ id: 12, friend_id: 9, source: 20, status: 10 }))
    await sendBackendBuddyQrApplication('9')
    expect(mock.request).toHaveBeenCalledWith({
      method: 'POST', url: '/api/friends/add', data: { friend_id: 9, source: 20 },
    })
    for (const bad of ['9abc', '0', '-1', '01', '4294967296', '9007199254740992']) {
      await expect(sendBackendBuddyQrApplication(bad)).rejects.toThrow('编号无效')
    }
    expect(mock.request).toHaveBeenCalledTimes(1)
  })

  it('rejects wrong target, accepted status and the existing backend duplicate/self errors', async () => {
    mock.request.mockResolvedValueOnce(envelope({ id: 12, friend_id: 8, source: 20, status: 10 }))
    await expect(sendBackendBuddyQrApplication('9')).rejects.toThrow()
    mock.request.mockResolvedValueOnce(envelope({ id: 12, friend_id: 9, source: 20, status: 20 }))
    await expect(sendBackendBuddyQrApplication('9')).rejects.toThrow()
    mock.request.mockResolvedValueOnce({ code: 500, message: '好友申请已发送，等待对方确认', data: [] })
    await expect(sendBackendBuddyQrApplication('9')).rejects.toThrow('好友申请已发送，等待对方确认')
  })

  it('does not mark already-agreed users as newly invited', async () => {
    mock.request.mockResolvedValueOnce(envelope({ id: 12, status: 20 }))
    await expect(sendBackendBuddyApplication('13800000000')).rejects.toThrow()
    mock.request.mockResolvedValueOnce({ code: 500, message: '申请已发送', data: [] })
    await expect(sendBackendBuddyApplication('13800000000')).rejects.toThrow('申请已发送')
  })

  it('confirms only numeric backend friend record IDs, verifying the final accepted status', async () => {
    mock.request.mockResolvedValue(envelope({ id: 12, status: 20 }))
    expect(await agreeBackendBuddyApplication('12')).toBe('accepted')
    expect(mock.request).toHaveBeenCalledWith({
      method: 'POST', url: '/api/friends/agree', data: { id: 12 },
    })
    await expect(agreeBackendBuddyApplication('not-a-relation')).rejects.toThrow('编号无效')
    expect(mock.request).toHaveBeenCalledTimes(1)
  })

  it('maps type=60 notices from extra_json.friends_id, ignoring fake and malformed records', async () => {
    mock.noticePage.mockResolvedValue({ current_page: 1, last_page: 1, data: [
      { id: 70, type: 60, content: '真实申请人 申请添加你为好友', extra_json: '{"friends_id":12}', send_time: 1790000000 },
      { id: 71, type: 60, content: '', extra_json: '{"friends_id":"12"}', send_time: 1790000001 },
      { id: 72, type: 60, content: '', extra_json: '{broken', send_time: 1790000002 },
      { id: 73, type: 10, content: '系统公告', extra_json: '{"friends_id":9}', send_time: 1790000003 },
    ] })
    expect(await fetchBackendBuddyApplications()).toEqual([{
      id: '12', inviter: { id: 'notice-70', nickname: '好友申请', avatarUrl: null },
      status: 'pending', createdAt: '1790000000', detail: '真实申请人 申请添加你为好友',
    }])
    expect(mock.noticePage).toHaveBeenCalledWith(1, 100, 60)
  })

  it('allows UUID public lookup but never invents an official QR URL', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    mock.request.mockResolvedValue(envelope({
      id: 9, nick_name: '读到的昵称', avatar_img: '', identify_code: uuid,
    }))
    expect(await fetchUserByIdentifyCode(uuid)).toEqual({
      id: '9', nickname: '读到的昵称', avatarUrl: null,
    })
    expect(mock.request).toHaveBeenCalledWith({
      method: 'GET', url: '/api/user/code', params: { identify_code: uuid },
    })
    await expect(fetchUserByIdentifyCode('13800000000')).rejects.toThrow('识别码无效')
  })
})

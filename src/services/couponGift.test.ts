import { beforeEach, describe, expect, it, vi } from 'vitest'

import { COUPON_GIFT_PATH, giveCoupon } from './couponGift'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
}))

vi.mock('./http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./http')>()
  return { ...actual, httpClient: { request: mocks.request } }
})

describe('coupon gift contract', () => {
  beforeEach(() => {
    mocks.request.mockReset()
  })

  it('posts only the coupon log ID and friend user ID', async () => {
    mocks.request.mockResolvedValue({
      code: 0,
      msg: 'success',
      status: 'succ',
      data: { log_id: 1001, friend_id: 2 },
    })

    await expect(giveCoupon({ logId: '1001', friendId: '2' })).resolves.toEqual({
      log_id: 1001,
      friend_id: 2,
    })
    expect(mocks.request).toHaveBeenCalledWith({
      method: 'POST',
      url: COUPON_GIFT_PATH,
      data: { log_id: 1001, friend_id: 2 },
    })
  })

  it('rejects invalid IDs before reaching the network', async () => {
    await expect(giveCoupon({ logId: 'abc', friendId: 2 })).rejects.toMatchObject({
      kind: 'business',
      message: '优惠卡或接收人信息无效，请返回卡包重试',
    })
    await expect(giveCoupon({ logId: 1001, friendId: 0 })).rejects.toMatchObject({
      kind: 'business',
      message: '优惠卡或接收人信息无效，请返回卡包重试',
    })
    expect(mocks.request).not.toHaveBeenCalled()
  })

  it('preserves the backend business reason for the page', async () => {
    mocks.request.mockResolvedValue({
      code: 500,
      message: '对方未绑定手机号，无法赠送',
      data: [],
    })

    await expect(giveCoupon({ logId: 1001, friendId: 2 })).rejects.toMatchObject({
      kind: 'business',
      message: '对方未绑定手机号，无法赠送',
    })
  })

  it('uses the documented fallback when the backend provides no reason', async () => {
    mocks.request.mockResolvedValue({ code: 500, data: [] })

    await expect(giveCoupon({ logId: 1001, friendId: 2 })).rejects.toMatchObject({
      kind: 'business',
      message: '转赠失败',
    })
  })

  it('rejects malformed success data instead of claiming a transfer', async () => {
    mocks.request.mockResolvedValue({
      code: 0,
      msg: 'success',
      status: 'succ',
      data: { log_id: '1001', friend_id: 2 },
    })

    await expect(giveCoupon({ logId: 1001, friendId: 2 })).rejects.toMatchObject({
      kind: 'contract',
      code: 'CONTRACT_VALIDATION_FAILED',
    })
  })
})

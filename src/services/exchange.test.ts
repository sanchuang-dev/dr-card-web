import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
}))
vi.mock('./http', () => ({
  httpClient: { request: mocks.request },
  createBusinessError: (message: string) => new Error(message),
}))

import { EXCHANGE_REDEEM_PATH, redeemExchangeProduct } from './exchange'

afterEach(() => {
  mocks.request.mockReset()
})

describe('coupon exchange backend contract', () => {
  it('posts the coupon id and returns the authoritative remaining points', async () => {
    mocks.request.mockResolvedValue({
      code: 0,
      msg: 'success',
      status: 'succ',
      data: { coupon_id: 3, points: 28 },
    })

    await expect(redeemExchangeProduct(3, 12)).resolves.toEqual({
      couponId: 3,
      points: 28,
    })
    expect(mocks.request).toHaveBeenCalledWith({
      method: 'POST',
      url: EXCHANGE_REDEEM_PATH,
      data: { id: 3, project_id: 12 },
    })
  })

  it.each([
    '优惠券不存在或已下架',
    '泡泡值不足',
    '优惠券已兑完',
    '优惠券发放失败，泡泡值已退回：卡博士接口异常',
  ])('surfaces backend business failure: %s', async (message) => {
    mocks.request.mockResolvedValue({
      code: 500,
      message,
      data: [],
    })

    await expect(redeemExchangeProduct(3, 12)).rejects.toThrow(message)
  })

  it('rejects malformed successful data instead of showing a false success', async () => {
    mocks.request.mockResolvedValue({
      code: 0,
      msg: 'success',
      status: 'succ',
      data: { coupon_id: 3 },
    })

    await expect(redeemExchangeProduct(3, 12)).rejects.toThrow('coupons.exchange.data')
  })
})

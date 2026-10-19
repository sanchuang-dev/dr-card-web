import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpClient } from './http'
import { REDEEM_CARD_CODE_PATH, redeemCardCode } from './redeemCode'

afterEach(() => vi.restoreAllMocks())

describe('redeemCardCode updated backend contract', () => {
  it('preserves exact code, sends selected project_id, and parses coupons_id', async () => {
    const request = vi.spyOn(httpClient, 'request').mockResolvedValue({
      code: 0, msg: 'success', status: 'succ', data: { coupons_id: 7 },
    })
    await expect(redeemCardCode('Abc- 123456', 31)).resolves.toEqual({ coupons_id: 7 })
    expect(request).toHaveBeenCalledWith({
      method: 'POST', url: REDEEM_CARD_CODE_PATH,
      data: { code: 'Abc- 123456', project_id: 31 },
    })
  })

  it('rejects invalid project_id without sending a request', async () => {
    const request = vi.spyOn(httpClient, 'request')
    await expect(redeemCardCode('ABC123456789', 0)).rejects.toThrow('请选择适用片区')
    expect(request).not.toHaveBeenCalled()
  })

  it('does not treat a backend business failure as success', async () => {
    vi.spyOn(httpClient, 'request').mockResolvedValue({
      code: 500, message: '该兑换码已被使用', data: [],
    })
    await expect(redeemCardCode('ABC123456789', 12)).rejects.toThrow('该兑换码已被使用')
  })

  it('rejects old four-field receipts or malformed coupons_id', async () => {
    const request = vi.spyOn(httpClient, 'request')
    request.mockResolvedValueOnce({
      code: 0, data: { user_card_id: 21, card_id: 4, card_name: '旧卡', card_sn: 'OLD001' },
    }).mockResolvedValueOnce({ code: 0, data: { coupons_id: null } })
    await expect(redeemCardCode('ABC123456789', 12)).rejects.toThrow()
    await expect(redeemCardCode('ABC123456789', 12)).rejects.toThrow()
  })
})

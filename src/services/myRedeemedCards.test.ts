import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpClient } from './http'
import { fetchLocalUserCardPage, fetchRedeemedLocalCards, LOCAL_USER_CARDS_PATH } from './myRedeemedCards'

afterEach(() => vi.restoreAllMocks())

describe('local redeemed cards contract', () => {
  it('uses authenticated GET and the documented pagination envelope', async () => {
    const request = vi.spyOn(httpClient, 'request').mockResolvedValue({
      code: 0, msg: 'success', status: 'succ',
      data: {
        data: [{ id: 21, source: 60, status: 10, card_name: '洗护体验卡', card_sn: 'RC00000000000014' }],
        current_page: 1, per_page: 100, total: 1, last_page: 1,
      },
    })
    const page = await fetchLocalUserCardPage(1)
    expect(page.data[0]).toMatchObject({ id: 21, source: 60 })
    expect(request).toHaveBeenCalledWith({
      method: 'GET', url: LOCAL_USER_CARDS_PATH, params: { page: 1, pageSize: 100 },
    })
  })

  it('fetches later pages before filtering source=60, without dropping any redeemed card', async () => {
    const request = vi.spyOn(httpClient, 'request').mockImplementation(async ({ params }) => ({
      code: 0, msg: 'success', status: 'succ',
      data: {
        data: params.page === 1
          ? [{ id: 1, source: 20, status: 10, card_name: '其他来源' }]
          : [{ id: 2, source: 60, status: 10, card_name: '兑换码卡券' }],
        current_page: params.page,
        per_page: 100, total: 101, last_page: 2,
      },
    }))
    await expect(fetchRedeemedLocalCards()).resolves.toMatchObject([
      { id: 2, source: 60, card_name: '兑换码卡券' },
    ])
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('does not invent success for business failures', async () => {
    vi.spyOn(httpClient, 'request').mockResolvedValue({
      code: 500, message: '卡包服务异常', data: [],
    })
    await expect(fetchRedeemedLocalCards()).rejects.toThrow('卡包服务异常')
  })
})

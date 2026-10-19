import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('./http', () => ({
  httpClient: { request: mocks.request },
  createBusinessError: (message: string) => new Error(message),
}))
import { fetchCouponProjects, COUPON_PROJECT_INDEX_PATH, COUPON_PROJECT_SEARCH_PATH } from './couponProjects'

const response = (page: number) => ({
  code: 0, data: {
    data: [{ id: 31, shop_name: '测试片区', activity_name: '体验券活动', discountcard_no: 'DC1' }],
    current_page: page, per_page: 15, total: 16, last_page: 2,
  },
})
afterEach(() => mocks.request.mockReset())

describe('coupon project search protocol', () => {
  it('uses unfiltered GET index for the initial 15; no invalid blank search', async () => {
    mocks.request.mockResolvedValue(response(1))
    await expect(fetchCouponProjects('')).resolves.toMatchObject({ total: 16 })
    expect(mocks.request).toHaveBeenCalledWith({
      method: 'GET', url: COUPON_PROJECT_INDEX_PATH, params: { page: 1, pageSize: 15 },
    })
  })
  it('searches server-side with the required nonblank shop_name and paginates by 15', async () => {
    mocks.request.mockResolvedValue(response(2))
    await fetchCouponProjects('  南沙  ', 2)
    expect(mocks.request).toHaveBeenCalledWith({
      method: 'POST', url: COUPON_PROJECT_SEARCH_PATH,
      data: { shop_name: '南沙', page: 2, pageSize: 15 },
    })
  })
  it('rejects failed or malformed pages rather than exposing a false empty list', async () => {
    mocks.request.mockResolvedValueOnce({ code: 500, message: '查询失败', data: [] })
      .mockResolvedValueOnce({ code: 0, data: { ...response(1).data, current_page: 3 } })
    await expect(fetchCouponProjects('南沙')).rejects.toThrow('查询失败')
    await expect(fetchCouponProjects('南沙')).rejects.toThrow('分页数据异常')
  })
})

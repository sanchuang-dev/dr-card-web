import { z } from 'zod'
import { parseApiEnvelope } from './contracts/apiEnvelope'
import { httpClient } from './http'

export const COUPON_PROJECT_INDEX_PATH = '/api/couponskbs/index'
export const COUPON_PROJECT_SEARCH_PATH = '/api/coupons/getProjects'
export const COUPON_PROJECT_PAGE_SIZE = 15

const projectSchema = z.object({
  id: z.number().int().positive(),
  shop_name: z.string(),
  activity_name: z.string(),
  discountcard_no: z.string(),
}).passthrough()

const pageSchema = z.object({
  data: z.array(projectSchema),
  current_page: z.number().int().positive(),
  per_page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  last_page: z.number().int().positive(),
}).passthrough()

export type CouponProject = z.infer<typeof projectSchema>
export type CouponProjectsPage = z.infer<typeof pageSchema>

/**
 * Blank keyword uses the public project index's documented page/pageSize DTO.
 * /coupons/getProjects requires a nonempty shop_name, so never send it an empty
 * search or fabricate a wildcard. Both endpoints expose the same project shape.
 */
export async function fetchCouponProjects(keyword: string, page = 1): Promise<CouponProjectsPage> {
  if (!Number.isInteger(page) || page < 1) throw new Error('项目页码无效')
  const term = keyword.trim()
  const payload = await httpClient.request<unknown>(term
    ? { method: 'POST', url: COUPON_PROJECT_SEARCH_PATH,
        data: { shop_name: term, page, pageSize: COUPON_PROJECT_PAGE_SIZE } }
    : { method: 'GET', url: COUPON_PROJECT_INDEX_PATH,
        params: { page, pageSize: COUPON_PROJECT_PAGE_SIZE } })

  const result = parseApiEnvelope(payload, pageSchema, {
    contract: 'coupons.projects', fallbackMessage: '适用片区加载失败',
  })
  if (result.current_page !== page || result.per_page > COUPON_PROJECT_PAGE_SIZE ||
      result.data.length > COUPON_PROJECT_PAGE_SIZE) {
    throw new Error('片区列表分页数据异常，请重试')
  }
  return result
}

import { http, HttpResponse } from 'msw'
import { EXCHANGE_REDEEM_PATH } from '../../services/exchange'
import { COUPON_PROJECT_INDEX_PATH, COUPON_PROJECT_SEARCH_PATH } from '../../services/couponProjects'

const names = [
  '深圳南山科技园', '深圳福田中心', '深圳宝安新安', '广州南沙蕉门', '广州南沙金洲',
  '广州南沙黄阁', '广州南沙横沥', '广州南沙万顷沙', '广州天河体育西', '广州天河珠江新城',
  '广州番禺市桥', '广州番禺大学城', '广州海珠客村', '广州白云嘉禾', '广州荔湾西关',
  '广州越秀北京路', '深圳龙华民治', '深圳罗湖东门', '深圳龙岗坂田', '深圳光明凤凰',
  '东莞南城', '东莞松山湖', '佛山禅城祖庙', '佛山南海桂城', '中山石岐',
  '珠海香洲', '惠州惠城', '江门蓬江', '肇庆端州', '韶关浈江', '韶关武江',
]
/** Clearly labeled PREVIEW data; never used when dataMode=api. */
const mockProjects = names.map((name, index) => ({
  id: 100 + index, shop_name: `Mock·${name}体验中心`,
  activity_name: 'Mock·洗护体验活动', discountcard_no: 'MOCK-CARD',
}))
const envelope = (data: unknown) => HttpResponse.json({ code: 0, msg: 'success', status: 'succ', data })
const pageResult = (keyword: string, page: number, pageSize: number) => {
  const filtered = mockProjects.filter(project => project.shop_name.includes(keyword))
  return {
    data: filtered.slice((page - 1) * pageSize, page * pageSize),
    current_page: page, per_page: pageSize,
    total: filtered.length, last_page: Math.max(1, Math.ceil(filtered.length / pageSize)),
  }
}
const validPaging = (page: unknown, size: unknown) => ({
  page: Math.max(1, Number(page) || 1),
  size: Math.max(1, Math.min(15, Number(size) || 15)),
})

export const exchangeHandlers = [
  http.get(`*${COUPON_PROJECT_INDEX_PATH}`, ({ request }) => {
    const params = new URL(request.url).searchParams
    const { page, size } = validPaging(params.get('page'), params.get('pageSize'))
    return envelope(pageResult('', page, size))
  }),
  http.post(`*${COUPON_PROJECT_SEARCH_PATH}`, async ({ request }) => {
    const body = await request.json().catch(() => null) as { shop_name?: unknown; page?: unknown; pageSize?: unknown } | null
    const term = typeof body?.shop_name === 'string' ? body.shop_name.trim() : ''
    if (!term) return HttpResponse.json({ code: 500, message: '"卡博士项目名称" is required', data: [] })
    const { page, size } = validPaging(body?.page, body?.pageSize)
    return envelope(pageResult(term, page, size))
  }),
  http.post(`*${EXCHANGE_REDEEM_PATH}`, async ({ request }) => {
    const body = await request.json().catch(() => null) as { id?: unknown; project_id?: unknown } | null
    const couponId = body?.id
    const projectId = body?.project_id
    if (typeof couponId !== 'number' || !Number.isInteger(couponId) || couponId <= 0) {
      return HttpResponse.json({ code: 500, message: '"优惠券ID" is required', data: [] })
    }
    if (typeof projectId !== 'number' || !Number.isInteger(projectId) || projectId <= 0) {
      return HttpResponse.json({ code: 500, message: '"卡博士项目ID" is required', data: [] })
    }
    return envelope({ coupon_id: couponId, points: 1080 })
  }),
]

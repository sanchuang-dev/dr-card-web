import { z } from 'zod'
import { parseApiEnvelope } from './contracts/apiEnvelope'
import { httpClient } from './http'

/** Local cards and third-party MyCoupons use different stores and contracts. */
export const LOCAL_USER_CARDS_PATH = '/api/usercards/index'
const localCardSchema = z.object({
  id: z.union([z.number(), z.string()]),
  source: z.coerce.number(),
  status: z.coerce.number(),
  card_name: z.string(),
  card_sn: z.string().nullish(),
  card_type: z.coerce.number().optional(),
  face_value: z.union([z.number(), z.string()]).nullish(),
  valid_start_time: z.union([z.number(), z.string()]).nullish(),
  valid_end_time: z.union([z.number(), z.string()]).nullish(),
}).passthrough()

const localCardPageSchema = z.object({
  data: z.array(localCardSchema),
  current_page: z.number(),
  per_page: z.number(),
  total: z.number(),
  last_page: z.number(),
}).passthrough()

export type LocalUserCard = z.infer<typeof localCardSchema>
export type LocalUserCardPage = z.infer<typeof localCardPageSchema>

/** Fetch a page of the current authenticated user's cards. No guessed filter parameters. */
export async function fetchLocalUserCardPage(page: number): Promise<LocalUserCardPage> {
  const payload = await httpClient.request<unknown>({
    method: 'GET',
    url: LOCAL_USER_CARDS_PATH,
    params: { page, pageSize: 100 },
  })
  return parseApiEnvelope(payload, localCardPageSchema, {
    contract: 'usercards.index',
    fallbackMessage: '兑换码卡券加载失败',
  })
}

/** Fetch ALL pages before filtering locally; a single filtered page would silently drop cards. */
export async function fetchRedeemedLocalCards(): Promise<LocalUserCard[]> {
  const first = await fetchLocalUserCardPage(1)
  const remainingPages = Array.from(
    { length: Math.max(first.last_page - 1, 0) },
    (_, index) => index + 2,
  )
  const rest = await Promise.all(remainingPages.map(fetchLocalUserCardPage))
  return [first, ...rest].flatMap((page) => page.data).filter((card) => card.source === 60)
}

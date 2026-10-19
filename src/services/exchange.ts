import { z } from 'zod'

import { parseApiEnvelope } from './contracts/apiEnvelope'
import { httpClient } from './http'

/** Backend contract: API/docs/api-card.md -> POST /api/coupons/exchange. */
export const EXCHANGE_REDEEM_PATH = '/api/coupons/exchange'

const exchangeRedeemDataSchema = z
  .object({
    coupon_id: z.number().int().min(1),
    points: z.number().int().min(0),
  })
  .passthrough()

export interface ExchangeRedeemResult {
  couponId: number
  /** Authoritative remaining bubble-points balance returned by the backend. */
  points: number
}

/**
 * Redeem one coupon template with the current authenticated user's bubble points.
 *
 * User identity and balance are deliberately not sent by H5; the backend derives
 * both from the authenticated session and owns stock, deduction, ledger and issue
 * compensation semantics.
 */
export async function redeemExchangeProduct(productId: number, projectId: number): Promise<ExchangeRedeemResult> {
  if (!Number.isInteger(projectId) || projectId <= 0) throw new Error('请选择适用片区')
  const payload = await httpClient.request<unknown>({
    method: 'POST',
    url: EXCHANGE_REDEEM_PATH,
    data: { id: productId, project_id: projectId },
  })

  const data = parseApiEnvelope(payload, exchangeRedeemDataSchema, {
    contract: 'coupons.exchange',
    fallbackMessage: '兑换失败，请稍后重试',
  })

  return {
    couponId: data.coupon_id,
    points: data.points,
  }
}

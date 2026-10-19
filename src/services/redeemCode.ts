import { z } from 'zod'
import { parseApiEnvelope } from './contracts/apiEnvelope'
import { httpClient } from './http'

/** 后台确认的用户兑换码核兑接口，见 docs/engineering/card-code-redeem-contract.md。 */
export const REDEEM_CARD_CODE_PATH = '/api/cardredemptioncodes/redeem'

const redemptionReceiptSchema = z.object({
  coupons_id: z.number().int().positive(),
}).passthrough()

export type RedemptionReceipt = z.infer<typeof redemptionReceiptSchema>

/** 保留原始 code，并按所选片区提交 project_id；登录身份由 HTTP 层携带。 */
export async function redeemCardCode(code: string, projectId: number): Promise<RedemptionReceipt> {
  if (!Number.isInteger(projectId) || projectId <= 0) throw new Error('请选择适用片区')
  const payload = await httpClient.request<unknown>({
    method: 'POST',
    url: REDEEM_CARD_CODE_PATH,
    data: { code, project_id: projectId },
  })
  return parseApiEnvelope(payload, redemptionReceiptSchema, {
    contract: 'cardredemptioncodes.redeem',
    fallbackMessage: '兑换失败，请稍后重试',
  })
}

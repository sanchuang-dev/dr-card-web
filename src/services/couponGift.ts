import { z } from 'zod'

import { AppError } from '../lib/appError'
import { parseApiEnvelope } from './contracts/apiEnvelope'
import { httpClient } from './http'

/**
 * 优惠卡转赠（H5 契约）。
 *
 * 赠送方身份由服务端按登录态取得，H5 只提交：
 * - `log_id`：本人未使用优惠卡记录 ID（MyCoupons `data.data[].id`）
 * - `friend_id`：好友列表中的用户 ID
 *
 * 接收方手机号由服务端按 `friend_id` 查询；前端不得传 `user_id` / `mobile`。
 */
export const COUPON_GIFT_PATH = '/api/coupons/give'

const couponGiftResultSchema = z
  .object({
    log_id: z.number().int().positive(),
    friend_id: z.number().int().positive(),
  })
  .passthrough()

export type CouponGiftResult = z.infer<typeof couponGiftResultSchema>

export interface CouponGiftParams {
  logId: number | string
  friendId: number | string
}

function toPositiveSafeInteger(value: number | string): number | null {
  const parsed = typeof value === 'string' ? Number(value.trim()) : value
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

export async function giveCoupon(params: CouponGiftParams): Promise<CouponGiftResult> {
  const logId = toPositiveSafeInteger(params.logId)
  const friendId = toPositiveSafeInteger(params.friendId)
  if (logId === null || friendId === null) {
    throw new AppError({
      kind: 'business',
      message: '优惠卡或接收人信息无效，请返回卡包重试',
    })
  }

  const payload = await httpClient.request<unknown>({
    method: 'POST',
    url: COUPON_GIFT_PATH,
    data: {
      log_id: logId,
      friend_id: friendId,
    },
  })

  return parseApiEnvelope(payload, couponGiftResultSchema, {
    contract: 'coupons.give',
    fallbackMessage: '转赠失败',
  })
}

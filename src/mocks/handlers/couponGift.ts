import { http, HttpResponse } from 'msw'

import { SHARE_TARGET_FIXTURES } from '../../app/fixtures/cards'
import { COUPON_GIFT_PATH } from '../../services/couponGift'
import { MY_COUPONS_RECORDS_MOCK } from '../fixtures/myCoupons'

const MOCK_FRIEND_IDS = new Set(SHARE_TARGET_FIXTURES.map((friend) => Number(friend.id)))

function failure(message: string) {
  return HttpResponse.json({ code: 500, message, data: [] })
}

function readPositiveId(value: unknown, field: '优惠卡记录ID' | '好友ID'): number | string {
  if (value == null) return `"${field}" is required`
  if (typeof value !== 'number') return `"${field}" must be a number`
  if (!Number.isInteger(value)) return `"${field}" must be a number`
  if (value < 1) return `"${field}" must be greater than or equal to 1`
  return value
}

/**
 * Preview/dev network-level Mock for the confirmed `POST /api/coupons/give` contract.
 * It simulates the coupon disappearing from the sender's unused list after a successful gift.
 */
export const couponGiftHandlers = [
  http.post(`*${COUPON_GIFT_PATH}`, async ({ request }) => {
    const body: unknown = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return failure('参数错误')

    const raw = body as { log_id?: unknown; friend_id?: unknown }
    const logId = readPositiveId(raw.log_id, '优惠卡记录ID')
    if (typeof logId === 'string') return failure(logId)
    const friendId = readPositiveId(raw.friend_id, '好友ID')
    if (typeof friendId === 'string') return failure(friendId)

    if (!MOCK_FRIEND_IDS.has(friendId)) return failure('好友不存在')

    const records = MY_COUPONS_RECORDS_MOCK.unused
    const index = records.findIndex((record) => String(record.id) === String(logId))
    if (index < 0) return failure('该优惠卡不属于您')
    records.splice(index, 1)

    return HttpResponse.json({
      code: 0,
      msg: 'success',
      status: 'succ',
      data: { log_id: logId, friend_id: friendId },
    })
  }),
]

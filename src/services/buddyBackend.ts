import { z } from 'zod'
import { parseApiEnvelope } from './contracts/apiEnvelope'
import { httpClient } from './http'
import { fetchNoticePage, noticeText } from './notices'
import type { BuddyPhoneInvitation } from './buddyPhone'

/**
 * Verified against kbs/API master@b6d2821 (2026-10-09).
 * These are real existing backend endpoints, NOT the unsigned proposed QR endpoints.
 * The HTTP client sends the current login session; never accepts a client-supplied user ID.
 */
export const BUDDY_FRIENDS_INDEX_PATH = '/api/friends/index'
export const BUDDY_FRIENDS_ADD_PATH = '/api/friends/add'
export const BUDDY_FRIENDS_AGREE_PATH = '/api/friends/agree'
export const BUDDY_USER_BY_CODE_PATH = '/api/user/code'
export const BUDDY_MY_PROFILE_PATH = '/api/user/profile'

const publicUserSchema = z.object({
  id: z.number().int().positive(),
  nick_name: z.string().min(1),
  avatar_img: z.string().nullish(),
}).passthrough()

const rowSchema = z.object({
  status: z.literal(20),
  friend: publicUserSchema,
}).passthrough()

const friendPageSchema = z.object({
  data: z.array(rowSchema),
  current_page: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  last_page: z.number().int().positive(),
}).passthrough()

export interface BackendBuddyMember {
  id: string
  nickname: string
  avatarUrl: string | null
}

function avatarOrNull(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? raw : null
  } catch {
    return null
  }
}

export async function fetchBackendBuddyList(): Promise<{ items: BackendBuddyMember[] }> {
  const output: BackendBuddyMember[] = []
  // Pagination is server-owned: never show just the first 15 and call it the whole list.
  for (let page = 1; page <= 20; page++) {
    const response = await httpClient.request<unknown>({
      method: 'GET',
      url: BUDDY_FRIENDS_INDEX_PATH,
      params: { page, pageSize: 100 },
    })
    const data = parseApiEnvelope(response, friendPageSchema, {
      contract: 'buddy.friends.index',
      fallbackMessage: '搭子列表获取失败',
    })
    if (data.current_page !== page) throw new Error('好友列表分页异常')
    if (data.last_page > 20) throw new Error('好友数量超过当前分页上限')
    output.push(...data.data.map(({ friend }) => ({
      id: String(friend.id),
      nickname: friend.nick_name,
      avatarUrl: avatarOrNull(friend.avatar_img),
    })))
    if (page >= data.last_page) return { items: output }
  }
  throw new Error('搭子列表超过当前分页上限，请联系后台')
}

const friendRequestSchema = z.object({
  id: z.number().int().positive(),
  status: z.literal(10),
}).passthrough()

/** Existing backend semantics: send pending application, NOT a completed relationship. */
export async function sendBackendBuddyApplication(phone: string): Promise<void> {
  if (!/^1[3-9]\d{9}$/.test(phone)) throw new Error('请输入完整且正确的手机号')
  const response = await httpClient.request<unknown>({
    method: 'POST',
    url: BUDDY_FRIENDS_ADD_PATH,
    data: { mobile: phone, source: 10 },
  })
  parseApiEnvelope(response, friendRequestSchema, {
    contract: 'buddy.friends.add',
    fallbackMessage: '好友申请发送失败',
  })
}

/** The same Friends.add endpoint accepts a validated target user ID for QR invitations.
 * Source 20 identifies a QR application; status 10 is pending until the recipient accepts.
 * Verified against the kbs/API Friends controller, validator, service and api-buddy.md.
 */
export async function sendBackendBuddyQrApplication(friendId: string): Promise<void> {
  if (!/^[1-9]\d*$/.test(friendId) ||
      !Number.isSafeInteger(Number(friendId)) || Number(friendId) > 4294967295) {
    throw new Error('邀请人用户编号无效')
  }
  const targetId = Number(friendId)
  const response = await httpClient.request<unknown>({
    method: 'POST',
    url: BUDDY_FRIENDS_ADD_PATH,
    data: { friend_id: targetId, source: 20 },
  })
  parseApiEnvelope(response, friendRequestSchema.extend({
    friend_id: z.literal(targetId),
    source: z.literal(20),
  }), {
    contract: 'buddy.friends.add.qr',
    fallbackMessage: '二维码好友申请发送失败',
  })
}

const friendAgreeSchema = z.object({
  id: z.number().int().positive(),
  status: z.literal(20),
}).passthrough()

/** Only the logged-in recipient can approve by actual backend friendship record ID. */
export async function agreeBackendBuddyApplication(id: string): Promise<'accepted'> {
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    throw new Error('好友申请编号无效')
  }
  const response = await httpClient.request<unknown>({
    method: 'POST',
    url: BUDDY_FRIENDS_AGREE_PATH,
    data: { id: Number(id) },
  })
  parseApiEnvelope(response, friendAgreeSchema, {
    contract: 'buddy.friends.agree',
    fallbackMessage: '好友申请确认失败',
  })
  return 'accepted'
}

/** Incoming applications are type=60 notices; backend soft-deletes after approval. */
export async function fetchBackendBuddyApplications(): Promise<BuddyPhoneInvitation[]> {
  const output: BuddyPhoneInvitation[] = []
  for (let page = 1; page <= 20; page++) {
    const response = await fetchNoticePage(page, 100, 60)
    for (const notice of response.data) {
      if (notice.type !== 60) continue
      let relationId: unknown
      try {
        const extra: unknown = JSON.parse(notice.extra_json || '{}')
        if (extra && typeof extra === 'object') relationId = (extra as { friends_id?: unknown }).friends_id
      } catch {
        continue // Malformed legacy notice is not a valid confirmable invitation.
      }
      if (typeof relationId !== 'number' || !Number.isSafeInteger(relationId) || relationId <= 0) continue
      output.push({
        id: String(relationId),
        inviter: { id: `notice-${notice.id}`, nickname: '好友申请', avatarUrl: null },
        status: 'pending',
        createdAt: String(notice.send_time ?? notice.create_time),
        detail: noticeText(notice.content),
      })
    }
    if (page >= response.last_page) return output
  }
  throw new Error('待处理邀请超过当前分页上限，请联系后台')
}

/** A stable UUID is NOT a public HTTPS QR URL; use only for read-only lookup. */
const codeProfileSchema = publicUserSchema.extend({
  identify_code: z.string().uuid(),
})
export async function fetchUserByIdentifyCode(code: string): Promise<BackendBuddyMember> {
  if (!z.string().uuid().safeParse(code).success) throw new Error('用户识别码无效')
  const response = await httpClient.request<unknown>({
    method: 'GET', url: BUDDY_USER_BY_CODE_PATH, params: { identify_code: code },
  })
  const user = parseApiEnvelope(response, codeProfileSchema, {
    contract: 'buddy.user.code',
    fallbackMessage: '用户公开信息获取失败',
  })
  return { id: String(user.id), nickname: user.nick_name, avatarUrl: avatarOrNull(user.avatar_img) }
}

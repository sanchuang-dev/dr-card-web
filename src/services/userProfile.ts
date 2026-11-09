import { z } from 'zod'

import { getAuthSession } from './auth/session'
import { parseApiEnvelope } from './contracts/apiEnvelope'
import { httpClient } from './http'

/**
 * 用户资料读取与修改（正式 H5）。
 *
 * 契约来源：客户端《我的（个人中心）页面接口接入文档》。
 *
 * 两条资料接口并存，路径与消费方不同，互不覆盖：
 * - `GET /api/user/detail`   —— 历史端点，资料设置页（Settings）在用，返回 `nick_name` / `grade` 等；
 * - `GET /api/user/profile`  —— 本页正式端点，返回等级 / 券数量 / 泡泡值 / 地区等完整资料。
 *
 * 两个接口都只读取当前登录用户，**不传也不接受 `user_id` / `id`**，传了也会被登录用户覆盖。
 * 认证头由全局 auth session provider 注入（`Authorization: Bearer <accessToken>`）；
 * 401 由 httpClient 重试 + 页面 AuthGate 统一处理，本服务不做页面级登录分支。
 *
 * 信封协议：2026-09-28 后端统一成功码为 `code: 0`（兼容原生），失败为非 0 code + `message` 字段，
 * 本服务与其它正式接口共用 `parseApiEnvelope`。
 */
export const USER_PROFILE_DETAIL_PATH = '/api/user/detail'

/** GET /api/user/profile —— 我的页个人资料（头像 / 昵称 / 等级 / 券数量 / 泡泡值）。 */
export const USER_PROFILE_PATH = '/api/user/profile'

/** POST /api/user/update —— 修改当前登录用户资料。 */
export const USER_UPDATE_PATH = '/api/user/update'

/**
 * 历史端点 `GET /api/user/detail`。
 *
 * 2026-09-24 模拟器联调实测：后端鉴权读 `token` 请求头，
 * 只带 `Authorization: Bearer <accessToken>` 会 401「请先登录」；
 * 全局 HTTP 鉴权 provider 仍按既有口径附 Bearer，这里补上实测可用的 `token` 头，
 * 待后端确认 Bearer 口径后收口。
 */
const userDetailSchema = z
  .object({
    id: z.number().optional(),
    nick_name: z.string().nullish(),
    grade: z.string().nullish(),
    // Persisted academic year. Do not confuse it with the membership tier `grade`.
    student_grade: z.string().nullish(),
    avatar_img: z.union([z.string(), z.number()]).nullish(),
    // #142 proposed wire contract, not yet deployed in the checked backend.
    birthday: z.string().nullish(),
    consume_password_set: z.boolean().optional(),
  })
  .passthrough()

export interface UserProfileDetail {
  /** User ID is used only to scope a non-secret UI mask flag to the account. */
  userId?: number
  /** `nick_name`；接口未给时为空串。 */
  nickname: string
  /** Saved academic year: `student_grade` first; legacy `grade` only if absent. */
  grade: string
  avatar?: string
  /** Undefined means the backend did not expose this field. */
  birthday?: string
  /** Only a status flag; no plaintext PIN ever comes from the server. */
  pinConfigured?: boolean
}

/** 纯解析：把统一信封的 `data` 收成页面可用字段；非 0 code 取 `message` 抛业务错误。 */
export function parseUserProfileDetail(payload: unknown): UserProfileDetail {
  const detail = parseApiEnvelope(payload, userDetailSchema, {
    contract: 'user.profile-detail',
    fallbackMessage: '会员资料获取失败',
  })

  return {
    ...(detail.id !== undefined ? { userId: detail.id } : {}),
    nickname: detail.nick_name?.trim() ?? '',
    // `grade` may be a membership title; `student_grade` is the academic year
    // written by POST /api/user/update. An explicit empty academic year is valid
    // and must not silently fall back to a potentially unrelated membership tier.
    grade: detail.student_grade === undefined
      ? detail.grade?.trim() ?? ''
      : detail.student_grade?.trim() ?? '',
    avatar: typeof detail.avatar_img === 'string' ? trimOrUndefined(detail.avatar_img) : undefined,
    ...(detail.birthday !== undefined ? { birthday: detail.birthday ?? '' } : {}),
    ...(detail.consume_password_set !== undefined ? { pinConfigured: detail.consume_password_set } : {}),
  }
}

export async function fetchUserProfileDetail(): Promise<UserProfileDetail> {
  const accessToken = getAuthSession()?.accessToken
  const payload = await httpClient.request<unknown>({
    method: 'GET',
    url: USER_PROFILE_DETAIL_PATH,
    headers: accessToken ? { token: accessToken } : undefined,
  })

  return parseUserProfileDetail(payload)
}

/**
 * `nextGrade`：下一等级。没有下一等级时后端返回**空字符串 `""`**，
 * 不是 `null`、也不是 `{}`，因此这里用 `union([object, literal('')])` 显式建模，
 * 而不是 `nullable()`。三字段同生共死。
 */
const nextGradeSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    min_exp_number: z.number(),
  })
  .passthrough()

/**
 * 我的页个人资料。
 *
 * 字段口径（来自客户端文档，前端务必遵守）：
 * - `couponsCount` 恒为数字，取不到上游数据时为 `0`，前端不写判空兜底；
 * - `grade_id` 与 `grade` 同生共死；
 * - `avatar_img` / `country` / `province` / `city` / `real_name` / `kbs_id` 未设置时为空串 `""`
 *   （`avatar_img` 类型标注为 `string | null`，统一容错为「空即未设置」）；
 * - `points` 是**登录时的快照**，见下方 ⚠️，前端不使用它作为实时余额。
 */
const userProfileSchema = z
  .object({
    couponsCount: z.number(),
    // 后端没有默认等级时，这两个键会在 JSON 序列化时一起缺席。
    grade: z.string().nullish(),
    grade_id: z.number().nullish(),
    nextGrade: z.union([nextGradeSchema, z.literal('')]),
    nick_name: z.string(),
    avatar_img: z.string().nullish(),
    country: z.string().nullish(),
    province: z.string().nullish(),
    city: z.string().nullish(),
    mobile: z.string().nullish(),
    real_name: z.string().nullish(),
    points: z.number(),
    kbs_id: z.string().nullish(),
    identify_code: z.string().uuid().nullish(),
  })
  .passthrough()
  .superRefine((value, context) => {
    const hasGrade = typeof value.grade === 'string' && value.grade.trim().length > 0
    const hasGradeId = typeof value.grade_id === 'number'
    if (hasGrade !== hasGradeId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['grade_id'],
        message: '会员等级名称与等级 ID 必须同时存在或同时缺席',
      })
    }
  })

export type UserProfileNextGrade = z.infer<typeof nextGradeSchema>

/** 页面可直接消费的资料视图模型：把 `""` 统一收敛为 `undefined`，避免页面散落判空。 */
export interface UserProfile {
  /** 未使用优惠券数量，恒为数字。 */
  couponsCount: number
  /** 会员等级名称。 */
  grade: string
  /** 会员等级 ID；未配置默认等级时缺席。 */
  gradeId?: number
  /** 下一等级；没有下一等级时为 `undefined`（后端返回 `""`）。 */
  nextGrade?: UserProfileNextGrade
  /** 昵称。 */
  nickname: string
  /** 头像完整 URL；未设置时为空串 → 收敛为 `undefined`。 */
  avatar?: string
  /** 国家 / 省 / 市，未设置时为空串 → 收敛为 `undefined`。 */
  country?: string
  province?: string
  city?: string
  /** 手机号（登录时从上游带入，可能是脱敏形态 151****2709）。 */
  mobile: string
  /** 真实姓名，未设置时为空串 → 收敛为 `undefined`。 */
  realName?: string
  /** 泡泡值余额，**登录时的快照**；实时余额请用 `GET /api/userpoints/stat` 的 `points`。 */
  points: number
  /** 上游 kbs 会员 ID（如 K016998956）。 */
  kbsId?: string
  identifyCode?: string
}

function trimOrUndefined(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** 纯解析：把统一信封的 `data` 收成页面可用视图模型；非 0 code 取 `message` 抛业务错误。 */
export function parseUserProfile(payload: unknown): UserProfile {
  const profile = parseApiEnvelope(payload, userProfileSchema, {
    contract: 'user.profile',
    fallbackMessage: '个人资料获取失败',
  })

  return {
    couponsCount: profile.couponsCount,
    grade: profile.grade ?? '',
    gradeId: profile.grade_id ?? undefined,
    // 没有当前等级时不能宣称已存在升级关系，即使上游按 >0 算出 nextGrade。
    nextGrade: profile.grade_id == null || profile.nextGrade === '' ? undefined : profile.nextGrade,
    nickname: profile.nick_name,
    avatar: trimOrUndefined(profile.avatar_img),
    country: trimOrUndefined(profile.country),
    province: trimOrUndefined(profile.province),
    city: trimOrUndefined(profile.city),
    mobile: profile.mobile ?? '',
    realName: trimOrUndefined(profile.real_name),
    points: profile.points,
    kbsId: trimOrUndefined(profile.kbs_id),
    identifyCode: profile.identify_code ?? undefined,
  }
}

export async function fetchUserProfile(): Promise<UserProfile> {
  const payload = await httpClient.request<unknown>({
    method: 'GET',
    url: USER_PROFILE_PATH,
  })

  return parseUserProfile(payload)
}

/** 性别口径：必须传字符串 `"0"`=保密 / `"1"`=男 / `"2"`=女。 */
export const USER_GENDER_SECRET = '0'
export const USER_GENDER_MALE = '1'
export const USER_GENDER_FEMALE = '2'

export type UserGender =
  | typeof USER_GENDER_SECRET
  | typeof USER_GENDER_MALE
  | typeof USER_GENDER_FEMALE

/**
 * `POST /api/user/update` 入参。
 *
 * 只传要改的字段，不传的保持原值。字符串字段长度上限（后端校验，前端不自行截断）：
 * `nick_name` 50 / `avatar_img` 255 / `country` 150 / `province` 150 / `city` 150 /
 * `real_name` 80 / `student_grade` 20。
 */
export interface UserUpdatePayload {
  nick_name?: string
  gender?: UserGender
  avatar_img?: string
  country?: string
  province?: string
  city?: string
  real_name?: string
  student_grade?: string
  // #142 proposed wire fields. Names/validation need backend contract approval.
  birthday?: string // ISO YYYY-MM-DD
  consume_password?: string // six-digit PIN: transport only, never persisted on client
}

/**
 * `POST /api/user/update` 返回值。
 *
 * 只声明页面可能消费的字段并整体放行其余字段：后端返回的是完整用户实体
 * （含 `balance` / `last_login_ip` / `platform` / `status` 等），
 * 前端仅同步必要的非敏感头像/昵称/年级状态，不持久化实体；
 * `/profile` 读取登录时缓存，更新后不能立即依赖它校验新值。
 */
const userUpdateSchema = z
  .object({
    id: z.number(),
    nick_name: z.string(),
    gender: z.string(),
    avatar_img: z.string().nullish(),
    kbs_id: z.string().nullish(),
    country: z.string().nullish(),
    province: z.string().nullish(),
    city: z.string().nullish(),
    points: z.number(),
    mobile: z.string().nullish(),
    real_name: z.string().nullish(),
    grade_id: z.number().nullish(),
    student_grade: z.string().nullish(),
    birthday: z.string().nullish(),
    consume_password_set: z.boolean().optional(),
  })
  .passthrough()

export type UserUpdateResult = z.infer<typeof userUpdateSchema>

export async function updateUserProfile(payload: UserUpdatePayload): Promise<UserUpdateResult> {
  const response = await httpClient.request<unknown>({
    method: 'POST',
    url: USER_UPDATE_PATH,
    data: payload,
  })

  const result = parseApiEnvelope(response, userUpdateSchema, {
    contract: 'user.update',
    fallbackMessage: '资料保存失败',
  })
  // The unified code=0 API response is the PIN save success criterion.
  // Do not add a second client-side PIN status acknowledgement requirement.
  if (payload.birthday !== undefined && result.birthday !== payload.birthday) {
    throw new Error('生日未保存，请稍后重试')
  }
  // Drop accidental echoes of a submitted secret from the parsed entity.
  const safeResult = { ...result }
  delete safeResult.consume_password
  return safeResult
}

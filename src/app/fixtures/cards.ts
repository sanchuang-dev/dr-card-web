/* ────────────────────────── 卡包、核销、转赠与兑换码 ────────────────────────── */

/** 卡包卡券状态（与 routes.ts `/card` 已登记的三个 `?state=` 一一对应：#62 / #63 / #64） */
export type CardCouponStatus = 'available' | 'used' | 'expired'

/**
 * 卡包卡券夹具（T009；reference/卡包.html 标准页）
 * - name / 金额 / 到期日照抄 reference 标准页，未自行改写
 * - ⚠️ 卡券库存、领取来源、转赠次数上限等业务规则未确认，此处仅确定性呈现，不定稿
 */
export interface CardCouponFixture {
  id: string
  /** 券名；带金额的券把金额单独放在 amountLabel，便于还原「¥20 + 券名」的排版 */
  name: string
  amountLabel?: string
  /** 到期日文案（照抄 reference，含「到期」二字由页面拼接） */
  expireAt: string
  status: CardCouponStatus
  /** 使用限制说明（reference 使用弹窗内的副标题） */
  limitNote: string
}

export const CARD_COUPON_FIXTURES: CardCouponFixture[] = [
  { id: 'c1', name: '核心洗发水体验券', expireAt: '2026-06-25', status: 'available', limitNote: '限到店核销' },
  { id: 'c2', name: '现金减免体验券', amountLabel: '¥20', expireAt: '2026-06-25', status: 'available', limitNote: '限到店核销' },
  { id: 'c3', name: '现金减免体验券', amountLabel: '¥20', expireAt: '2026-05-25', status: 'expired', limitNote: '限到店核销' },
]

/** 卡包 Tab（三态；与 `/card` 的 states 登记保持一致，不额外引入「全部」） */
export const CARD_PACK_TABS: Array<{ key: CardCouponStatus; label: string }> = [
  { key: 'available', label: '可用' },
  { key: 'used', label: '已使用' },
  { key: 'expired', label: '已过期' },
]

/** 卡包底部使用说明（照抄 reference 标准页三条） */
export const CARD_PACK_TIPS = [
  '可用卡片可直接使用或转赠给好友',
  '已使用的兑换码可以在这里查询',
  '已过期的兑换码将无法使用',
]

export function cardCouponsByStatus(status: CardCouponStatus): CardCouponFixture[] {
  return CARD_COUPON_FIXTURES.filter((item) => item.status === status)
}

export function cardCouponCount(status: CardCouponStatus): number {
  return cardCouponsByStatus(status).length
}

export function resolveCardCoupon(id: string | null): CardCouponFixture {
  const found = CARD_COUPON_FIXTURES.find((item) => item.id === id)
  return found ?? CARD_COUPON_FIXTURES[0]
}

/**
 * 分享接收人夹具（T009 #65；人名、头像首字、单选交互取自 reference/分享.html「搭子列表」）
 * id 使用仅存在于 preview Mock 的数值用户 ID，使 Mock 与真实 `/api/coupons/give`
 * 共用同一 `friend_id` 契约；它们不是真实账号。
 */
export interface ShareTargetFixture {
  id: string
  name: string
  /** 头像占位字（reference 原稿即为姓名首字） */
  initial: string
}

export const SHARE_TARGET_FIXTURES: ShareTargetFixture[] = [
  { id: '9001', name: '小美', initial: '小' },
  { id: '9002', name: '阿轩', initial: '轩' },
  { id: '9003', name: '泡泡同学', initial: '泡' },
  { id: '9004', name: '室友小婷', initial: '婷' },
]

/**
 * 分享成功页商品卡夹具（T009 #66；字段照抄 reference/分享成功.html）
 * B-017 已关闭：`洗发试用装 / 已发货 / 单次使用` 仅作为原型展示夹具，
 * 「已发货」不代表分享操作触发真实发货，不实现任何物流规则。
 */
export interface ShareProductFixture {
  name: string
  date: string
  shipping: string
  tag: string
}

export const SHARE_PRODUCT_FIXTURE: ShareProductFixture = {
  name: '洗发试用装',
  date: '2024.01.08',
  shipping: '已发货',
  tag: '单次使用',
}

/**
 * 核销凭证夹具（T009 #67；门店、明细、时间照抄现有已验收实现）
 * ⚠️ 门店归属、核销时效、重复核销的服务端判定规则未确认，此处仅确定性呈现，不定稿
 */
export interface VerifyVoucherFixture {
  store: string
  address: string
  items: string
  validUntil: string
  quantity: string
  verifyTime: string
}

export const VERIFY_VOUCHER_FIXTURE: VerifyVoucherFixture = {
  store: '泡泡洗护 · 朝阳大悦城店',
  address: '北京市朝阳区青年路 5 号大悦城 B1-038',
  items: '洗发水 / 护发素 / 沐浴露 体验装',
  validUntil: '2026-09-30',
  quantity: '1 张',
  verifyTime: '2026-08-13 09:41',
}

/** 消费密码位数（reference 标准页：6 位数字） */
export const VERIFY_PASSWORD_LENGTH = 6

/**
 * 核销反馈文案（T009 #67）
 * ⚠️ 重复核销的服务端判定条件（同券同店、时效窗口等）未确认，这里只给中性拦截提示，
 *    不写入任何判定规则；确认后按新口径替换本处文案。
 */
export const VERIFY_FEEDBACK = {
  done: { title: '核销成功', desc: '权益已扣减，可在卡包「已使用」中查看' },
  repeat: { title: '该券已核销', desc: '这张券已经完成核销，无法重复使用' },
} as const

/** 兑换码唯一前端校验：至少 10 个字符，不限制字符类型或最大长度。 */
export interface RedeemCodeRule {
  minLength: number
  hint: string
}

export const REDEEM_CODE_RULE: RedeemCodeRule = {
  minLength: 10,
  hint: '兑换码不少于 10 位',
}

/** 兑换结果分支（#68 失败态 / #69 成功态） */
export type RedeemOutcome = 'success' | 'format' | 'invalid' | 'used' | 'network'

export interface RedeemFeedbackFixture {
  outcome: RedeemOutcome
  ok: boolean
  text: string
}

/** 反馈文案：成功/格式错误照抄 reference 标准页；其余分支为服务端失败态的中性提示，不含未确认的业务规则 */
export const REDEEM_FEEDBACK: Record<RedeemOutcome, RedeemFeedbackFixture> = {
  success: { outcome: 'success', ok: true, text: '兑换成功，已存入卡包' },
  format: { outcome: 'format', ok: false, text: '兑换码不能少于 10 位' },
  invalid: { outcome: 'invalid', ok: false, text: '兑换码无效，请核对后重试' },
  used: { outcome: 'used', ok: false, text: '该兑换码已被使用' },
  network: { outcome: 'network', ok: false, text: '网络异常，请稍后重试' },
}

/**
 * 确定性兑换码 → 结果映射（禁止随机）
 * 仅登记演示专用码：真实 API 绝不调用这个函数。
 * 未登记的任意字符串按“无效码”演示，不用默认成功掩盖异常。
 */
export const REDEEM_CODE_OUTCOMES: Record<string, RedeemOutcome> = {
  DRCARD000888: 'success',
  DRCARD000404: 'invalid',
  DRCARD000USE: 'used',
  DRCARD000NET: 'network',
}

/**
 * 各分支的演示码：仅供 `?state=` 直达截图时回填输入框，不构成任何兑换码规则。
 * format 分支故意给一个位数不足的码，用于呈现格式错误反馈。
 */
export const REDEEM_SAMPLE_CODES: Record<RedeemOutcome, string> = {
  success: 'DRCARD000888',
  format: 'DRCARD08',
  invalid: 'DRCARD000404',
  used: 'DRCARD000USE',
  network: 'DRCARD000NET',
}

/** 判定兑换结果：先按配置规则校验格式，再查确定性映射 */
export function resolveRedeemOutcome(input: string): RedeemOutcome {
  const code = input
  if (code.length < REDEEM_CODE_RULE.minLength) return 'format'
  return REDEEM_CODE_OUTCOMES[code.toUpperCase()] ?? 'invalid'
}

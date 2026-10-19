import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarDays, Check, Clock, Info, KeyRound, QrCode, ReceiptText, Ticket, X } from 'lucide-react'
import DebugPanel from '../components/mobile/DebugPanel'
import PageContainer from '../components/mobile/PageContainer'
import { Button, EmptyState, Skeleton } from '../components/ui'
import { isAppError } from '../lib/appError'
import { useFixtureState, useOverlay } from '../app/fixtures/useFixture'
import { findRouteByPathname } from '../app/router/routes'
import { runtimePolicy } from '../app/config/runtime'
import {
  CARD_PACK_TABS,
  CARD_PACK_TIPS,
  resolveCardCoupon,
  type CardCouponStatus,
  COUPON_USE_GUIDE,
} from '../app/fixtures'
import { probeDiscountCardList, type DiscountCardProbeResponse } from '../services/cardPackageProbe'
import {
  fetchMyCoupons,
  MY_COUPONS_PAGE_SIZE_MAX,
  type MyCouponRecord,
  type MyCouponType,
} from '../services/myCoupons'
import { fetchRedeemedLocalCards, type LocalUserCard } from '../services/myRedeemedCards'

/**
 * 电影票样式卡券（自营页面专用 - 第一版）
 * -------------------------------------------------------------
 * 视觉特征：
 *  - 横向票，左右两端各一个半圆缺口（撕齿效果）
 *  - 中间用虚线分隔线把票分成两半：
 *    左半：金色渐变色块（active）/ 灰色（used/expired），大金额 + 副券名
 *    右半：白底，标题 + 到期 + 状态 + 使用须知 + 操作按钮
 *  - 底部细灰色券号（票根感）
 * - 把所有样式 inline 写在本组件里，方便后续整体替换为更精细的版本。
 * - 不引入 CSS 变量，固定值先用 Tailwind class 表达；金色渐变通过 inline style 注入。
 */
/**
 * 票券视图模型：分别映射第三方 MyCoupons 与本地 source=60 兑换码卡券。
 * 原始金额与完整有效期仍保留在 service/domain 数据中；这里仅做展示映射。
 */
interface CouponTicketView {
  id: string | null
  origin?: 'local'
  name: string
  amountLabel?: string
  validityLabel?: string
  limitNote?: string
}

interface MovieTicketProps {
  coupon: CouponTicketView
  /** 是否已过期（叠加全卡 opacity） */
  expired?: boolean
  /** 是否已使用（左右色块灰化，但保留布局） */
  used?: boolean
  onUse: () => void
  onShare: () => void
}

function toAmountLabel(value: string | number | null | undefined): string | undefined {
  if (value == null) return undefined
  const text = String(value).trim()
  return text || undefined
}

/** 用户持券记录 → 卡包票券视图；不混入券模板字段。 */
function toCouponTicketView(coupon: MyCouponRecord): CouponTicketView {
  return {
    id: coupon.id == null ? null : String(coupon.id).trim() || null,
    name: coupon.active_name?.trim() || '体验券',
    amountLabel: toAmountLabel(coupon.enable_amount),
    validityLabel: coupon.valid_date_range?.trim() || undefined,
    limitNote: coupon.dc_type_format?.trim() || undefined,
  }
}

/** 本地卡券只按后台状态展示，不借用第三方 MyCoupons 的券 ID 和使用/转赠入口。 */
function toLocalCardView(card: LocalUserCard): CouponTicketView {
  const epoch = Number(card.valid_end_time)
  const validityLabel = card.valid_end_time != null && Number.isFinite(epoch) && epoch > 0
    ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(epoch * 1000)) + ' 到期'
    : undefined
  return {
    origin: 'local',
    id: 'local-' + String(card.id),
    name: card.card_name,
    amountLabel: card.card_type === 20 ? toAmountLabel(card.face_value) : undefined,
    validityLabel,
    limitNote: card.card_sn ? `兑换码领取 · ${card.card_sn}` : '兑换码领取',
  }
}

const LOCAL_CARD_STATUS_BY_TAB: Record<CardCouponStatus, number> = {
  available: 10,
  used: 20,
  expired: 30,
}

const MY_COUPON_TYPE_BY_STATUS: Record<CardCouponStatus, MyCouponType> = {
  available: 'unused',
  used: 'used',
  expired: 'out_of_date',
}

type LocalCardsRemote =
  | { state: 'loading' }
  | { state: 'success'; cards: LocalUserCard[] }
  | { state: 'error'; message: string }

type CouponRemote =
  | { state: 'loading' }
  | { state: 'success'; coupons: MyCouponRecord[]; total: number }
  | { state: 'error'; message: string }

function createInitialCouponLists(): Record<CardCouponStatus, CouponRemote> {
  return {
    available: { state: 'loading' },
    used: { state: 'loading' },
    expired: { state: 'loading' },
  }
}

const NOTCH_SIZE = 14 // 两端半圆缺口直径（px）

function MovieTicket({ coupon, expired, used, onUse, onShare }: MovieTicketProps) {
  const isInactive = expired || used
  /** 左半色块：金 vs 灰 */
  const leftBg = isInactive
    ? 'linear-gradient(135deg, #bdbdbd 0%, #9e9e9e 100%)'
    : 'linear-gradient(135deg, var(--color-reward) 0%, var(--color-reward-strong) 100%)'
  /** 操作按钮可用性 */
  // A third-party record without a log ID must never trigger use/transfer.
  const canAction = !isInactive && coupon.id !== null && coupon.origin !== 'local'
  return (
    <article
      className="relative"
      aria-label={`${coupon.name}${coupon.amountLabel ?? ''} - ${isInactive ? (expired ? '已过期' : '已使用') : '可用'}`}
    >
      {/* 外层卡片 + 圆角 + 阴影；overflow-hidden 负责裁掉左右两个 notch 的内圈 */}
      <div className={`relative overflow-hidden rounded-[16px] bg-surface shadow-sm ${expired ? 'opacity-90' : ''}`}>
        {/* 左端半圆缺口（撕齿）：用绝对定位的圆形 + 与背景同色覆盖实现 */}
        <span
          aria-hidden
          className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface-inactive"
          style={{ width: NOTCH_SIZE, height: NOTCH_SIZE }}
        />
        <span
          aria-hidden
          className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 rounded-full bg-surface-inactive"
          style={{ width: NOTCH_SIZE, height: NOTCH_SIZE }}
        />

        {/* 主体：flex 左右两栏 */}
        <div className="flex w-full min-w-0">
          {/* 左半：色块区 */}
          <div
            className="flex flex-col items-center justify-center px-4 py-4 text-center"
            style={{
              background: leftBg,
              // The left piece stays bounded so Chromium 88 has space to shrink the right pane.
              width: '36%',
              minWidth: 108,
              maxWidth: 128,
              flex: '0 0 36%',
            }}
            aria-hidden
          >
            {coupon.amountLabel ? (
              <div className="flex items-baseline gap-0.5 leading-none text-white">
                <span className="text-lg font-semibold">¥</span>
                <span className="text-[34px] font-bold tracking-tight">{coupon.amountLabel.replace('¥', '')}</span>
              </div>
            ) : (
              <Ticket className="h-7 w-7 text-white" strokeWidth={1.8} />
            )}
            <span className="mt-2 text-[11px] font-medium tracking-widest text-white/85">卡券</span>
          </div>

          {/* 中间虚线撕齿分隔 */}
          <div
            aria-hidden
            className="my-3 border-l border-dashed"
            style={{ borderColor: isInactive ? '#cfcfcf' : 'var(--color-reward-soft)' }}
          />

          {/* 右半：内容区 */}
          <div className="min-w-0 flex-1 px-3 py-3" style={{ minWidth: 0, flex: '1 1 0%' }}>
            <div className="flex min-w-0 items-start justify-between gap-2">
              <h3
                className={`min-w-0 flex-1 text-[15px] font-semibold leading-5 ${isInactive ? 'text-coupon-used' : 'text-text-primary'}`}
                style={{
                  minWidth: 0,
                  // -webkit-line-clamp is supported by legacy Chromium 88; avoid unsupported CSS line-clamp.
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  overflowWrap: 'anywhere',
                }}
              >
                {coupon.name}
              </h3>
              <span
                className={`inline-flex h-5 flex-none items-center gap-1 rounded-full px-2 text-[10px] font-semibold ${
                  expired
                    ? 'bg-surface-inactive text-text-inactive-muted'
                    : used
                      ? 'bg-coupon-used-bg text-coupon-used'
                      : 'bg-reward-subtle text-reward-text'
                }`}
              >
                {expired ? <Clock className="h-3 w-3" /> : used ? <ReceiptText className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                {expired ? '已过期' : used ? '已使用' : '可用'}
              </span>
            </div>

            {coupon.validityLabel && (
              <div className={`mt-1.5 flex min-w-0 items-start gap-1 break-all text-[11px] ${isInactive ? 'text-text-inactive-muted' : 'text-text-tertiary'}`}>
                <CalendarDays className="mt-0.5 h-3 w-3 flex-none" />
                {coupon.validityLabel}
              </div>
            )}

            {coupon.limitNote && (
              <div className={`mt-1 min-w-0 break-all text-[11px] ${isInactive ? 'text-text-inactive-muted' : 'text-text-tertiary'}`}>
                {coupon.limitNote}
              </div>
            )}

            {/* 操作按钮：等宽并列、无主辅关系。
             *  使用：橙色实心 pill；转赠：白底描边 pill。
             *  两个按钮 flex-1 平分宽度，视觉权重一致。
             *  已过期：两按钮都禁用；已使用：使用按钮隐藏（演示态）。 */}
            <div className="mt-3 flex min-w-0 items-center gap-2">
              {!used && !expired && (
                <button
                  type="button"
                  onClick={onUse}
                  disabled={!canAction}
                  className="h-8 min-w-0 flex-1 rounded-full bg-primary px-1 text-[12px] font-semibold text-text-inverse shadow-primary-button active:bg-primary-pressed disabled:opacity-50"
                >
                  使用
                </button>
              )}
              <button
                type="button"
                onClick={onShare}
                disabled={!canAction}
                className={`h-8 min-w-0 flex-1 rounded-full border px-1 text-[12px] font-semibold ${
                  canAction
                    ? 'border-border-strong bg-transparent text-text-secondary active:bg-surface-subtle'
                    : 'border-border bg-transparent text-text-inactive-muted'
                }`}
              >
                转赠
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

// Reserve the height and two-column silhouette of the real coupon ticket.
function CouponTicketSkeleton() {
  return (
    <div role="status" aria-label="正在加载体验券" className="space-y-4">
      <span className="sr-only">正在加载体验券</span>
      {[0, 1].map((index) => (
        <div key={index} aria-hidden="true" className="flex min-h-[166px] overflow-hidden rounded-[16px] bg-surface shadow-sm">
          <div className="flex w-[36%] min-w-[108px] max-w-[128px] shrink-0 flex-col items-center justify-center gap-3 bg-reward-subtle px-4">
            <Skeleton className="h-9 w-14" />
            <Skeleton className="h-3 w-12" />
          </div>
          <div className="min-w-0 flex-1 space-y-3 border-l border-dashed border-border-subtle px-4 py-4">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="h-3 w-2/3" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-8 flex-1 rounded-pill" />
              <Skeleton className="h-8 flex-1 rounded-pill" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Card() {
  const navigate = useNavigate()
  const route = findRouteByPathname('/card')
  const { state } = useFixtureState(route)
  const { overlay, close } = useOverlay()
  const [searchParams, setSearchParams] = useSearchParams()
  const apiProbeEnabled = import.meta.env.DEV && searchParams.get('apiProbe') === '1'
  const apiProbeSigned = Boolean(import.meta.env.VITE_CARD_API_TOKEN && import.meta.env.VITE_CARD_API_SALT)
  const [apiProbe, setApiProbe] = useState<
    | { state: 'loading' }
    | { state: 'success'; response: DiscountCardProbeResponse }
    | { state: 'error'; message: string }
    | null
  >(null)
  const apiProbeRequestRef = useRef<Promise<DiscountCardProbeResponse> | null>(null)

  /** 节点 #62/#63/#64：Tab 初值来自 `?state=`，验收可直达 URL 截图 */
  const [tab, setTab] = useState<CardCouponStatus>((state?.key as CardCouponStatus) ?? 'available')

  /** `?state=` 变化时同步可见 Tab（调试面板切换状态走的就是这条链路） */
  useEffect(() => {
    setTab((state?.key as CardCouponStatus) ?? 'available')
  }, [state?.key])

  const [couponLists, setCouponLists] = useState<Record<CardCouponStatus, CouponRemote>>(
    createInitialCouponLists,
  )
  const [retryVersion, setRetryVersion] = useState(0)
  const [localCardsRemote, setLocalCardsRemote] = useState<LocalCardsRemote>({ state: 'loading' })

  /** 本地兑换码卡券独立加载，不把它混作第三方优惠卡记录。 */
  useEffect(() => {
    let active = true
    if (runtimePolicy.dataMode === 'mock') {
      setLocalCardsRemote({ state: 'success', cards: [] })
      return () => { active = false }
    }
    setLocalCardsRemote({ state: 'loading' })
    void fetchRedeemedLocalCards()
      .then((cards) => { if (active) setLocalCardsRemote({ state: 'success', cards }) })
      .catch((error: unknown) => {
        if (active) setLocalCardsRemote({
          state: 'error',
          message: isAppError(error) && error.kind === 'contract'
            ? '兑换码卡券数据暂时无法展示，请稍后重试'
            : error instanceof Error ? error.message : '网络请求失败',
        })
      })
    return () => { active = false }
  }, [retryVersion])

  /**
   * MyCoupons 没有分页 UI，因此每个分类按服务端允许的最大 pageSize 拉取，
   * 若仍有后续页则内部聚合；Tab badge 始终使用接口 total，而不是当前页长度。
   */
  useEffect(() => {
    let active = true

    const loadStatus = async (status: CardCouponStatus) => {
      const type = MY_COUPON_TYPE_BY_STATUS[status]
      try {
        const first = await fetchMyCoupons({ type, page: 1, pageSize: MY_COUPONS_PAGE_SIZE_MAX })
        const remainingPages = Array.from(
          { length: Math.max(0, first.last_page - 1) },
          (_, index) => index + 2,
        )
        const rest = await Promise.all(
          remainingPages.map((page) =>
            fetchMyCoupons({ type, page, pageSize: MY_COUPONS_PAGE_SIZE_MAX }),
          ),
        )
        if (!active) return

        setCouponLists((current) => ({
          ...current,
          [status]: {
            state: 'success',
            coupons: [first, ...rest].flatMap((page) => page.data),
            total: first.total,
          },
        }))
      } catch (error: unknown) {
        if (!active) return
        setCouponLists((current) => ({
          ...current,
          [status]: {
            state: 'error',
            message: isAppError(error) && error.kind === 'contract'
              ? '体验券数据暂时无法展示，请稍后重试'
              : error instanceof Error ? error.message : '网络请求失败',
          },
        }))
      }
    }

    for (const item of CARD_PACK_TABS) void loadStatus(item.key)

    return () => {
      active = false
    }
  }, [retryVersion])

  const retryCouponList = () => {
    setLocalCardsRemote({ state: 'loading' })
    setCouponLists((current) => ({ ...current, [tab]: { state: 'loading' } }))
    setRetryVersion((version) => version + 1)
  }

  const currentRemote = couponLists[tab]
  const localCards = localCardsRemote.state === 'success'
    ? localCardsRemote.cards.filter((card) => card.status === LOCAL_CARD_STATUS_BY_TAB[tab]).map(toLocalCardView)
    : []
  const list = [
    ...(currentRemote.state === 'success' ? currentRemote.coupons.map(toCouponTicketView) : []),
    ...localCards,
  ]

  const availableCoupons =
    couponLists.available.state === 'success'
      ? couponLists.available.coupons.map(toCouponTicketView)
      : []

  /**
   * 使用弹层优先匹配真实 MyCoupons 记录。
   * 只有 preview/dev fixture 环境允许用历史夹具支撑 ?coupon= 深链截图；
   * test/prod 的真实 API 模式禁止未命中时静默显示假券。
   */
  const activeCoupon: CouponTicketView | null = useMemo(() => {
    const couponId = searchParams.get('coupon')
    const fromApi = couponId ? availableCoupons.find((item) => item.id === couponId) : undefined
    if (fromApi) return fromApi
    if (!runtimePolicy.fixtureQueriesEnabled) return null

    const fixture = resolveCardCoupon(couponId)
    return {
      id: fixture.id,
      name: fixture.name,
      amountLabel: fixture.amountLabel,
      validityLabel: fixture.expireAt ? `${fixture.expireAt} 到期` : undefined,
      limitNote: fixture.limitNote,
    }
  }, [availableCoupons, searchParams])

  const couponCount = (key: CardCouponStatus) => {
    const remote = couponLists[key]
    const externalCount = remote.state === 'success' ? remote.total : 0
    const localCount = localCardsRemote.state === 'success'
      ? localCardsRemote.cards.filter((card) => card.status === LOCAL_CARD_STATUS_BY_TAB[key]).length
      : 0
    return externalCount + localCount
  }

  useEffect(() => {
    if (!apiProbeEnabled) {
      setApiProbe(null)
      apiProbeRequestRef.current = null
      return
    }

    setApiProbe({ state: 'loading' })
    const request = (apiProbeRequestRef.current ??= probeDiscountCardList())
    let active = true

    void request
      .then((response) => {
        if (active) setApiProbe({ state: 'success', response })
      })
      .catch((error: unknown) => {
        if (active) {
          setApiProbe({
            state: 'error',
            message: error instanceof Error ? error.message : '网络请求失败',
          })
        }
      })

    return () => {
      active = false
    }
  }, [apiProbeEnabled])

  /** 切换 Tab 时把状态同步写回 `?state=`，保证 URL 始终等于页面真实状态（验收可直达截图） */
  const selectTab = (next: CardCouponStatus) => {
    setTab(next)
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        params.set('state', next)
        params.delete('overlay')
        params.delete('coupon')
        return params
      },
      { replace: true },
    )
  }

  const openUseSheet = (coupon: CouponTicketView) => {
    const couponId = coupon.id
    if (!couponId) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('coupon', couponId)
        next.set('overlay', 'use')
        return next
      },
      { replace: true },
    )
  }

  return (
    <PageContainer className="pb-24">
      {apiProbeEnabled && (
        <section className="mb-4 rounded-xl border border-border-subtle bg-surface p-3 text-xs" aria-live="polite">
          <div className="font-semibold text-text-primary">后台连通性探测</div>
          {apiProbe?.state === 'loading' && <p className="mt-1 text-text-secondary">请求中…</p>}
          {apiProbe?.state === 'error' && <p className="mt-1 text-text-secondary">请求失败：{apiProbe.message}</p>}
          {apiProbe?.state === 'success' && (
            <p className="mt-1 text-text-secondary">
              HTTP 已到达；code={apiProbe.response.code} · status={apiProbe.response.status} · {apiProbe.response.msg}
            </p>
          )}
          <p className="mt-1 text-text-tertiary">
            {apiProbeSigned
              ? '当前使用运行时 token/salt 计算 secstr；敏感值未写入页面代码。'
              : '当前未配置 token/salt，仅用于验证浏览器到上游接口的连通性。'}
          </p>
        </section>
      )}
      <div className="flex gap-2 rounded-xl border border-border-subtle bg-surface p-1" role="tablist" aria-label="卡包状态">
        {CARD_PACK_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => selectTab(item.key)}
            className={`flex h-10 flex-1 items-center justify-center gap-1 rounded-lg border border-transparent text-sm ${
              tab === item.key ? 'border-primary bg-surface text-text-brand' : 'text-text-secondary'
            }`}
          >
            {item.label}
            <span
              className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] ${
                tab === item.key
                  ? 'bg-surface-selected text-text-brand'
                  : 'bg-surface-inactive text-text-inactive-muted'
              }`}
            >
              {couponCount(item.key)}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4" aria-live="polite" aria-busy={currentRemote.state === 'loading' || localCardsRemote.state === 'loading'}>
        {list.map((coupon, index) => (
            <MovieTicket
              key={(coupon.origin ?? 'external') + '-' + (coupon.id ?? ('missing-id-' + index))}
              coupon={coupon}
              used={tab === 'used'}
              expired={tab === 'expired'}
              onUse={() => openUseSheet(coupon)}
              onShare={() => {
                if (coupon.origin !== 'local' && coupon.id) navigate('/card/share?coupon=' + encodeURIComponent(coupon.id))
              }}
            />
          ))}

        {list.length === 0 && (currentRemote.state === 'loading' || localCardsRemote.state === 'loading') && <CouponTicketSkeleton />}

        {currentRemote.state === 'error' && (
          <EmptyState
            variant="recoverable-error"
            className="min-h-[180px]"
            title="体验券加载失败"
            supportingText={currentRemote.message}
            primaryAction={
              <Button variant="outline" onClick={retryCouponList}>重试</Button>
            }
          />
        )}

        {localCardsRemote.state === 'error' && (
          <div role="alert" className="rounded-xl bg-surface p-3 text-sm text-text-secondary">
            <p>兑换码卡券加载失败：{localCardsRemote.message}</p>
            <button type="button" className="mt-2 text-text-brand" onClick={retryCouponList}>重试兑换码卡券</button>
          </div>
        )}

        {currentRemote.state === 'success' && localCardsRemote.state === 'success' && list.length === 0 && (
          <EmptyState
            variant="no-data"
            className="min-h-[180px]"
            title={
              tab === 'available'
                ? '暂无可用的体验券'
                : tab === 'used'
                  ? '暂无已使用的体验券'
                  : '暂无已过期的体验券'
            }
            supportingText={
              tab === 'available'
                ? '领取到的体验券，会显示在这里'
                : tab === 'used'
                  ? '已核销或已完成使用的体验券，会显示在这里'
                  : '超过有效期的体验券，会显示在这里'
            }
          />
        )}
      </div>

      <div className="mt-4 space-y-3 rounded-2xl bg-surface p-4 shadow-sm">
        {CARD_PACK_TIPS.map((tip, index) => (
          <div key={tip} className="flex items-center gap-2.5">
            <span className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-reward-subtle text-[11px] font-bold text-reward-text">
              {index + 1}
            </span>
            <span className="text-sm text-text-secondary">{tip}</span>
          </div>
        ))}
      </div>

      {overlay === 'use' && activeCoupon && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="使用体验券"
            className="w-full max-w-[448px] rounded-t-overlay bg-surface px-4 pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-border" aria-hidden />
            <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-1">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">使用体验券</h2>
                <p className="text-sm text-text-tertiary">{COUPON_USE_GUIDE.subtitle}</p>
              </div>
              <button type="button" aria-label="关闭" onClick={close} className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface-subtle text-text-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 py-3">
              {/* T044｜原「查看商城体验券商品」按钮改为纯展示块，去掉 onClick/aria-label/ChevronRight。
               *  不加 pill 背景，仅保留图标 + 文案，作为下方核销 pill 的「标题/上下文」。
               *  mt-4 仍保留，与下方核销 pill 间距加大。 */}
              <div className="-m-2.5 flex items-center gap-3 rounded-xl p-2.5">
                <span className="flex h-10 w-10 flex-none items-center justify-center self-center rounded-full bg-surface text-reward-strong shadow-sm">
                  <Ticket className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-text-primary">
                    {activeCoupon.amountLabel ? `${activeCoupon.amountLabel} ${activeCoupon.name}` : activeCoupon.name}
                  </span>
                  {(activeCoupon.validityLabel || activeCoupon.limitNote) && (
                    <span className="block text-xs text-text-tertiary">
                      {[activeCoupon.validityLabel ?? null, activeCoupon.limitNote ?? null]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </span>
              </div>

              {/* T044｜移除 radio 圆圈与二选一控件，改为两行并列的使用指引。
               *  扫码核销：系统会优先抵扣体验券
               *  消费密码核销：在设备上输入手机号和 6 位消费密码，点击确认即可领取
               *  mt-4：券卡与下方核销 pill 之间加大间距（PRD 要求）。 */}
              <div className="mt-4 space-y-2">
                {/* T044｜两个 pill 高度统一 h-20，icon + 文字 self-center 上下居中。
                 *  扫码/密码两行文案长度不同，靠固定高度 + flex 居中让两个 pill 视觉一致。 */}
                <button
                  type="button"
                  onClick={() => navigate('/card/verify')}
                  className="flex h-20 w-full items-center gap-3 rounded-pill bg-surface-subtle p-3 text-left active:bg-surface-selected"
                >
                  <span className="flex h-10 w-10 flex-none items-center justify-center self-center rounded-full bg-surface text-reward-strong shadow-sm">
                    <QrCode className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1 self-center">
                    <span className="block text-sm font-medium text-text-primary">扫码核销</span>
                    <span className="mt-1 block text-xs leading-4 text-text-tertiary">
                      {COUPON_USE_GUIDE.scanHint}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/card/verify/password')}
                  className="flex h-20 w-full items-center gap-3 rounded-pill bg-surface-subtle p-3 text-left active:bg-surface-selected"
                >
                  <span className="flex h-10 w-10 flex-none items-center justify-center self-center rounded-full bg-surface text-reward-strong shadow-sm">
                    <KeyRound className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1 self-center">
                    <span className="block text-sm font-medium text-text-primary">消费密码核销</span>
                    <span className="mt-1 block text-xs leading-4 text-text-tertiary">
                      {COUPON_USE_GUIDE.passwordHint}
                    </span>
                  </span>
                </button>
              </div>

              <div className="mt-3 flex items-start gap-2 rounded-lg bg-surface-subtle p-3">
                <Info className="mt-0.5 h-4 w-4 flex-none text-text-tertiary" />
                <p className="text-xs text-text-secondary">{COUPON_USE_GUIDE.footnote}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <DebugPanel route={route} />
    </PageContainer>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Droplets, PartyPopper, Ticket } from 'lucide-react'
import DebugPanel from '../components/mobile/DebugPanel'
import EmptyStateIllustration from '../components/mobile/EmptyStateIllustration'
import PageContainer from '../components/mobile/PageContainer'
import PromptOverlay from '../components/mobile/PromptOverlay'
import BubbleValueRedeemCard from '../components/card/BubbleValueRedeemCard'
import { Button, EmptyState, SegmentedControl } from '../components/ui'
import { findRouteByPathname } from '../app/router/routes'
import { runtimePolicy } from '../app/config/runtime'
import { useUserPointsStat } from './points/usePointsFeed'
import { useExchangeCategories, useExchangeCoupons } from './exchange/useExchangeFeed'
import { EXCHANGE_COPY } from '../app/fixtures'
import type { CouponRedeemView } from '../services/coupons'
import { redeemExchangeProduct, type ExchangeRedeemResult } from '../services/exchange'
import kitThumb from '../assets/brand/member/checkin-dearseed-kit.webp'
import ProjectSelectScreen from './exchange/ProjectSelectScreen'

/** 接口 `image` 为空时的券图兜底（沿用已验收品牌图，不新增假字段）。 */
const COUPON_COVER_FALLBACK = kitThumb

const EXCHANGE_REQUEST_ERROR_COPY = '兑换失败，请稍后重试'

type ExchangeAvailability = 'redeemable' | 'insufficient' | 'sold-out' | 'balance-unavailable'

/**
 * 券可兑换状态（与接口字段口径对齐）：
 * - `sold-out` ← 接口 `exchanged_nuuur >= total_number` 或已下架（service 已收敛为 `soldOut`）；
 * - `insufficient` ← 所需泡泡值 `points_number` 高于当前用户可用余额；
 * - 其余为 `redeemable`。
 */
function resolveAvailability(coupon: CouponRedeemView, balance: number | null): ExchangeAvailability {
  if (coupon.soldOut) return 'sold-out'
  if (balance == null) return 'balance-unavailable'
  return coupon.cost > balance ? 'insufficient' : 'redeemable'
}

const availabilityButtonLabel = (state: ExchangeAvailability): string =>
  state === 'sold-out'
    ? EXCHANGE_COPY.soldOut
    : state === 'insufficient'
      ? EXCHANGE_COPY.insufficient
      : EXCHANGE_COPY.action

/**
 * 洗护体验券兑换专区（#18 / #37 / #38 / #39）
 * -------------------------------------------------------------
 * 事实源：docs/prototype/04-mall-card-order.md §1–§3；用户 2026-09-29 提供的界面参考图（图一）。
 * 接口来源：`GET /api/coupons/index`（7002「优惠券管理」，券列表接口，用户 2026-09-29 提供图二）。
 * 已确认：顶部「我的泡泡值 + 立即兑换」余额条、后台动态分类 Tab、两列体验券卡
 *        （券图 / 名称 / 所需泡泡值 / 兑换量 / 已兑完遮罩 / 兑换按钮）、
 *        点击券卡打开全屏适用片区选择（券摘要 / 搜索分页 / 单选 / 确认兑换）。
 *
 * 数据口径（2026-09-29 与产品确认）：
 * - 当前真实业务只开放「通用体验包」兑换；多分类 / 多券页面结构保留，作为后续恢复多体验券时的扩展位，
 *   不代表当前后端必须实现多 SKU 兑换；
 * - 分类从 couponscategory/index(pid=0) 动态读取；CouponsIndex DTO 仅声明分页，
 *   不臆测 category_id 服务端过滤有效；读取完整券目录并校验分页后才允许本地分类，
 *   不允许单页假筛选；错误明确阻断。UX-E 保留页面内部分类状态，不走 URL；
 * - 卡片所需泡泡值 ← `points_number`，兑换量 ← `exchanged_nuuur`，
 *   已兑完 ← `exchanged_nuuur >= total_number` 或已下架，泡泡值不足 ← `points_number > 我的余额`；
 * - 接口无 `desc` / `image` 时分别用 `short_desc` 与本地品牌图兜底。
 *
 * ⚠️ B-024 / B-025 / B-026：排序方向、完整 SKU 清单与泡泡值扣减 / 卡包写入均为服务端规则，
 *    页面只展示接口结果，不做持久化扣减。
 * UX-E（2026-10-09）：分类 / 券选择 / 确认 / 兑换结果只用组件状态，绝不通过 URL 驱动。
 * #74：兑换动作统一走 POST /api/coupons/exchange；库存、扣泡泡值、流水、发券及失败补偿均由后端负责。
 */
export default function Exchange() {
  const navigate = useNavigate()
  const route = findRouteByPathname('/exchange')
  /** UX-E 分类为页面本地状态；真实分类 key 来自后台，绝不靠 URL/硬编码维护。 */
  const [category, setCategory] = useState<string>('all')
  const [activeProductId, setActiveProductId] = useState<string | null>(null)
  const [redeemResult, setRedeemResult] = useState<ExchangeRedeemResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const submissionLock = useRef(false)
  const couponListRef = useRef<HTMLElement>(null)

  const { remote: categoriesRemote, reload: reloadCategories } = useExchangeCategories()
  const categoryOptions = categoriesRemote.state === 'success' ? categoriesRemote.data : []
  const validCategory = category === 'all' || categoryOptions.some(option => option.key === category)
  // Selected categories are never silently treated as 'all' while backend options are unavailable.
  const categoryPending = category !== 'all' && (categoriesRemote.state !== 'success' || !validCategory)
  const { remote: listRemote, reload: reloadCoupons } = useExchangeCoupons(
    category === 'all' ? undefined : category,
    !categoryPending,
  )
  const list = listRemote.state === 'success' ? listRemote.data : []

  useEffect(() => {
    if (categoriesRemote.state !== 'success' || validCategory) return
    // Backend removed this category: reset selection and stale redeem sheet, not the URL.
    setCategory('all')
    setActiveProductId(null)
    setSubmitError(null)
  }, [categoriesRemote.state, validCategory])

  /** GET /api/userpoints/stat：余额严格取 points。兑换结果不在页面伪扣款。 */
  const { remote: statRemote, reload: reloadPoints } = useUserPointsStat()
  const balance = statRemote.state === 'success' ? statRemote.data.points : null

  // Resolve against current list to prevent a stale coupon selection after a reload.
  const activeProduct = activeProductId === null || categoryPending
    ? null
    : list.find((product) => String(product.id) === activeProductId) ?? null
  const availability = activeProduct ? resolveAvailability(activeProduct, balance) : 'balance-unavailable'

  const closeRedeem = () => {
    if (submissionLock.current) return
    setActiveProductId(null)
    setSubmitError(null)
  }

  const changeCategory = (value: string) => {
    if (submissionLock.current) return
    const next = value === 'all' || categoryOptions.some(option => option.key === value) ? value : 'all'
    setCategory(next)
    setActiveProductId(null)
    setSubmitError(null)
  }

  const openRedeem = (product: CouponRedeemView) => {
    if (submissionLock.current || redeemResult) return
    setActiveProductId(String(product.id))
    setSubmitError(null)
  }

  const closeResult = () => {
    setRedeemResult(null)
    setActiveProductId(null)
    setSubmitError(null)
  }

  const openCardPack = () => {
    closeResult()
    navigate('/card')
  }

  /** 顶部卡已经位于兑换专区内，「立即兑换」只需把用户带到券列表，不应离开本页。 */
  const onBubbleValueRedeem = () => {
    couponListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const submit = async (projectId: number) => {
    if (!activeProduct || availability !== 'redeemable' || submissionLock.current) return

    submissionLock.current = true
    setSubmitting(true)
    setSubmitError(null)
    try {
      const result = await redeemExchangeProduct(activeProduct.id, projectId)
      setActiveProductId(null)
      setRedeemResult(result)

      // Backend response is authoritative for success. Refresh the two page-level reads
      // that can change after settlement: remaining points and coupon stock/redeemed count.
      reloadPoints()
      reloadCoupons()
    } catch (error) {
      setSubmitError(error instanceof Error && error.message ? error.message : EXCHANGE_REQUEST_ERROR_COPY)
    } finally {
      submissionLock.current = false
      setSubmitting(false)
    }
  }

  return (
    <PageContainer className="flex flex-col pb-8" inset={false}>
      <BubbleValueRedeemCard
        className="mx-4 mt-3 block h-auto w-auto"
        value={balance ?? '--'}
        onRedeem={onBubbleValueRedeem}
      />

      <SegmentedControl
        variant="accent-pill"
        className="mx-4 mt-2.5"
        items={[{ value: 'all', label: '全部' }, ...categoryOptions.map(item => ({ value: item.key, label: item.label }))]}
        value={validCategory ? category : 'all'}
        onChange={changeCategory}
      />
      {categoriesRemote.state === 'loading' && (
        <p role="status" className="mx-4 mt-2 text-xs text-text-tertiary">正在加载体验券分类…</p>
      )}
      {categoriesRemote.state === 'error' && (
        <div role="alert" className="mx-4 mt-2 flex items-center justify-between gap-2 text-xs text-text-secondary">
          <span>分类加载失败：{categoriesRemote.message}</span>
          <Button variant="outline" onClick={reloadCategories}>重试分类</Button>
        </div>
      )}

      <section ref={couponListRef} className="mx-4 mt-3 flex-1" aria-label="洗护体验券列表">
        {categoryPending ? (
          <div role="status" className="py-8 text-center text-sm text-text-secondary">
            {categoriesRemote.state === 'error' ? '请先重试分类加载' : '正在确认所选分类…'}
          </div>
        ) : listRemote.state === 'loading' ? (
          <ul className="grid grid-cols-2 gap-3" aria-busy>
            {Array.from({ length: 4 }).map((_, index) => (
              <li key={index} className="min-w-0">
                <div className="flex h-full w-full flex-col rounded-[12px] border border-border-subtle bg-surface p-2 shadow-sm">
                  <span className="block aspect-[4/3] w-full animate-pulse rounded-[9px] bg-surface-subtle" />
                  <span className="mt-2 block h-4 w-4/5 animate-pulse rounded bg-surface-subtle" />
                  <span className="mt-2 block h-3.5 w-1/2 animate-pulse rounded bg-surface-subtle" />
                  <span className="mt-2 block h-8 w-full animate-pulse rounded-pill bg-surface-subtle" />
                </div>
              </li>
            ))}
          </ul>
        ) : listRemote.state === 'error' ? (
          <div className="rounded-container bg-surface py-2 shadow-sm">
            <EmptyState
              variant="no-results"
              title={EXCHANGE_COPY.errorTitle}
              supportingText={listRemote.message}
              primaryAction={
                <Button variant="outline" onClick={reloadCoupons}>
                  {EXCHANGE_COPY.retryAction}
                </Button>
              }
            />
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            variant="no-results"
            visual={<EmptyStateIllustration size="md" />}
            title={EXCHANGE_COPY.emptyTitle}
            supportingText={EXCHANGE_COPY.emptyDesc}
            primaryAction={
              category === 'all' ? undefined : (
                <Button variant="outline" onClick={() => changeCategory('all')}>
                  {EXCHANGE_COPY.emptyAction}
                </Button>
              )
            }
          />
        ) : (
          <ul className="grid grid-cols-2 gap-3" aria-live="polite">
            {list.map((product) => {
              const productState = resolveAvailability(product, balance)
              const image = product.image || COUPON_COVER_FALLBACK
              return (
                <li key={product.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => openRedeem(product)}
                    aria-label={`${product.name}，${product.cost} ${EXCHANGE_COPY.costUnit}`}
                    className="flex h-full w-full flex-col rounded-[12px] border border-border-subtle bg-surface p-2 text-left shadow-sm transition active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focused"
                  >
                    <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-[9px] bg-surface-subtle">
                      {image ? (
                        <img src={image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-text-tertiary" aria-hidden>
                          <Droplets className="h-8 w-8" />
                        </span>
                      )}
                      {productState === 'sold-out' && (
                        <span className="absolute inset-0 flex items-center justify-center bg-scrim text-sm font-medium text-text-inverse">
                          {EXCHANGE_COPY.soldOut}
                        </span>
                      )}
                    </span>
                    <p className="mt-2 line-clamp-2 min-h-10 text-[13px] font-medium leading-5 text-text-primary">{product.name}</p>
                    <div className="mt-1 flex items-baseline gap-1 whitespace-nowrap">
                      <span className="text-[15px] font-semibold text-exchange-price-text">
                        {product.cost}
                        <span className="ml-0.5 text-[10px] font-normal">泡泡值</span>
                      </span>
                    </div>
                    <span className="mt-0.5 text-[10px] text-text-tertiary">
                      {EXCHANGE_COPY.redeemedPrefix} {product.redeemed.toLocaleString()}
                    </span>
                    <span
                      className={`mt-2 flex min-h-8 w-full items-center justify-center rounded-pill text-xs font-medium text-text-inverse ${productState === 'redeemable' ? 'bg-surface-inverse' : 'bg-surface-inactive-strong'}`}
                    >
                      {availabilityButtonLabel(productState)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <button
        type="button"
        onClick={() => navigate('/points')}
        className="mx-4 mt-3 flex min-h-11 items-center gap-2 rounded-container border border-border-subtle bg-surface px-3 text-left shadow-sm"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-reward-subtle text-exchange-accent">
          <Ticket className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-text-primary">洗护体验券，先兑后体验</span>
          <span className="block truncate text-[10px] text-text-tertiary">泡泡值可兑换洗护关爱机体验券</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" aria-hidden />
      </button>

      {/* Approved 2026-10-14 full-screen in-page step: no URL or nested BottomSheet. */}
      {activeProduct && (
        <ProjectSelectScreen
          key={activeProduct.id}
          coupon={activeProduct}
          fallbackImage={COUPON_COVER_FALLBACK}
          balance={balance}
          submitting={submitting}
          submitError={submitError}
          onClose={closeRedeem}
          onConfirm={(projectId) => { void submit(projectId) }}
        />
      )}

      <PromptOverlay
        open={redeemResult !== null}
        label={runtimePolicy.dataMode === 'mock' ? '模拟兑换结果' : '兑换结果'}
        onDismiss={closeResult}
        className="bg-surface px-6 pb-6 pt-7 text-center"
      >
        <div
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full"
          style={{ background: 'var(--gradient-claim)' }}
          aria-hidden
        >
          <PartyPopper className="h-9 w-9 text-claim-text" />
        </div>
        <h2 className="mt-4 text-lg font-bold leading-6 text-text-primary">
          {runtimePolicy.dataMode === 'mock' ? '兑换成功演示' : '兑换成功'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          {runtimePolicy.dataMode === 'mock'
            ? '当前为 Mock 预览，仅验证正式兑换协议与页面状态，不代表真实扣值或发券。'
            : `兑换完成，剩余泡泡值 ${redeemResult?.points.toLocaleString() ?? '--'}。可前往卡包查看新券。`}
        </p>
        <Button size="large" className="mt-6 h-11 w-full rounded-full" onClick={openCardPack}>
          {EXCHANGE_COPY.successAction}
        </Button>
        <Button variant="ghost" className="mt-2 w-full rounded-full" onClick={closeResult}>
          {EXCHANGE_COPY.successClose}
        </Button>
      </PromptOverlay>

      <DebugPanel route={route} />
    </PageContainer>
  )
}

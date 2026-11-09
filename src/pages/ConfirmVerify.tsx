import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Check, CheckCircle2, Store } from 'lucide-react'
import DebugPanel from '../components/mobile/DebugPanel'
import PageContainer from '../components/mobile/PageContainer'
import { useFixtureState } from '../app/fixtures/useFixture'
import { findRouteByPathname } from '../app/router/routes'
import { VERIFY_FEEDBACK, VERIFY_VOUCHER_FIXTURE } from '../app/fixtures'

/**
 * 确认核销（#67 防误触确认 / 已核销 / 重复核销）
 * -------------------------------------------------------------
 * 门店、明细、核销时间统一读 VERIFY_VOUCHER_FIXTURE，页面不再自持数据。
 * `?state=done` 为已核销结果，`?state=repeat` 为重复核销拦截，均可 URL 直达截图。
 * ⚠️ 重复核销的判定条件未确认（见夹具 VERIFY_FEEDBACK 注释），此处仅呈现拦截态与
 *    「返回卡包」的出口，不实现任何判定逻辑。
 */
export default function ConfirmVerify() {
  const navigate = useNavigate()
  const route = findRouteByPathname('/card/verify/confirm')
  const { state } = useFixtureState(route)
  const voucher = VERIFY_VOUCHER_FIXTURE
  const [toast, setToast] = useState(false)

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => navigate('/card?state=used'), 1600)
    return () => window.clearTimeout(id)
  }, [toast, navigate])

  // URL fixture states are for deterministic visual review only; Native scan callbacks
  // never prove that a card voucher has been redeemed.
  const result = state?.key === 'done' || state?.key === 'repeat' ? state.key : null

  if (result) {
    const copy = result === 'done' ? VERIFY_FEEDBACK.done : VERIFY_FEEDBACK.repeat
    const blocked = result === 'repeat'

    return (
      <PageContainer className="flex min-h-full flex-col pb-6" inset>
        <div className="flex flex-col items-center gap-3 px-5 pb-4 pt-14 text-center">
          <span
            className={`flex h-16 w-16 items-center justify-center rounded-full ${
              blocked ? 'bg-danger-bg text-danger-text' : 'bg-success-bg text-success-text'
            }`}
            aria-hidden
          >
            {blocked ? <AlertCircle className="h-8 w-8" /> : <Check className="h-8 w-8" strokeWidth={3} />}
          </span>
          <h1 className="text-lg font-semibold text-text-primary">{copy.title}</h1>
          <p className="max-w-[260px] text-sm leading-6 text-text-secondary">{copy.desc}</p>
        </div>

        <section className="mx-4 mt-5 rounded-container bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Store className="h-5 w-5 flex-none text-text-tertiary" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-sm text-text-primary">{voucher.store}</p>
              <p className="mt-0.5 text-xs text-text-tertiary">核销时间 {voucher.verifyTime}</p>
            </div>
          </div>
        </section>

        <div className="mt-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-5">
          <button
            type="button"
            onClick={() => navigate('/card?state=used')}
            className="h-12 w-full rounded-full bg-primary text-base font-medium text-text-inverse active:bg-primary-pressed"
          >
            返回卡包
          </button>
        </div>

        <DebugPanel route={route} />
      </PageContainer>
    )
  }

  // 二级页不显示底部导航，底部只需自带安全区，不再按 TabBar 高度预留
  return (
    <PageContainer className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <section
        className="mt-4 flex flex-col items-center text-center"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-bg text-success-text">
          <Check className="h-8 w-8" />
        </span>
        <h2 className="mt-4 text-xl font-semibold text-text-primary">即将核销此券</h2>
        <p className="mt-1 text-sm text-text-tertiary">请与门店店员核对，确认后权益将立即扣减</p>
      </section>

      <section className="mt-6" aria-label="核销设备">
        <h3 className="mb-2 text-sm font-medium text-text-primary">核销设备</h3>
        <div className="rounded-2xl bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <Store className="h-5 w-5 flex-none text-text-tertiary" />
            <div className="min-w-0">
              <p className="text-sm text-text-primary">{voucher.store}</p>
              <p className="mt-0.5 text-xs text-text-tertiary">{voucher.address}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5" aria-label="体验券明细">
        <h3 className="mb-2 text-sm font-medium text-text-primary">体验券明细</h3>
        <div className="rounded-2xl bg-surface p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-primary">{voucher.items}</span>
                <span className="rounded-full bg-reward-subtle px-2 py-0.5 text-[11px] font-semibold text-reward-text">体验</span>
              </div>
              <p className="mt-0.5 text-xs text-text-tertiary">有效期至 {voucher.validUntil}</p>
            </div>
            <span className="text-right text-sm text-text-primary">{voucher.quantity}</span>
          </div>
        </div>
      </section>

      <section className="mt-5" aria-label="核销信息">
        <h3 className="mb-2 text-sm font-medium text-text-primary">核销信息</h3>
        <div className="rounded-2xl bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-tertiary">核销时间</span>
            <span className="text-sm text-text-primary">{voucher.verifyTime}</span>
          </div>
        </div>
      </section>

      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="h-12 flex-1 rounded-full border border-border bg-surface text-sm font-medium text-text-primary"
        >
          取消
        </button>
        <button
          type="button"
          onClick={() => setToast(true)}
          className="h-12 flex-[2] rounded-full bg-primary text-sm font-medium text-text-inverse active:bg-primary-pressed"
        >
          确认核销
        </button>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-1/2 z-50 flex w-fit -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-control bg-success px-5 py-3 text-sm text-text-inverse shadow-floating"
        >
          <CheckCircle2 className="h-[18px] w-[18px]" />
          {VERIFY_FEEDBACK.done.title}
        </div>
      )}

      <DebugPanel route={route} />
    </PageContainer>
  )
}

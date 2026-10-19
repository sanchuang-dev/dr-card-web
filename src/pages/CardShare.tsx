import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, CheckCircle2, RefreshCw, Ticket, UserRound } from 'lucide-react'
import PageContainer from '../components/mobile/PageContainer'
import DebugPanel from '../components/mobile/DebugPanel'
import { Button, SearchField } from '../components/ui'
import { findRouteByPathname } from '../app/router/routes'
import { runtimePolicy } from '../app/config/runtime'
import { SHARE_TARGET_FIXTURES } from '../app/fixtures'
import { isAppError } from '../lib/appError'
import { loadBuddyRelations, type BuddyMember } from '../services/buddyRelations'
import { giveCoupon } from '../services/couponGift'

type BuddyRemote =
  | { state: 'loading' }
  | { state: 'ready'; items: BuddyMember[] }
  | { state: 'error'; message: string }

interface CouponPreview {
  name: string
  amountLabel?: string
  validityLabel?: string
}

type GiftState =
  | { state: 'idle' }
  | { state: 'submitting' }
  | { state: 'success'; nickname: string }
  | { state: 'error'; message: string }

function readCouponPreview(state: unknown): CouponPreview | null {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null
  const candidate = (state as { couponPreview?: unknown }).couponPreview
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null

  const { name, amountLabel, validityLabel } = candidate as Record<string, unknown>
  if (typeof name !== 'string' || !name.trim()) return null

  return {
    name: name.trim(),
    amountLabel:
      typeof amountLabel === 'string' && amountLabel.trim() ? amountLabel.trim() : undefined,
    validityLabel:
      typeof validityLabel === 'string' && validityLabel.trim() ? validityLabel.trim() : undefined,
  }
}

function giftErrorMessage(error: unknown): string {
  if (isAppError(error)) {
    if (error.status === 401) return '登录已失效，请重新进入 App 后再试'
    if (error.kind === 'timeout') return '转赠请求超时，请稍后重试'
    if (error.kind === 'network') return '网络异常，请检查网络后重试'
    if (error.kind === 'contract') return '转赠服务返回异常，请稍后重试'
    return error.message
  }
  return error instanceof Error && error.message ? error.message : '转赠失败，请稍后重试'
}

/**
 * Coupon transfer: pick a real buddy, submit the confirmed `POST /api/coupons/give`
 * contract, and only show success after the backend confirms it. A historical
 * `?state=success` URL must never imply a transfer on its own.
 */
export default function CardShare() {
  const route = findRouteByPathname('/card/share')
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const couponId = searchParams.get('coupon')?.trim() || null
  const couponPreview = useMemo(() => readCouponPreview(location.state), [location.state])
  const mockMode = runtimePolicy.dataMode === 'mock'
  const [keyword, setKeyword] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [remote, setRemote] = useState<BuddyRemote>({ state: 'loading' })
  const [gift, setGift] = useState<GiftState>({ state: 'idle' })
  const submitting = gift.state === 'submitting'

  useEffect(() => {
    if (!couponId) return
    let active = true
    setRemote({ state: 'loading' })
    setSelectedId(null)
    setGift({ state: 'idle' })
    if (mockMode) {
      setRemote({
        state: 'ready',
        items: SHARE_TARGET_FIXTURES.map(item => ({
          id: item.id, nickname: item.name, avatarUrl: null,
        })),
      })
    } else {
      // Reuse the exact backend list service as /buddy; it pages through the
      // authenticated GET /api/friends/index records and never takes a user_id.
      void loadBuddyRelations().then(items => {
        if (active) setRemote({ state: 'ready', items })
      }).catch(error => {
        if (active) setRemote({
          state: 'error',
          message: error instanceof Error ? error.message : '搭子列表加载失败，请重试',
        })
      })
    }
    return () => { active = false }
  }, [couponId, mockMode, retry])

  const items = remote.state === 'ready' ? remote.items : []
  const selected = items.find(item => item.id === selectedId) ?? null
  const filtered = useMemo(() => {
    const term = keyword.trim()
    return items.filter(item => item.id !== selectedId && item.nickname.includes(term))
  }, [items, keyword, selectedId])

  const choose = (id: string) => {
    if (submitting) return
    setSelectedId(id)
    setGift({ state: 'idle' })
  }

  const submitGift = async () => {
    if (!couponId || !selected || submitting) return
    setGift({ state: 'submitting' })
    try {
      await giveCoupon({ logId: couponId, friendId: selected.id })
      setGift({ state: 'success', nickname: selected.nickname })
    } catch (error) {
      setGift({ state: 'error', message: giftErrorMessage(error) })
    }
  }

  const renderBuddy = (buddy: BuddyMember, checked: boolean, disabled = false) => (
    <button
      key={buddy.id}
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => choose(buddy.id)}
      className={`flex min-h-[68px] w-full min-w-0 items-center gap-3 rounded-xl border px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? 'border-primary bg-surface-selected' : 'border-border-subtle bg-surface'
      }`}
    >
      {buddy.avatarUrl ? (
        <img src={buddy.avatarUrl} alt="" className="h-11 w-11 flex-none rounded-full object-cover" />
      ) : (
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-reward-subtle text-reward-strong" aria-hidden>
          <UserRound className="h-5 w-5" />
        </span>
      )}
      <span className="min-w-0 flex-1 break-words text-[15px] font-medium text-text-primary">{buddy.nickname}</span>
      <span aria-hidden className={`flex h-5 w-5 flex-none items-center justify-center rounded-full border ${
        checked ? 'border-primary bg-primary text-text-inverse' : 'border-border bg-surface'
      }`}>
        {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
    </button>
  )

  if (gift.state === 'success') {
    const { nickname } = gift
    return (
      <PageContainer className="flex min-h-full flex-col pb-6" inset>
        <header className="px-1 pt-3">
          <h1 className="text-[16px] font-semibold text-text-primary">转赠成功</h1>
        </header>

        <section className="flex flex-col items-center px-2 pt-10 text-center" aria-live="polite">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-bg text-success" aria-hidden>
            <CheckCircle2 className="h-8 w-8" strokeWidth={2.4} />
          </span>
          <h2 className="mt-5 text-xl font-semibold text-text-primary">转赠成功</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            已成功转赠给「{nickname}」
          </p>
          <p className="mt-1 text-xs leading-5 text-text-tertiary">
            优惠卡已从你的卡包转出，接收方可在自己的卡包查看
          </p>
        </section>

        {couponPreview && (
          <section
            className="mt-6 flex items-center gap-3 rounded-xl bg-surface p-4 shadow-sm"
            aria-label="已转赠的优惠卡"
          >
            <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-reward-subtle text-reward-strong" aria-hidden>
              <Ticket className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block break-words text-sm font-medium text-text-primary">
                {couponPreview.name}
              </span>
              {(couponPreview.amountLabel || couponPreview.validityLabel) && (
                <span className="mt-1 block break-words text-xs text-text-tertiary">
                  {[couponPreview.amountLabel, couponPreview.validityLabel]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              )}
            </span>
          </section>
        )}

        {mockMode && (
          <p role="status" className="mt-4 rounded-lg bg-warning-bg px-3 py-2 text-[12px] text-warning-text">
            演示环境：本次转赠仅模拟接口成功，未真实转出卡券
          </p>
        )}

        <div className="mt-auto space-y-2 pt-8 pb-[env(safe-area-inset-bottom)]">
          <Button
            size="large"
            className="h-12 w-full rounded-pill"
            onClick={() => navigate('/card?state=available', { replace: true })}
          >
            查看我的卡包
          </Button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="min-h-10 w-full rounded-pill text-sm font-medium text-text-secondary active:bg-surface-pressed"
          >
            返回
          </button>
        </div>

        <DebugPanel route={route} />
      </PageContainer>
    )
  }

  return (
    <PageContainer className="flex min-h-full flex-col pb-6" inset>
      <header className="px-1 pt-3">
        <h1 className="text-[16px] font-semibold text-text-primary">选择转赠搭子</h1>
        <p className="mt-1 text-[12px] text-text-tertiary">
          转赠成功后，这张优惠卡将从你的卡包转出，请确认接收人
        </p>
      </header>

      {!couponId ? (
        <section role="alert" className="mt-5 rounded-xl bg-surface p-5 text-center text-sm text-text-secondary">
          未选择待转赠卡券，请从卡包点击「转赠」进入
        </section>
      ) : (
        <>
          {mockMode && (
            <p role="status" className="mt-3 rounded-lg bg-reward-subtle px-3 py-2 text-[12px] text-reward-text">
              演示搭子，仅用于 UI 预览；非真实账号
            </p>
          )}
          <div className="pt-4">
            <SearchField
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onClear={() => setKeyword('')}
              placeholder="搜索我的搭子"
              inputClassName="placeholder:text-text-tertiary"
              disabled={submitting}
            />
          </div>

          <section className="mt-5 min-w-0" aria-label="搭子列表">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-text-primary">我的搭子</h2>
              {remote.state === 'ready' && (
                <span className="text-[12px] text-text-tertiary">{items.length} 位</span>
              )}
            </div>
            <div className="mt-3" role="radiogroup" aria-label="选择接收搭子">
              {remote.state === 'loading' ? (
                <p role="status" className="rounded-xl bg-surface px-4 py-8 text-center text-sm text-text-secondary">
                  正在加载我的搭子…
                </p>
              ) : remote.state === 'error' ? (
                <div role="alert" className="rounded-xl bg-surface px-4 py-7 text-center">
                  <p className="text-sm text-text-secondary">{remote.message}</p>
                  <Button variant="outline" className="mt-3" leadingIcon={RefreshCw}
                    onClick={() => setRetry(x => x + 1)}>重新加载</Button>
                </div>
              ) : items.length === 0 ? (
                <p role="status" className="rounded-xl bg-surface px-4 py-8 text-center text-sm text-text-secondary">
                  暂无搭子，可先去「洗头搭子」添加好友
                </p>
              ) : (
                <div className="space-y-2.5">
                  {selected && (
                    <div className="space-y-2" aria-label="已选搭子">
                      <p className="text-[12px] font-medium text-reward-text">已选搭子</p>
                      {renderBuddy(selected, true, submitting)}
                    </div>
                  )}
                  <p className="pt-1 text-[12px] text-text-tertiary">搜索结果</p>
                  {filtered.map(item => renderBuddy(item, false, submitting))}
                  {filtered.length === 0 && (
                    <p className="rounded-xl bg-surface px-4 py-5 text-center text-[13px] text-text-tertiary">
                      没有匹配的搭子{selected ? '，已选搭子仍保留' : ''}
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>

          <div className="mt-auto pt-6 pb-[env(safe-area-inset-bottom)]">
            {gift.state === 'error' && (
              <p role="alert" className="mb-3 rounded-xl bg-danger-bg px-3 py-3 text-center text-[12px] leading-5 text-danger-text">
                {gift.message}
              </p>
            )}
            <Button
              size="large"
              className="h-12 w-full rounded-pill"
              loading={submitting}
              disabled={!selected}
              onClick={() => void submitGift()}
            >
              {submitting ? '正在转赠…' : '确认转赠'}
            </Button>
          </div>
        </>
      )}

      <DebugPanel route={route} />
    </PageContainer>
  )
}

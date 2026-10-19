import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, RefreshCw, UserRound } from 'lucide-react'
import PageContainer from '../components/mobile/PageContainer'
import DebugPanel from '../components/mobile/DebugPanel'
import { Button, SearchField } from '../components/ui'
import { findRouteByPathname } from '../app/router/routes'
import { runtimePolicy } from '../app/config/runtime'
import { SHARE_TARGET_FIXTURES } from '../app/fixtures'
import { loadBuddyRelations, type BuddyMember } from '../services/buddyRelations'

type BuddyRemote =
  | { state: 'loading' }
  | { state: 'ready'; items: BuddyMember[] }
  | { state: 'error'; message: string }

/**
 * Transfer preparation only: pick an actual buddy from the authenticated account.
 * No transfer API has been signed, so this screen MUST NOT mutate a coupon, navigate
 * to the legacy fixture success page, or claim that anything was gifted.
 */
export default function CardShare() {
  const route = findRouteByPathname('/card/share')
  const [searchParams] = useSearchParams()
  const couponId = searchParams.get('coupon')?.trim() || null
  const mockMode = runtimePolicy.dataMode === 'mock'
  const [keyword, setKeyword] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmedId, setConfirmedId] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [remote, setRemote] = useState<BuddyRemote>({ state: 'loading' })

  useEffect(() => {
    if (!couponId) return
    let active = true
    setRemote({ state: 'loading' })
    setSelectedId(null)
    setConfirmedId(null)
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
    setSelectedId(id)
    setConfirmedId(null)
  }

  const renderBuddy = (buddy: BuddyMember, checked: boolean) => (
    <button
      key={buddy.id}
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={() => choose(buddy.id)}
      className={`flex min-h-[68px] w-full min-w-0 items-center gap-3 rounded-xl border px-3 py-3 text-left ${
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

  return (
    <PageContainer className="flex min-h-full flex-col pb-6" inset>
      <header className="px-1 pt-3">
        <h1 className="text-[16px] font-semibold text-text-primary">选择转赠搭子</h1>
        <p className="mt-1 text-[12px] text-text-tertiary">
          转赠接口暂未接入，当前仅支持选择接收人，不会实际转出卡券
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
                      {renderBuddy(selected, true)}
                    </div>
                  )}
                  <p className="pt-1 text-[12px] text-text-tertiary">搜索结果</p>
                  {filtered.map(item => renderBuddy(item, false))}
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
            {confirmedId && selected?.id === confirmedId && (
              <p role="status" className="mb-3 rounded-xl bg-reward-subtle px-3 py-3 text-center text-[12px] leading-5 text-text-secondary">
                已选择「{selected.nickname}」。转赠接口尚未接入，卡券没有转出。
              </p>
            )}
            <Button
              size="large"
              className="h-12 w-full rounded-pill"
              disabled={!selected}
              onClick={() => { if (selected) setConfirmedId(selected.id) }}
            >
              确认选择
            </Button>
          </div>
        </>
      )}

      <DebugPanel route={route} />
    </PageContainer>
  )
}

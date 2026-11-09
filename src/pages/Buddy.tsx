import { useEffect, useState } from 'react'
import { runtimePolicy } from '../app/config/runtime'
import { useNavigate } from 'react-router-dom'
import { CalendarCheck, Gift, Loader2, QrCode, RefreshCw, Smartphone, Sparkles, UserRoundPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import PageContainer from '../components/mobile/PageContainer'
import DebugPanel from '../components/mobile/DebugPanel'
import { Button, EmptyState } from '../components/ui'
import { findRouteByPathname } from '../app/router/routes'
import { useFixtureDebug, useFixtureState, withFixtureQuery } from '../app/fixtures/useFixture'
import { BUDDY_EMPTY_COPY, BUDDY_FEATURE_INTRO, BUDDY_INVITE_ENTRIES } from '../app/fixtures'
import { applyBuddyPreset, ensureBuddyDefaultPreset, useBuddies, type BuddyListPreset } from '../app/state/buddies'
import { loadBuddyRelations, type BuddyMember } from '../services/buddyRelations'
import buddyEmptyHero from '../assets/brand/buddy/buddy-empty-hero-v2.webp'
import buddyAvatarXiaomei from '../assets/brand/buddy/buddy-avatar-xiaomei.webp'

/**
 * 洗头搭子（摹客 #27 空态 / #28 有态）
 * -------------------------------------------------------------
 * - 空态与有态共用同一业务模型（搭子集合 + 说明卡 + 两个邀请入口），只在列表区切换视觉；
 * - 2026-08-28 用户确认：无 fixture state 的默认访问约 50% 空态 / 50% 单搭子态；
 *   明确 empty/list/multi 仍是确定性验收入口，不受随机默认态影响；
 * - ⚠️ 说明卡第三行「默契升级」是 #27/#28 的原型文案，此处只渲染文字，
 *   不提供任何默契值入口、数值或进度视觉（#31 先不做，B-006 / T014）；
 * - ⚠️ 不引入历史 T07 稿的 4 人 mock 与 98/86/72/55 默契值。
 */

const STATE_PRESETS: Record<string, BuddyListPreset> = {
  empty: 'empty',
  list: 'single',
  multi: 'multi',
}

const FEATURE_ICONS: Record<string, LucideIcon> = {
  checkin: CalendarCheck,
  welfare: Gift,
  mutual: Sparkles,
}

type RemoteState =
  | { status: 'loading' }
  | { status: 'ready'; items: BuddyMember[] }
  | { status: 'failed'; message: string }

const ENTRY_ICONS: Record<string, LucideIcon> = {
  qrcode: QrCode,
  phone: Smartphone,
}

export default function Buddy() {
  const route = findRouteByPathname('/buddy')
  const { raw } = useFixtureState(route)
  const debug = useFixtureDebug()
  const navigate = useNavigate()
  const { items } = useBuddies()
  const fixtureMode = runtimePolicy.dataMode === 'mock'
  const [remote, setRemote] = useState<RemoteState>({ status: 'loading' })
  const [retry, setRetry] = useState(0)

  /** 显式 fixture 优先；无 fixture 时仅在本次会话第一次进入时抽一次 50/50 默认态。 */
  useEffect(() => {
    // API/test/prod 未接后台关系列表，绝不能显示随机“小美”当真实搭子。
    if (!fixtureMode) return
    const preset = raw == null ? undefined : STATE_PRESETS[raw]
    if (preset) {
      applyBuddyPreset(preset)
      return
    }
    ensureBuddyDefaultPreset()
  }, [raw, fixtureMode])

  useEffect(() => {
    if (fixtureMode) return
    let active = true
    setRemote({ status: 'loading' })
    void loadBuddyRelations().then(data => {
      if (active) setRemote({ status: 'ready', items: data })
    }).catch(error => {
      if (active) setRemote({ status: 'failed', message: error instanceof Error ? error.message : '搭子列表加载失败' })
    })
    return () => { active = false }
  }, [fixtureMode, retry])

  const displayed = fixtureMode
    ? items.map(item => ({ id: item.id, nickname: item.name, avatarUrl: buddyAvatarXiaomei }))
    : remote.status === 'ready' ? remote.items : []

  return (
    <PageContainer inset={false} className="flex min-h-full flex-col pb-6">
      {fixtureMode && (
        <p className="mx-4 mt-3 text-center text-xs text-buddy-muted" role="status">
          演示搭子资料，非真实账号关系
        </p>
      )}
      {!fixtureMode && remote.status === 'ready' && (
        <div className="flex min-h-10 items-center justify-between px-5 pt-2" aria-label="搭子列表操作">
          <h2 className="text-sm font-medium text-buddy-text">我的搭子</h2>
          <Button
            variant="ghost"
            size="regular"
            leadingIcon={RefreshCw}
            aria-label="刷新搭子列表"
            className="gap-1.5 px-2 text-[13px]"
            onClick={() => setRetry(value => value + 1)}
          >
            刷新
          </Button>
        </div>
      )}

      {!fixtureMode && remote.status !== 'ready' ? (
        <section role="status" className="mx-4 mt-4 rounded-container bg-surface px-4 py-10 text-center shadow-card">
          {remote.status === 'loading' ? (
            <p className="flex items-center justify-center gap-2 text-sm text-buddy-text">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />正在加载搭子…
            </p>
          ) : (
            <>
              <p className="text-sm leading-6 text-buddy-text">{remote.message}</p>
              <Button variant="outline" leadingIcon={RefreshCw} className="mt-4" onClick={() => setRetry(v => v + 1)}>
                重试加载
              </Button>
            </>
          )}
        </section>
      ) : displayed.length === 0 ? (
        <EmptyState
          className="flex-1 pt-10"
          visual={
            <div
              className="relative flex h-[196px] w-[244px] items-center justify-center"
              data-buddy-illustration="empty-hero"
            >
              <span
                className="absolute inset-x-5 bottom-3 h-24 rounded-[50%] bg-buddy-surface opacity-70 blur-2xl"
                aria-hidden
              />
              <img
                src={buddyEmptyHero}
                alt="两位卡博士白熊搭子一起洗护头发"
                className="relative h-[196px] w-[220px] object-contain"
              />
            </div>
          }
          title={<span className="text-base font-medium text-buddy-text">{BUDDY_EMPTY_COPY.title}</span>}
          supportingText={
            <span className="text-[13px] leading-5 text-buddy-muted">{BUDDY_EMPTY_COPY.desc}</span>
          }
        />
      ) : (
        <section className={`px-4 ${fixtureMode ? 'pt-3' : 'pt-1'}`} aria-label="我的洗头搭子">
          <ul className="space-y-2.5">
            {displayed.map((buddy) => (
              <li key={buddy.id}>
                <article className="flex items-center gap-3 rounded-container bg-surface px-3.5 py-3 shadow-card">
                  {buddy.avatarUrl ? (
                    <img src={buddy.avatarUrl} alt="" aria-hidden
                      className="h-12 w-12 flex-none rounded-full object-cover" />
                  ) : (
                    <span aria-hidden className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-buddy-surface text-buddy-accent">
                      <UserRoundPlus className="h-6 w-6" />
                    </span>
                  )}
                  <p className="min-w-0 flex-1 truncate text-[15px] font-medium text-buddy-text">
                    {buddy.nickname}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4 px-4" aria-label={BUDDY_FEATURE_INTRO.title}>
        <p className="px-1 text-sm font-medium text-buddy-text">{BUDDY_FEATURE_INTRO.title}</p>
        <ul className="mt-2 overflow-hidden rounded-container bg-surface shadow-card">
          {BUDDY_FEATURE_INTRO.items.map((item, index) => {
            const Icon = FEATURE_ICONS[item.key] ?? Sparkles
            return (
              <li
                key={item.key}
                className={`flex items-center gap-3 px-4 py-3.5 ${index > 0 ? 'border-t border-border-subtle' : ''}`}
              >
                <span
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-buddy-surface text-buddy-accent"
                  aria-hidden
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-buddy-text">{item.title}</span>
                  <span className="mt-0.5 block text-xs leading-[18px] text-buddy-muted">{item.desc}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="sticky bottom-0 mt-auto flex gap-3 bg-background px-4 pb-[env(safe-area-inset-bottom)] pt-4">
        {BUDDY_INVITE_ENTRIES.map((entry, index) => (
          <Button
            key={entry.key}
            size="large"
            variant={index === 0 ? 'primary' : 'outline'}
            leadingIcon={ENTRY_ICONS[entry.key]}
            className="flex-1 rounded-pill"
            onClick={() => navigate(withFixtureQuery(entry.to, { debug: debug ? '1' : null }))}
          >
            {entry.label}
          </Button>
        ))}
      </div>

      <DebugPanel route={route} />
    </PageContainer>
  )
}

import { Fragment, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  ClipboardList,
  Crown,
  Gift,
  Headphones,
  MapPin,
  Pencil,
  Ticket,
  UserRoundPlus,
} from 'lucide-react'
import UserAvatar from '../components/mobile/UserAvatar'
import { useUserIdentity } from './profile/useUserIdentity'
import hotBerry from '../assets/brand/exchange/profile-hot-berry.webp'
import PageContainer from '../components/mobile/PageContainer'
import AppPromptDialog from '../components/mobile/AppPromptDialog'
import { useOverlay } from '../app/fixtures/useFixture'
import { openNativeAppStore } from '../app/adapters/appOpen'
import { APP_FORCE_FIXTURE } from '../app/fixtures'
import { useProfileCoupons, useProfileFeed } from './profile/useProfileFeed'

type Tile = {
  icon: typeof Ticket
  name: string
  from: string
  deep: string
  color: string
  to?: string
  appOnly?: boolean
}

const tiles: Tile[] = [
  { icon: Ticket, name: '卡券兑换', from: '#FFF8E6', deep: '#F4DFA9', color: '#B5793B', to: '/redeem' },
  { icon: Crown, name: '会员权益', from: '#FFF4CF', deep: '#E8C361', color: '#8A5A10', to: '/membership' },
  { icon: ClipboardList, name: '订单管理', from: '#FFF3EB', deep: '#FFD3C0', color: '#D63D10', to: '/mall?path=%2Fpages%2Fgoods%2Forder_list%2Findex' },
  { icon: MapPin, name: '地址管理', from: '#FFF8E6', deep: '#F3DFA9', color: '#9A6110', to: '/mall?path=%2Fpages%2Fusers%2Fuser_address_list%2Findex' },
  { icon: UserRoundPlus, name: '绑定搭子', from: '#EFFCFE', deep: '#CDEFF5', color: '#0E9FB3', to: '/buddy' },
  { icon: Gift, name: '品牌福利官', from: '#EEFAF3', deep: '#CDEAD9', color: '#147A4C', to: '/service/welfare-officer' },
  { icon: Headphones, name: '客服中心', from: '#F6F8FB', deep: '#E1E6ED', color: '#535D72', to: '/service/chat' },
]

/** 资料 / 泡泡值在加载或失败时的占位，不回退旧夹具值，避免把假值冒充成真实资料。 */
const PROFILE_VALUE_PLACEHOLDER = '--'

/** 体验券封面缺失时（`image` 为 null / 空串）的本地兜底图。 */
const COUPON_COVER_FALLBACK = hotBerry

export default function Profile() {
  const navigate = useNavigate()
  const { remote: identity } = useUserIdentity()
  const { overlay, open, close } = useOverlay()
  const [downloadHint, setDownloadHint] = useState<string | undefined>(undefined)
  const [downloadPending, setDownloadPending] = useState(false)

  // GET /api/user/profile：昵称 / 头像 / 等级 / 券数量 / 泡泡值快照。
  // 加载与失败显示占位，不回退旧夹具值；页面不做 mock/api 分支。
  const { remote: profileRemote } = useProfileFeed()
  const profile = profileRemote.state === 'success' ? profileRemote.data : null

  // GET /api/coupons/index：热门体验券横滑区（券模板，可兑换的券）。
  // 首屏只取第 1 页，「查看更多」跳券页承接完整分页。
  const { remote: couponsRemote } = useProfileCoupons()
  const hotGoods = useMemo(
    () =>
      couponsRemote.state === 'success'
        ? couponsRemote.data.map((coupon) => ({
            id: coupon.id,
            image: coupon.image?.trim() || COUPON_COVER_FALLBACK,
            name: coupon.name,
            meta: coupon.short_desc?.trim() || '单次体验 · 到店核销',
          }))
        : [],
    [couponsRemote],
  )

  const avatarSrc = identity.state === 'success' ? identity.data.avatar : profile?.avatar
  const nickname = (identity.state === 'success' ? identity.data.nickname : profile?.nickname) || PROFILE_VALUE_PLACEHOLDER
  const gradeName = profile?.grade || PROFILE_VALUE_PLACEHOLDER
  const kbsId = profile?.kbsId
  const nextGrade = profile?.nextGrade
  const pointsText = profile ? profile.points.toLocaleString() : PROFILE_VALUE_PLACEHOLDER

  // 资产区：券数量取 couponsCount（恒为数字，0 是合法值，不用 || 折叠）；泡泡值取资料快照。
  const stats = [
    { name: '优惠券', value: profile ? String(profile.couponsCount) : PROFILE_VALUE_PLACEHOLDER, to: '/card', hint: '查看优惠券' },
    { name: '泡泡值', value: pointsText, to: '/points', hint: '查看泡泡值明细' },
  ]

  const openAppPrompt = () => {
    setDownloadHint(undefined)
    open('app-prompt')
  }

  const closeAppPrompt = () => {
    setDownloadHint(undefined)
    close()
  }

  const handleAppStoreDownload = async () => {
    if (downloadPending) return

    setDownloadPending(true)
    setDownloadHint(undefined)
    try {
      const result = await openNativeAppStore()
      setDownloadHint(
        result.success
          ? '已交由系统打开应用商店'
          : '应用商店打开失败，请稍后重试',
      )
    } catch {
      setDownloadHint('当前 App 版本暂不支持应用商店跳转')
    } finally {
      setDownloadPending(false)
    }
  }

  return (
    <PageContainer inset={false} className="relative pb-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <span className="absolute left-[-60px] top-[520px] h-[280px] w-[280px] rounded-full bg-[#F8D992] opacity-30 blur-[28px]" />
        <span className="absolute bottom-[200px] right-[-40px] h-[200px] w-[200px] rounded-full bg-[#ED4D1B] opacity-5 blur-[28px]" />
        <span className="absolute right-[-60px] top-20 h-[240px] w-[240px] rounded-full bg-[#EDBC6C] opacity-10 blur-[28px]" />
      </div>

      <section className="relative z-10 mx-4 mt-2 overflow-hidden rounded-[20px] bg-[linear-gradient(140deg,#FAE9A8_0%,#F3D472_32%,#E4BA48_66%,#CDA135_100%)] p-[18px] pb-0 text-[#4A3206] shadow-[0_4px_10px_-4px_rgba(153,112,26,0.25)]">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0)_32%,rgba(255,255,255,0.18)_52%,rgba(255,255,255,0)_72%)]" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-white/70" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-[#A57A1D]/50" />

        <div className="relative flex items-center gap-3.5">
          <button
            type="button"
            aria-label="用户头像"
            onClick={() => navigate('/settings')}
            className="h-16 w-16 flex-none overflow-hidden rounded-full border-2 border-white/90 shadow-[0_0_0_4px_rgba(165,122,29,0.25)]"
          >
            <UserAvatar src={avatarSrc} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-[#4A3206]">{nickname}</h2>
              <span className="inline-flex h-[22px] flex-none items-center gap-1 rounded-full bg-[#4A3206] px-2 text-[11px] font-semibold text-[#F7E2A1]">
                <Crown className="h-3 w-3 text-[#F7E2A1]" />
                VIP {gradeName}
              </span>
            </div>
            {kbsId ? <p className="mt-1 text-xs tracking-wide text-[#6B4A12]/85">ID {kbsId}</p> : null}
          </div>
          <button
            type="button"
            aria-label="编辑资料"
            onClick={() => navigate('/settings')}
            className="flex h-7 w-7 flex-none items-center justify-center rounded-md text-[#6B4A12]/80"
          >
            <Pencil className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div className="relative mt-4">
          <div className="mb-2 flex items-baseline justify-between text-xs text-[#4A3206]/85">
            <span>当前等级 {gradeName}</span>
            {/* nextGrade 为空字符串时后端表示「已是最高等级」，此时不展示升级文案。 */}
            {!profile ? (
              <span className="font-semibold text-[#4A3206]">--</span>
            ) : profile.gradeId === undefined ? (
              <span className="font-semibold text-[#4A3206]">会员等级尚未配置</span>
            ) : nextGrade ? (
              <span className="font-semibold text-[#4A3206]">
                距 {nextGrade.name} 还差 {nextGrade.min_exp_number} 经验值
              </span>
            ) : (
              <span className="font-semibold text-[#4A3206]">已是最高等级</span>
            )}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#4A3206]/20">
            {/* 文档未提供当前经验值，无法计算真实完成度，此处保持既有视觉条，不做进度反推。 */}
            <span className="block h-full rounded-full bg-[linear-gradient(90deg,#E4BA48,#A57A1D)]" style={{ width: '30%' }} />
          </div>
        </div>

        <div className="relative mx-[-18px] mt-4 flex items-center border-t border-[#4A3206]/20 py-3.5">
          {stats.map((stat, index) => (
            <Fragment key={stat.name}>
              {index > 0 ? <span className="h-6 w-px flex-none bg-[#4A3206]/20" aria-hidden /> : null}
              <button
                type="button"
                onClick={() => navigate(stat.to)}
                aria-label={`${stat.name} ${stat.value}，${stat.hint}`}
                className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1 transition-transform duration-150 active:scale-[0.97]"
              >
                <span className="text-xl font-bold leading-none tracking-tight text-[#4A3206]">{stat.value}</span>
                <span className="relative whitespace-nowrap text-xs text-[#6B4A12]/75">
                  {stat.name}
                  <ChevronRight className="absolute left-full top-1/2 ml-0.5 h-3 w-3 -translate-y-1/2" aria-hidden />
                </span>
              </button>
            </Fragment>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-4 mt-3" aria-labelledby="profile-services-title">
        <header className="mb-2 flex items-center justify-between px-1">
          <h3 id="profile-services-title" className="flex items-center gap-2 text-[13px] font-semibold text-text-primary">
            <span className="h-3.5 w-1 rounded-full bg-[#D6A43A]" aria-hidden />
            快捷服务
          </h3>
          <span className="text-[10px] tracking-[0.12em] text-[#9A8060]">常用功能</span>
        </header>
        <div className="grid grid-cols-6 grid-rows-[60px_60px_66px] gap-2.5">
          {tiles.map((tile, index) => {
            const isPrimaryRow = index < 4
            const placement =
              index === 0
                ? 'col-span-3 col-start-1 row-start-1'
                : index === 1
                  ? 'col-span-3 col-start-1 row-start-2'
                  : index === 2
                    ? 'col-span-3 col-start-4 row-start-1'
                    : index === 3
                      ? 'col-span-3 col-start-4 row-start-2'
                      : 'col-span-2 row-start-3'

            return (
              <button
                key={tile.name}
                type="button"
                onClick={() => (tile.appOnly ? openAppPrompt() : navigate(tile.to as string))}
                aria-haspopup={tile.appOnly ? 'dialog' : undefined}
                className={`group relative overflow-hidden border border-white/75 text-left shadow-[0_3px_10px_rgba(130,86,28,0.07)] transition active:scale-[0.98] ${placement} ${
                  isPrimaryRow
                    ? 'flex items-center gap-3 rounded-[16px] px-3.5'
                    : 'flex flex-col items-center justify-center gap-1.5 rounded-[16px] px-1'
                }`}
                style={{
                  background: `linear-gradient(145deg, ${tile.from} 0%, ${tile.deep} 100%)`,
                  color: tile.color,
                }}
              >
                {isPrimaryRow ? (
                  <>
                    <tile.icon className="h-[22px] w-[22px] flex-none" strokeWidth={1.95} />
                    <span className="min-w-0 flex-1 whitespace-nowrap text-[13px] font-medium text-text-primary">{tile.name}</span>
                    <ChevronRight className="h-4 w-4 flex-none opacity-55 transition-transform group-active:translate-x-0.5" aria-hidden />
                  </>
                ) : (
                  <>
                    <tile.icon className="h-5 w-5" strokeWidth={1.95} />
                    <span className="whitespace-nowrap text-[11px] font-medium text-text-primary">{tile.name}</span>
                  </>
                )}
              </button>
            )
          })}
        </div>
      </section>

      <section className="relative z-10 mx-4 mt-4">
        <header className="flex items-center justify-between px-1 pb-2.5">
          <h3 className="text-base font-semibold text-text-primary">热门体验券</h3>
          <button type="button" className="inline-flex items-center gap-0.5 text-xs text-text-tertiary" onClick={() => navigate('/exchange')}>
            查看更多
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </header>
        <div className="flex gap-3 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: 'none' }}>
          {hotGoods.length > 0 ? (
            hotGoods.map((goods) => (
              <article key={goods.id} className="w-[120px] min-w-[120px] flex-none rounded-xl bg-surface p-2 pb-3 text-left shadow-[0_1px_2px_rgba(23,27,42,0.04)]">
                <div className="aspect-square overflow-hidden rounded-lg bg-surface-subtle">
                  <img src={goods.image} alt="" aria-hidden className="h-full w-full object-cover" />
                </div>
                <h4 className="mt-2 truncate text-[13px] font-medium text-text-primary">{goods.name}</h4>
                <p className="mt-0.5 text-[11px] text-text-tertiary">{goods.meta}</p>
              </article>
            ))
          ) : (
            <p className="px-1 py-6 text-[11px] text-text-tertiary">
              {couponsRemote.state === 'loading' ? '加载中…' : '暂时没有可兑换的体验券'}
            </p>
          )}
        </div>
      </section>

      <AppPromptDialog
        open={overlay === 'app-prompt'}
        variant="force"
        message={APP_FORCE_FIXTURE.message}
        onAcknowledge={closeAppPrompt}
        onDownload={() => void handleAppStoreDownload()}
        downloadHint={downloadHint}
        downloadPending={downloadPending}
      />
    </PageContainer>
  )
}

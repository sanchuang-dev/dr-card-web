import { useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BookOpen, ChevronLeft, ChevronRight, Gift, Heart, Search } from 'lucide-react'
import BannerCarousel from '../components/mobile/BannerCarousel'
import CheckinBoard from './checkin/components/CheckinBoard'
import CheckinMakeupSuccessOverlay from '../components/mobile/CheckinMakeupSuccessOverlay'
import DebugPanel from '../components/mobile/DebugPanel'
import PageContainer from '../components/mobile/PageContainer'
import { useFixtureState, useOverlay } from '../app/fixtures/useFixture'
import { findRouteByPathname } from '../app/router/routes'
import { COLUMN_HOME_SECTIONS, NEWCOMER_COUPON_RULE_STATUS } from '../app/fixtures'
import { resolveBannerLink, type BannerItem } from '../services/banners'
import { useHomeBanners, useSignStatus } from './home/useHomeFeed'
import { useSignRecords } from './checkin/useCheckinFeed'
import { SIGN_RECORDS_RANGE_WEEK } from '../services/signrecords'
import UserAvatar from '../components/mobile/UserAvatar'
import { useUserIdentity } from './profile/useUserIdentity'

const sectionIcons = {
  cause: Heart,
  'brand-story': BookOpen,
} as const

/**
 * 诗得丽品牌专栏首页（原 APP 首页，T021 改造）
 * -------------------------------------------------------------
 * 2026-08-28 追加确认：签到业务在首页仅保留紧凑 7 日入口，不再展示金色签到 Hero；
 * 完整金色签到卡、30 天日历与补签入口统一收回 `/checkin` 内页。
 *
 * 首页新人体验券弹窗暂时关闭：身份选择弹窗只是演示用，正式券数需等待 APP 用户信息
 * 和跨后台用户识别接口完成后，由统一业务服务决定，不能在页面初始化时自行猜测。
 */
export default function Home() {
  const navigate = useNavigate()
  const { remote: identity } = useUserIdentity()
  const [searchParams] = useSearchParams()
  const route = findRouteByPathname('/')
  /* 保持夹具注册与 DebugPanel 工作；首页正式状态暂不直接驱动新人券弹窗。 */
  useFixtureState(route)
  const { overlay, close } = useOverlay()

  const debug = searchParams.get('debug') === '1'

  /* 首页接口数据：轮播 / 今日签到状态。详情页各自请求对应的富文本配置。 */
  const banners = useHomeBanners()
  const signStatus = useSignStatus()
  // 首页只需要本周七日记录，不读取完整月份。
  const signRecords = useSignRecords(SIGN_RECORDS_RANGE_WEEK)
  const lastSeenDay = useRef(new Date().toDateString())

  // App 跨日恢复时同步刷新本周记录与今日签到状态，避免两者显示不同日期。
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const todayKey = new Date().toDateString()
      if (todayKey === lastSeenDay.current) return
      lastSeenDay.current = todayKey
      signRecords.reload()
      signStatus.reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [signRecords.reload, signStatus.reload])

  const bannerSlides = useMemo(
    () =>
      banners.state === 'success'
        ? banners.data.map((item) => ({
            key: String(item.id),
            image: item.image ?? undefined,
            alt: item.title?.trim() || `首页轮播图 ${item.id}`,
          }))
        : [],
    [banners],
  )

  const bannerItems = useMemo(() => {
    const map = new Map<string, BannerItem>()
    if (banners.state === 'success') {
      for (const item of banners.data) map.set(String(item.id), item)
    }
    return map
  }, [banners])

  return (
    <PageContainer className="pb-24 pt-4" inset={false}>
      <section className="mx-4 flex items-center gap-2" aria-label="搜索与用户入口">
        {/* 临时调试入口（需移除）：原「返回卡博士首页」按钮临时改跳 Bridge Lab，
         * 便于在 App WebView 内直接进入 /__debug/bridge-lab?osType=Android。
         * 调试结束后恢复 onClick={() => navigate('/legacy-home')} 与原 aria-label。 */}
        <button
          type="button"
          aria-label="打开 Bridge Lab（临时调试入口）"
          onClick={() => navigate('/__debug/bridge-lab?osType=Android')}
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-border-subtle bg-surface text-text-primary active:bg-surface-secondary"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <label className="flex h-10 flex-1 items-center gap-2 rounded-full border border-border-subtle bg-surface px-3 text-text-tertiary">
          <Search className="h-4 w-4" />
          <input
            type="search"
            placeholder="搜索你想要的商品"
            aria-label="搜索商品"
            className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </label>
        {/* T046｜右上角头像由「跳商城」改为「跳专栏内会员中心」（B-048 路由 slug：/dearseed/membership） */}
        <button
          type="button"
          data-dearseed-avatar
          aria-label="进入会员中心"
          onClick={() => navigate('/dearseed/membership')}
          className="h-10 w-10 flex-none overflow-hidden rounded-full border border-border-subtle bg-surface shadow-sm"
        >
          <UserAvatar src={identity.state === 'success' ? identity.data.avatar : undefined} />
        </button>
      </section>

      {/* 请求期间保留同尺寸占位，避免 banner 出现/消失造成尺寸抖动；
          接口返回空列表时隐藏轮播区域，不渲染空容器（2026-09-28 首页联调文档）。 */}
      {(banners.state === 'loading' || bannerSlides.length > 0) && (
        <div className="mx-4 mt-4">
          <BannerCarousel
            label="首页活动轮播"
            loading={banners.state === 'loading'}
            slides={bannerSlides}
            onSelect={(slide) => {
              const item = bannerItems.get(slide.key)
              if (!item) return
              const target = resolveBannerLink(item)
              if (!target) return
              if (target.kind === 'internal') navigate(target.to)
              // 外链按联调文档走 WebView / 系统浏览器打开；宿主拦截行为需在 App 内验证。
              else window.location.assign(target.href)
            }}
          />
        </div>
      )}

      <div className="mt-4">
        <CheckinBoard
          mode="home"
          debug={debug}
          loading={signStatus.state === 'loading' || signRecords.remote.state === 'loading'}
          records={signRecords.remote.state === 'success' ? signRecords.remote.data : null}
          weekRecordsState={signRecords.remote.state}
          signStatus={
            signStatus.state === 'success'
              ? {
                  signed: signStatus.data.signed,
                  consecutiveDays: signStatus.data.consecutive_days,
                  points: signStatus.data.points,
                  rewardDesc: signStatus.data.reward_desc ?? '',
                }
              : null
          }
        />
      </div>

      <section className="mx-4 mt-7 space-y-3" aria-label="公益板块与品牌故事">
        {COLUMN_HOME_SECTIONS.map((item) => {
          const Icon = sectionIcons[item.key]
          const body = (
            <>
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-app-icon bg-reward-subtle text-reward-strong">
                <Icon className="h-[22px] w-[22px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold leading-5 text-text-primary">{item.title}</span>
                <span className="mt-1 block text-xs leading-5 text-text-tertiary">{item.desc}</span>
              </span>
              {item.action && (
                <span className="flex flex-none items-center gap-0.5 text-xs text-reward-text">
                  {item.action}
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </span>
              )}
            </>
          )
          const shell = 'flex w-full items-center gap-3 rounded-feature bg-surface p-4 text-left shadow-bubble'

          return (
            <button key={item.key} type="button" onClick={() => navigate(item.to)} className={shell}>
              {body}
            </button>
          )
        })}
      </section>

      {debug && (
        <p className="mx-4 mt-4 text-xs leading-5 text-text-tertiary">
          夹具态：{NEWCOMER_COUPON_RULE_STATUS.newUserDetection.note}
          {NEWCOMER_COUPON_RULE_STATUS.causeSection.note}
        </p>
      )}

      <button
        type="button"
        aria-label="福袋"
        onClick={() => navigate('/redeem')}
        className="fixed bottom-[calc(59px+env(safe-area-inset-bottom)+1rem)] left-4 z-30 flex h-14 w-14 flex-col items-center justify-center rounded-full border border-border-subtle bg-reward-subtle text-reward-text shadow-sm"
      >
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-surface bg-danger" aria-hidden />
        <Gift className="h-[22px] w-[22px]" />
        <span className="mt-0.5 text-[10px] leading-none">福袋</span>
      </button>

      <CheckinMakeupSuccessOverlay open={overlay === 'make-up-success'} onDismiss={close} debug={debug} />

      <DebugPanel route={route} />
    </PageContainer>
  )
}

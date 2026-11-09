import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BottomNavigation, Toast } from '../ui'
import { LEGACY_TAB_ITEMS } from '../../app/router/routes'
import { FORMAL_H5_TAB_ROUTES } from '../../app/router/routeScope'
import {
  getNativeBridgeDiagnostics,
  getNativeHost,
  NativeBridgeError,
  scanCode,
} from '../../services/nativeBridge'
import { parseBuddyInviteCode } from '../../services/buddyRelations'

// 主入口只消费 formal-H5 Tab 路由；Native reference 使用独立 legacy 导航。
const mainItems = FORMAL_H5_TAB_ROUTES.flatMap((route) =>
  route.tab && route.label && route.icon
    ? [{ value: route.path, label: route.label, icon: route.icon, fab: route.tabFab }]
    : [],
)

// 历史首页入口的三项导航继续作为 Native reference 独立存在。
const legacyItems = LEGACY_TAB_ITEMS.map((item) => ({
  value: item.key,
  label: item.label,
  icon: item.icon,
}))

// 只有配置了 to 的项可跳转，其余为纯视觉展示。
const legacyTargets = new Map(
  LEGACY_TAB_ITEMS.flatMap((item) => (item.to ? [[item.key, item.to] as const] : [])),
)

// 反向映射：路径 → Tab key
const pathToLegacyKey = new Map(
  LEGACY_TAB_ITEMS.flatMap((item) => (item.to ? [[item.to, item.key] as const] : [])),
)

// 中间凸起的扫码项不再走 H5 路由，而是直接调用已确认的原生 scanCode 能力。
const SCAN_TAB_PATH = mainItems.find((item) => item.fab)?.value

// App WebView 可能晚于 React 首屏注入 Bridge；首屏做有限探测，避免浏览器预览永久轮询。
const BRIDGE_DISCOVERY_INTERVAL_MS = 500
const BRIDGE_DISCOVERY_MAX_ATTEMPTS = 20

type ScanFeedback = {
  message: string
  status: 'warning' | 'danger'
}

export default function BottomNav({ variant = 'main' }: { variant?: 'main' | 'legacy' }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isLegacy = variant === 'legacy'
  const items = isLegacy ? legacyItems : mainItems

  // 中间扫码项的可调用性只由 Bridge 诊断决定：浏览器 / 未注入宿主下必须不可用。
  const [scanSupported, setScanSupported] = useState(
    () => getNativeBridgeDiagnostics().capabilities.scanCode,
  )
  const [scanPending, setScanPending] = useState(false)
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback | null>(null)
  const scanInFlight = useRef(false)

  useEffect(() => {
    if (isLegacy || scanSupported) return

    let attempts = 0
    let intervalId: number | undefined

    const refreshSupport = () => {
      const supported = getNativeBridgeDiagnostics().capabilities.scanCode
      if (supported) setScanSupported(true)
      return supported
    }

    const pollSupport = () => {
      attempts += 1
      if (refreshSupport() || attempts >= BRIDGE_DISCOVERY_MAX_ATTEMPTS) {
        if (intervalId !== undefined) {
          window.clearInterval(intervalId)
          intervalId = undefined
        }
      }
    }

    intervalId = window.setInterval(pollSupport, BRIDGE_DISCOVERY_INTERVAL_MS)
    window.addEventListener('focus', refreshSupport)
    window.addEventListener('pageshow', refreshSupport)

    return () => {
      if (intervalId !== undefined) window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshSupport)
      window.removeEventListener('pageshow', refreshSupport)
    }
  }, [isLegacy, scanSupported])

  useEffect(() => {
    if (!scanFeedback) return
    const timer = window.setTimeout(() => setScanFeedback(null), 2200)
    return () => window.clearTimeout(timer)
  }, [scanFeedback])

  // 主入口：子路径仍高亮所属一级 Tab
  // 历史入口：根据当前路径匹配对应 Tab key
  const active = isLegacy
    ? pathToLegacyKey.get(location.pathname) ?? 'home'
    : (items.find((item) =>
        item.value === '/' ? location.pathname === '/' : location.pathname.startsWith(item.value),
      )?.value ?? '/')

  const handleScan = useCallback(async () => {
    // 浏览器 / 当前 App 版本未注入 scanCode 时保持不可用，不臆造 Web camera fallback。
    if (!getNativeBridgeDiagnostics().capabilities.scanCode || scanInFlight.current) return

    scanInFlight.current = true
    setScanPending(true)
    setScanFeedback(null)

    try {
      const host = getNativeHost()
      const result = await scanCode({ scanType: 'qr' })

      // 当前 feat/1109 的扫码分流合同已由 Android 明确提供。iOS 当前分支没有
      // scanCode Native 实现证据，不根据旧 H5 adapter 的存在推断其支持该能力。
      if (host !== 'android') {
        setScanFeedback({
          message: '当前 App 尚未提供可验证的扫码分流能力',
          status: 'warning',
        })
        return
      }

      // 设备页与设备启动/取货事务始终由 Native 管理。部分设备（如 use=17）
      // 回调不带 consumeUse；缺少 isDevice=false 时绝不能当作 H5 邀请二维码。
      if (
        result.isDevice === true ||
        (typeof result.consumeUse === 'string' && result.consumeUse.length > 0)
      ) {
        return
      }
      if (result.isDevice !== false) return

      // 只有官方域名下的固定 UUID 邀请 URL 才进入现有搭子预览；其余未知码拒绝执行。
      try {
        parseBuddyInviteCode(
          result.code,
          import.meta.env.VITE_BUDDY_PUBLIC_ORIGIN ?? '',
        )
      } catch {
        setScanFeedback({ message: '暂不支持此二维码', status: 'warning' })
        return
      }

      navigate('/buddy/accept', {
        state: {
          buddyScan: {
            source: 'native-buddy-recognition',
            raw: result.code,
          },
        },
      })
    } catch (error) {
      if (error instanceof NativeBridgeError) {
        if (error.code === 'native-cancelled') return
        if (error.code === 'native-permission-denied') {
          setScanFeedback({ message: '请允许相机权限后重试', status: 'danger' })
          return
        }
        if (
          error.code === 'bridge-disabled' ||
          error.code === 'bridge-unsupported' ||
          error.code === 'capability-unsupported'
        ) {
          setScanFeedback({ message: '当前 App 版本暂不支持扫码', status: 'warning' })
          return
        }
      }
      setScanFeedback({ message: '扫码失败，请重试', status: 'danger' })
    } finally {
      scanInFlight.current = false
      setScanPending(false)
    }
  }, [navigate])

  const handleChange = (value: string) => {
    if (isLegacy) {
      const target = legacyTargets.get(value)
      if (target && target !== location.pathname) navigate(target)
      return
    }

    if (value === SCAN_TAB_PATH) {
      void handleScan()
      return
    }

    if (value === location.pathname) return

    // 一级 Tab 是频道切换，只使用 H016 的 130ms CSS fade。
    // 不进入 native View Transition，避免 old/new snapshot 叠加造成残影；
    // deferred formal-H5（当前 mall）也继续保持普通 Router 导航。
    navigate(value)
  }

  const renderedItems = isLegacy
    ? items
    : items.map((item) =>
        item.value === SCAN_TAB_PATH
          ? { ...item, disabled: !scanSupported || scanPending }
          : item,
      )

  return (
    <>
      <BottomNavigation
        items={renderedItems}
        value={active}
        onChange={handleChange}
        className={`relative z-40 w-full shrink-0 ${isLegacy ? 'mx-auto max-w-legacy-shell' : ''}`}
      />
      {scanFeedback && (
        <div className="fixed bottom-[calc(64px+env(safe-area-inset-bottom)+12px)] left-1/2 z-[60] -translate-x-1/2">
          <Toast message={scanFeedback.message} status={scanFeedback.status} />
        </div>
      )}
    </>
  )
}

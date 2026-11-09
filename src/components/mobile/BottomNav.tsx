import { useCallback, useEffect, useState } from 'react'
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
import {
  getNativeScanUnsupportedMessage,
  resolveNativeScanDestination,
} from '../../services/nativeScanRouting'

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
const SCAN_FEEDBACK_DURATION_MS = 2_600

type ScanFeedback = {
  message: string
  status: 'info' | 'warning' | 'danger'
}

export default function BottomNav({ variant = 'main' }: { variant?: 'main' | 'legacy' }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isLegacy = variant === 'legacy'
  const items = isLegacy ? legacyItems : mainItems

  const [scanSupported, setScanSupported] = useState(
    () => getNativeBridgeDiagnostics().capabilities.scanCode,
  )
  const [scanInProgress, setScanInProgress] = useState(false)
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback | null>(null)

  useEffect(() => {
    if (!scanFeedback) return
    const timer = window.setTimeout(() => setScanFeedback(null), SCAN_FEEDBACK_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [scanFeedback])

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

  // 主入口：子路径仍高亮所属一级 Tab
  // 历史入口：根据当前路径匹配对应 Tab key
  const active = isLegacy
    ? pathToLegacyKey.get(location.pathname) ?? 'home'
    : (items.find((item) =>
        item.value === '/' ? location.pathname === '/' : location.pathname.startsWith(item.value),
      )?.value ?? '/')

  const handleScan = useCallback(async () => {
    if (!getNativeBridgeDiagnostics().capabilities.scanCode || scanInProgress) return

    setScanInProgress(true)
    setScanFeedback(null)
    try {
      const result = await scanCode({ scanType: 'qr' })
      const destination = resolveNativeScanDestination(
        result,
        getNativeHost(),
        import.meta.env.VITE_BUDDY_PUBLIC_ORIGIN,
      )

      if (destination.kind === 'buddy') {
        navigate('/buddy/accept', {
          state: {
            buddyScan: {
              source: 'native-buddy-recognition',
              raw: destination.raw,
            },
          },
        })
        return
      }

      if (destination.kind === 'unsupported') {
        setScanFeedback({
          message: getNativeScanUnsupportedMessage(destination.reason),
          status: 'warning',
        })
        return
      }

      const state = {
        nativeScanCode: destination.code,
        ...(destination.nativeTransactionComplete ? { nativeVerifyResult: 'done' as const } : {}),
      }
      navigate('/card/verify/confirm', {
        replace: destination.nativeTransactionComplete,
        state,
      })
    } catch (error) {
      if (error instanceof NativeBridgeError && error.code === 'native-cancelled') {
        setScanFeedback({ message: '已取消扫码', status: 'info' })
      } else if (error instanceof NativeBridgeError && error.code === 'native-permission-denied') {
        setScanFeedback({ message: '请允许相机权限后重试', status: 'warning' })
      } else if (error instanceof NativeBridgeError &&
        (error.code === 'bridge-unsupported' || error.code === 'capability-unsupported')) {
        setScanFeedback({ message: '当前 App 版本暂不支持扫码', status: 'warning' })
      } else {
        setScanFeedback({ message: '扫码失败，请重试', status: 'danger' })
      }
    } finally {
      setScanInProgress(false)
    }
  }, [navigate, scanInProgress])

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
        item.value === SCAN_TAB_PATH ? { ...item, disabled: !scanSupported || scanInProgress } : item,
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
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4">
          <Toast message={scanFeedback.message} status={scanFeedback.status} />
        </div>
      )}
    </>
  )
}

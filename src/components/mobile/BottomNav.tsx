import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BottomNavigation } from '../ui'
import { LEGACY_TAB_ITEMS } from '../../app/router/routes'
import { FORMAL_H5_TAB_ROUTES } from '../../app/router/routeScope'
import { getNativeBridgeDiagnostics, scanCode } from '../../services/nativeBridge'

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

export default function BottomNav({ variant = 'main' }: { variant?: 'main' | 'legacy' }) {
  const location = useLocation()
  const navigate = useNavigate()
  const isLegacy = variant === 'legacy'
  const items = isLegacy ? legacyItems : mainItems

  // 中间扫码项的可调用性只由 Bridge 诊断决定：浏览器 / 未注入宿主下必须不可用。
  const [scanSupported, setScanSupported] = useState(
    () => getNativeBridgeDiagnostics().capabilities.scanCode,
  )

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
    // 浏览器 / 当前 App 版本未注入 scanCode 时保持不可用，不臆造 Web camera fallback。
    if (!getNativeBridgeDiagnostics().capabilities.scanCode) return

    try {
      await scanCode({ scanType: 'qr' })
    } catch {
      // 扫码取消 / 失败 / 超时均静默回落到当前页，不新增反馈链路。
    }
  }, [])

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
        item.value === SCAN_TAB_PATH ? { ...item, disabled: !scanSupported } : item,
      )

  return (
    <BottomNavigation
      items={renderedItems}
      value={active}
      onChange={handleChange}
      className={`relative z-40 w-full shrink-0 ${isLegacy ? 'mx-auto max-w-legacy-shell' : ''}`}
    />
  )
}

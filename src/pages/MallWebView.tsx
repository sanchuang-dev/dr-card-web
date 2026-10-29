import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { runtimePolicy } from '../app/config/runtime'
import { Button, LoadingIndicator } from '../components/ui'
import {
  MALL_SHOPS,
  createMallSsoBridge,
  resolveMallTarget,
  type MallSsoError,
  type MallTarget,
} from '../services/sso/mallSso'

export interface MallWebViewProps {
  /** 仅用于测试或明确的业务分支；默认由 VITE_MALL_TARGET 决定。 */
  target?: MallTarget
}

const PROFILE_MALL_PATHS = new Set([
  '/pages/goods/order_list/index',
  '/pages/users/user_address_list/index',
])

/**
 * 商城 H5 承载页
 * -------------------------------------------------------------
 * 底部 Tab「商城」(/mall) 以 iframe 加载商城 B，保留外层 H5 壳层与底部导航。
 *
 * 单点登录协议见 `src/services/sso/mallSso.ts`：
 * - iframe 不带 src 先挂载，effect 中先建 SSO 监听、再设置 src，避免漏掉 B 的早期
 *   `SSO.REQUEST`；
 * - A 只把一次性 Ticket 交给 B，不向 iframe 传 A 的 JWT；
 * - 商城换域名/路径时只改 `MALL_SHOPS`，本页不写死地址。
 */
export default function MallWebView({ target }: MallWebViewProps) {
  const location = useLocation()
  const mallTarget = target ?? resolveMallTarget()
  const shop = MALL_SHOPS[mallTarget]
  // Only allow the two profile destinations requested by product. Preserve the configured
  // shop base path (e.g. /h5) and never accept arbitrary URLs from the query string.
  const requestedPath = new URLSearchParams(location.search).get('path')
  const mallPath = requestedPath && PROFILE_MALL_PATHS.has(requestedPath)
    ? requestedPath
    : null
  const targetUrl = new URL(shop.url)
  if (mallPath) {
    const basePath = targetUrl.pathname.replace(/\/$/, '')
    targetUrl.pathname = `${basePath}${mallPath}`
  }
  targetUrl.search = ''
  targetUrl.hash = ''
  const mallUrl = targetUrl.toString()

  const [iframe, setIframe] = useState<HTMLIFrameElement | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!iframe) return

    setLoaded(false)
    setProblem(null)

    const bridge = createMallSsoBridge(iframe, mallTarget, {
      onSsoError: (error: MallSsoError) => {
        console.warn('[mall-sso] mall reported failure', {
          target: mallTarget,
          code: error.code,
        })
        setProblem(
          runtimePolicy.dataMode === 'mock'
            ? '预览模式不执行商城单点登录'
            : '商城登录未完成，请重试',
        )
      },
      onSsoResult: (result) => {
        if (result.success) setProblem(null)
      },
    })

    // 监听器就绪后再开始导航，避免 B 的首个 SSO.REQUEST 早于监听器。
    // StrictMode 下 effect 会执行两次，已导航到目标地址时不要重复加载商城。
    if (iframe.src !== mallUrl) iframe.src = mallUrl

    return () => bridge.dispose()
  }, [iframe, mallTarget, mallUrl])

  useEffect(() => {
    if (!iframe || loaded || problem) return
    const timer = window.setTimeout(() => {
      setProblem('商城加载超时，请重试')
    }, 20_000)
    return () => window.clearTimeout(timer)
  }, [iframe, loaded, problem])

  const retry = useCallback(() => {
    setProblem(null)
    setLoaded(false)
    setAttempt((value) => value + 1)
  }, [])

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col" data-mall-target={mallTarget}>
      {problem && (
        <div
          role="status"
          className="absolute inset-x-3 top-3 z-20 flex items-center justify-between gap-3 rounded-container border border-border-subtle bg-surface px-3 py-2 shadow-card"
        >
          <span className="min-w-0 text-sm text-text-secondary">{problem}</span>
          <Button
            type="button"
            variant="outline"
            onClick={retry}
            className="shrink-0 px-3 text-sm"
          >
            重试
          </Button>
        </div>
      )}

      {!loaded && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-background/80">
          <LoadingIndicator label="商城加载中…" />
        </div>
      )}

      <iframe
        key={`${mallTarget}-${attempt}`}
        ref={setIframe}
        title="卡博士商城"
        className="h-full w-full flex-1 border-0"
        onLoad={(event) => {
          // 初始 about:blank 也会触发 load，只认商城自己的地址。
          if (event.currentTarget.src === mallUrl) setLoaded(true)
        }}
      />
    </div>
  )
}

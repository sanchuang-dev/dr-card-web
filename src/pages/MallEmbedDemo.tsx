import { useState } from 'react'

const MALL_DEMO_URL = 'http://scmzhds07.m.demo.webportal.top/?_sc=1'

/**
 * 商城效果预览。
 *
 * 仅用于 preview 视觉演示：把外部商城 Demo 直接嵌入现有 App 壳。
 * 不代表正式商城接入方案，不承载鉴权、JSBridge、支付或生产 WebView 契约。
 */
export default function MallEmbedDemo() {
  const [loaded, setLoaded] = useState(false)

  return (
    <div className="relative h-full min-h-[560px] w-full bg-white">
      {!loaded && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-white text-sm text-text-secondary"
          role="status"
        >
          商城效果加载中…
        </div>
      )}

      <iframe
        title="商城效果预览"
        src={MALL_DEMO_URL}
        className="block h-full min-h-[calc(100dvh-156px)] w-full border-0 bg-white"
        onLoad={() => setLoaded(true)}
        allow="clipboard-read; clipboard-write"
      />
    </div>
  )
}

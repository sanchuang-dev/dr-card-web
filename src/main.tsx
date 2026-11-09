import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { runtimePolicy } from './app/config/runtime'
import UnsupportedHostNotice, { isUnsupportedHost } from './pages/UnsupportedHostNotice'
import BuddyScanLanding from './pages/BuddyScanLanding'
import './styles/globals.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root was not found')
}

const appRootElement = rootElement

async function prepareRuntime() {
  if (runtimePolicy.dataMode !== 'mock') return

  const { startApiMocking } = await import('./mocks/browser')
  await startApiMocking()
}

async function prepareMobileDebugPanel() {
  // Maintainer 2026-09-29: Eruda is required in dev/preview/test for WebView diagnostics.
  if (runtimePolicy.appEnvironment === 'prod') return

  try {
    const { default: eruda } = await import('eruda')
    eruda.init()
  } catch (error) {
    console.warn('[debug] Eruda initialization failed; continuing without the mobile console.', error)
  }
}

async function bootstrap() {
  await prepareRuntime()
  await prepareMobileDebugPanel()

  /* H036：test/prod 只承载真实 API + Native Bridge，非原生宿主不进入应用。
   * 拦截发生在 React 挂载前，路由不会启动，因此不会发出任何业务请求。 */
  if (isUnsupportedHost()) {
    const basename = import.meta.env.VITE_ROUTER_BASENAME?.replace(/\/$/, '') || ''
    const relativePath = basename && window.location.pathname.startsWith(`${basename}/`)
      ? window.location.pathname.slice(basename.length)
      : window.location.pathname
    // 只有这一个纯静态公开落地页允许在微信/系统浏览器显示。
    // 其它正式 H5 路由继续严格要求 Native WebView，不启动应用 Router/业务请求。
    ReactDOM.createRoot(appRootElement).render(
      relativePath === '/buddy/invite/scan'
        ? <BuddyScanLanding />
        : <UnsupportedHostNotice />,
    )
    return
  }

  ReactDOM.createRoot(appRootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

void bootstrap()

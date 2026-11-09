import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Vite config is evaluated before .env files are exposed as import.meta.env.
// Load the same mode-specific variables used by the app so the dev proxy cannot silently
// keep targeting the old LAN backend while runtime API calls use VITE_API_BASE_URL.
const DEFAULT_DEV_API_TARGET = 'http://192.168.1.81:7002'

function getApiProxyTarget(raw: string | undefined): string {
  const value = raw?.trim()
  if (!value) return DEFAULT_DEV_API_TARGET
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('invalid protocol')
    // API clients append /api/... themselves; the proxy target must be the origin only.
    return url.origin
  } catch {
    throw new Error('VITE_API_BASE_URL must be an absolute http(s) URL for the dev proxy')
  }
}

// Legacy immutable OSS releases need a relative base. Stable kbs-web roots
// instead require an absolute prefix, so deep-link refreshes load JS/CSS from
// the same environment (not from a nested route's /assets directory).
// Cloudflare and local dev keep '/'.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devApiTarget = getApiProxyTarget(process.env.VITE_API_BASE_URL?.trim() || env.VITE_API_BASE_URL)
  const ossArtifact = (process.env.H5_OSS_ARTIFACT || env.H5_OSS_ARTIFACT) === '1'
  const fixedWebBases: Record<string, string> = {
    ui: '/kbs-web/ui/',
    dev: '/kbs-web/dev/',
    test: '/kbs-web/test/',
    prod: '/kbs-web/prod/last/',
  }
  const webTarget = process.env.OSS_WEB_TARGET || env.OSS_WEB_TARGET
  const fixedBase = fixedWebBases[webTarget?.trim() || '']

  return {
    base: ossArtifact && fixedBase ? fixedBase : ossArtifact ? './' : '/',
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: devApiTarget,
          changeOrigin: true,
        },
      },
    },
  }
})

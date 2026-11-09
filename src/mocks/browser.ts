import { setupWorker } from 'msw/browser'

import { handlers } from './handlers'

const worker = setupWorker(...handlers)

export async function startApiMocking() {
  await worker.start({
    serviceWorker: {
      // Prefix-scoped OSS UI/dev previews need a worker inside their own path.
      // Root deployments (Cloudflare and local dev) keep the original URL.
      url: `${import.meta.env.VITE_ROUTER_BASENAME?.replace(/\/$/, '') || ''}/mockServiceWorker.js`,
    },
    onUnhandledRequest: 'bypass',
  })
}

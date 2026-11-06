import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createServer as createViteServer } from 'vite'

process.env.VITE_APP_ENV = 'dev'
process.env.VITE_DATA_MODE = 'mock'
process.env.VITE_BRIDGE_MODE = 'native'

const vite = await createViteServer({
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
})

const originalWindow = globalThis.window

// H002/AGENTS §3.4: these top-level page modules belong exclusively to Native-reference routes.
// src/pages/legacy/** is excluded separately below. H015 must not make Native reference code an
// H5 acceptance gate, even though those pages may intentionally demonstrate direct host calls.
const NATIVE_REFERENCE_TOP_LEVEL_PAGES = new Set([
  'LegacyHome.tsx',
  'LegacyScan.tsx',
  'DeviceListPage.tsx',
  'DeviceDetailPage.tsx',
  'VendingBuyPage.tsx',
  'VendingOrderPage.tsx',
  'LegacyService.tsx',
  'RepairProjects.tsx',
  'RepairForm.tsx',
  'FeedbackPage.tsx',
])

function collectFormalH5PageFiles(directory, pageRoot = path.normalize('src/pages')) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    const normalizedEntryPath = path.normalize(entryPath)

    if (entry.isDirectory()) {
      if (normalizedEntryPath === path.join(pageRoot, 'legacy')) return []
      return collectFormalH5PageFiles(entryPath, pageRoot)
    }

    if (!/\.[jt]sx?$/.test(entry.name)) return []
    // Test fixtures exercise fake Native globals; only shipped page modules are subject to H015.
    if (/\.test\.[jt]sx?$/.test(entry.name)) return []
    if (path.normalize(directory) === pageRoot && NATIVE_REFERENCE_TOP_LEVEL_PAGES.has(entry.name)) {
      return []
    }

    return [entryPath]
  })
}

try {
  const {
    NativeBridgeError,
    closeWebView,
    getLoginToken,
    getNativeBridgeDiagnostics,
  } = await vite.ssrLoadModule('/src/services/nativeBridge.ts')

  const firstBridge = {
    marker: 'first',
    getLoginToken() {
      assert.equal(this, firstBridge, 'Android injected method must keep its receiver binding')
      return '{"token":"token-first"}'
    },
  }
  globalThis.window = { androidBridge: firstBridge }

  assert.deepEqual(getNativeBridgeDiagnostics(), {
    mode: 'native',
    host: 'android',
    hostVersion: null,
    capabilities: {
      getLoginToken: true,
      closeWebView: false,
      scanCode: false,
      takePhoto: false,
      chooseImage: false,
      saveImageToAlbum: false,
      copyText: false,
      showRewardAd: false,
      openApp: false,
    },
  })
  assert.deepEqual(await getLoginToken(), { token: 'token-first' })
  await assert.rejects(
    closeWebView(),
    (error) =>
      error instanceof NativeBridgeError &&
      error.code === 'capability-unsupported' &&
      error.capability === 'closeWebView',
    'closeWebView must remain explicitly unsupported until Native confirms the protocol',
  )

  const secondBridge = {
    marker: 'second',
    getLoginToken() {
      assert.equal(this, secondBridge, 'late-injected Android bridge must keep its receiver binding')
      return '{"token":"token-second"}'
    },
  }
  globalThis.window.androidBridge = secondBridge
  assert.deepEqual(
    await getLoginToken(),
    { token: 'token-second' },
    'adapter must resolve window.androidBridge on every invocation instead of caching it',
  )

  globalThis.window = {}
  await assert.rejects(
    getLoginToken(),
    (error) => error instanceof NativeBridgeError && error.code === 'bridge-unsupported',
  )

  globalThis.window = { androidBridge: {} }
  await assert.rejects(
    getLoginToken(),
    (error) => error instanceof NativeBridgeError && error.code === 'capability-unsupported',
  )

  globalThis.window = {
    androidBridge: {
      getLoginToken() {
        throw new Error('native exploded')
      },
    },
  }
  await assert.rejects(
    getLoginToken(),
    (error) => error instanceof NativeBridgeError && error.code === 'invocation-failed',
  )

  globalThis.window = {
    androidBridge: {
      getLoginToken() {
        return new Promise(() => {})
      },
    },
  }
  await assert.rejects(
    getLoginToken({ timeoutMs: 20 }),
    (error) => error instanceof NativeBridgeError && error.code === 'invocation-timeout',
  )

  globalThis.window = {
    webkit: {
      messageHandlers: {
        getAuthorizationInfo: { postMessage() {} },
      },
    },
  }
  assert.deepEqual(getNativeBridgeDiagnostics(), {
    mode: 'native',
    host: 'ios',
    hostVersion: null,
    capabilities: {
      getLoginToken: false,
      closeWebView: false,
      scanCode: false,
      takePhoto: false,
      chooseImage: false,
      saveImageToAlbum: false,
      copyText: false,
      showRewardAd: false,
      openApp: false,
    },
  })

  for (const file of collectFormalH5PageFiles('src/pages')) {
    const source = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(
      source,
      /\b(?:window\s*\.\s*androidBridge|androidBridge\s*\.|webkit\s*\??\.\s*messageHandlers)\b/,
      file + ' is a formal H5 page and must not access Native host globals directly',
    )
  }

  const facadeSource = fs.readFileSync('src/services/nativeBridge.ts', 'utf8')
  const authSource = fs.readFileSync('src/services/nativeBridge/capabilities/auth.ts', 'utf8')
  const runtimeSource = fs.readFileSync('src/services/nativeBridge/runtime.ts', 'utf8')
  const transportSource = fs.readFileSync('src/services/nativeBridgeTransport.ts', 'utf8')
  assert.match(authSource, /createInjectedObjectTransport/)
  assert.match(transportSource, /method\.call\(bridge,\s*\.\.\.args\)/)
  assert.match(runtimeSource, /runtimePolicy\.bridgeMode === 'native'/)
  assert.doesNotMatch(
    facadeSource + authSource + runtimeSource + transportSource,
    /mockToken|fakeToken|fallbackToken/,
  )

  console.log(
    'H015 PASS: getLoginToken remains centralized through the capability runtime and injected-object transport, the registry-backed diagnostics match the current capability surface, late injection and receiver binding are preserved, Promise/timeout/error semantics are deterministic, and formal H5 pages do not access host globals directly.',
  )
} finally {
  if (originalWindow === undefined) delete globalThis.window
  else globalThis.window = originalWindow
  await vite.close()
}

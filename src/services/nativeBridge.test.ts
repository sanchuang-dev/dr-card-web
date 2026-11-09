import { afterEach, describe, expect, it, vi } from 'vitest'

type InjectedBridgeProbe = {
  marker?: string
  getLoginToken?: () => unknown
  closeWebView?: () => unknown
  scanCode?: (payload: unknown) => unknown
  takePhoto?: (payload: unknown) => unknown
  chooseImage?: (payload: unknown) => unknown
  saveImageToAlbum?: (payload: unknown) => unknown
  copyText?: (payload: unknown) => unknown
  showRewardAd?: (payload: unknown) => unknown
  openApp?: (payload: unknown) => unknown
}

type BridgeProbeWindow = Window & {
  androidBridge?: InjectedBridgeProbe
  nativeBridgeCallback?: (callbackId: string, payload: unknown) => void
  androidBridgeCallback?: (callbackId: string, payload: unknown) => void
  iosBridge?: InjectedBridgeProbe
  webkit?: {
    messageHandlers?: Record<string, { postMessage(payload: unknown): void } | undefined>
  }
}

const bridgeWindow = window as BridgeProbeWindow

async function loadBridge(mode: 'disabled' | 'native' = 'native') {
  vi.stubEnv('VITE_BRIDGE_MODE', mode)
  if (mode === 'disabled') {
    // Vitest itself runs with Vite mode "test"; these cases specifically verify the
    // dev/preview-only disabled Bridge behavior, so make that runtime environment explicit.
    vi.stubEnv('MODE', 'development')
    vi.stubEnv('VITE_APP_ENV', 'dev')
  }
  vi.resetModules()
  return import('./nativeBridge')
}

afterEach(() => {
  delete bridgeWindow.androidBridge
  delete bridgeWindow.nativeBridgeCallback
  delete bridgeWindow.androidBridgeCallback
  delete bridgeWindow.iosBridge
  delete bridgeWindow.webkit
  vi.unstubAllEnvs()
  vi.useRealTimers()
  vi.resetModules()
})

describe('JSBridge capability runtime', () => {
  it('supports late Android bridge injection and preserves the optional salt credential', async () => {
    const { getLoginToken, NativeBridgeError } = await loadBridge()

    await expect(getLoginToken()).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'bridge-unsupported',
      capability: 'getLoginToken',
    } satisfies Partial<InstanceType<typeof NativeBridgeError>>)

    bridgeWindow.androidBridge = {
      getLoginToken() {
        return '{"token":"late-token","salt":"late-salt"}'
      },
    }

    await expect(getLoginToken()).resolves.toEqual({ token: 'late-token', salt: 'late-salt' })
  })

  it('uses the confirmed iOS iosBridge.getLoginToken() contract', async () => {
    const { getLoginToken } = await loadBridge()
    const iosBridge = {
      marker: 'ios-host',
      getLoginToken() {
        expect(this).toBe(iosBridge)
        return '{"token":"ios-token","salt":"ios-salt"}'
      },
    }
    bridgeWindow.iosBridge = iosBridge

    await expect(getLoginToken()).resolves.toEqual({ token: 'ios-token', salt: 'ios-salt' })
  })

  it('resolves replacement injected-object instances on later invocations', async () => {
    const { getLoginToken } = await loadBridge()
    const firstBridge = {
      getLoginToken() {
        return '{"token":"first-token"}'
      },
    }
    const secondBridge = {
      getLoginToken() {
        return '{"token":"second-token"}'
      },
    }

    bridgeWindow.androidBridge = firstBridge
    await expect(getLoginToken()).resolves.toEqual({ token: 'first-token' })

    bridgeWindow.androidBridge = secondBridge
    await expect(getLoginToken()).resolves.toEqual({ token: 'second-token' })
  })

  it('preserves receiver binding for Android injected-object methods', async () => {
    const { getLoginToken } = await loadBridge()
    const injectedBridge = {
      marker: 'bound-host',
      getLoginToken() {
        expect(this).toBe(injectedBridge)
        return JSON.stringify({ token: this.marker })
      },
    }

    bridgeWindow.androidBridge = injectedBridge

    await expect(getLoginToken()).resolves.toEqual({ token: 'bound-host' })
  })

  it('rejects malformed JSON and invalid token DTOs instead of passing opaque Native results through', async () => {
    const { getLoginToken } = await loadBridge()

    bridgeWindow.androidBridge = {
      getLoginToken() {
        return '{broken'
      },
    }
    await expect(getLoginToken()).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'invocation-failed',
      capability: 'getLoginToken',
      cause: expect.objectContaining({
        name: 'NativeTransportError',
        code: 'payload-invalid',
      }),
    })

    bridgeWindow.androidBridge = {
      getLoginToken() {
        return '{"token":123}'
      },
    }
    await expect(getLoginToken()).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'invocation-failed',
      capability: 'getLoginToken',
      cause: expect.objectContaining({
        name: 'NativeTransportError',
        code: 'payload-invalid',
      }),
    })

    bridgeWindow.androidBridge = {
      getLoginToken() {
        return { token: 'object-is-not-the-contract' }
      },
    }
    await expect(getLoginToken()).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'invocation-failed',
      capability: 'getLoginToken',
      cause: expect.objectContaining({
        name: 'NativeTransportError',
        code: 'payload-invalid',
      }),
    })
  })

  it('keeps legacy token-only hosts compatible and rejects a malformed salt', async () => {
    const { getLoginToken } = await loadBridge()

    bridgeWindow.androidBridge = {
      getLoginToken() {
        return '{"token":"legacy-token"}'
      },
    }
    await expect(getLoginToken()).resolves.toEqual({ token: 'legacy-token' })

    bridgeWindow.androidBridge = {
      getLoginToken() {
        return '{"token":"token","salt":123}'
      },
    }
    await expect(getLoginToken()).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'invocation-failed',
      capability: 'getLoginToken',
      cause: expect.objectContaining({
        name: 'NativeTransportError',
        code: 'payload-invalid',
      }),
    })
  })

  it('distinguishes a missing method from a missing bridge', async () => {
    const { getLoginToken } = await loadBridge()
    bridgeWindow.androidBridge = {}

    await expect(getLoginToken()).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'capability-unsupported',
      capability: 'getLoginToken',
    })

    delete bridgeWindow.androidBridge
    await expect(getLoginToken()).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'bridge-unsupported',
      capability: 'getLoginToken',
    })
  })

  it('normalizes synchronous Native throws', async () => {
    const { getLoginToken } = await loadBridge()
    const thrown = new Error('native threw')
    bridgeWindow.iosBridge = {
      getLoginToken() {
        throw thrown
      },
    }

    await expect(getLoginToken()).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'invocation-failed',
      capability: 'getLoginToken',
      cause: thrown,
    })
  })

  it('keeps business bridge disabled while allowing Bridge Lab debug invocation in non-prod', async () => {
    const bridge = await loadBridge('disabled')
    bridgeWindow.iosBridge = {
      getLoginToken() {
        return '{"token":"ios-debug-token"}'
      },
    }

    await expect(bridge.getLoginToken()).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'bridge-disabled',
      capability: 'getLoginToken',
    })

    expect(
      bridge.getNativeBridgeCapabilityCatalog().find((item) => item.name === 'getLoginToken'),
    ).toMatchObject({
      platforms: ['android', 'ios'],
      supported: true,
      sensitiveResult: true,
    })

    await expect(
      bridge.invokeRegisteredNativeCapabilityForDebug('getLoginToken'),
    ).resolves.toEqual({ token: 'ios-debug-token' })
  })

  it('derives diagnostics from the confirmed Android and iOS injected objects', async () => {
    const { getNativeBridgeDiagnostics } = await loadBridge()

    bridgeWindow.androidBridge = {
      getLoginToken() {
        return '{"token":"android-token"}'
      },
    }
    expect(getNativeBridgeDiagnostics()).toEqual({
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

    delete bridgeWindow.androidBridge
    bridgeWindow.iosBridge = {
      getLoginToken() {
        return '{"token":"ios-token"}'
      },
    }
    expect(getNativeBridgeDiagnostics()).toEqual({
      mode: 'native',
      host: 'ios',
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
  })

  it('keeps legacy iOS messageHandlers as host diagnostics without promoting the old auth method', async () => {
    const { getLoginToken, getNativeBridgeDiagnostics } = await loadBridge()
    bridgeWindow.webkit = {
      messageHandlers: {
        getAuthorizationInfo: {
          postMessage() {},
        },
      },
    }

    expect(getNativeBridgeDiagnostics()).toEqual({
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
    await expect(getLoginToken()).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'bridge-unsupported',
      capability: 'getLoginToken',
    })
  })

  it('keeps disabled mode distinct from a browser without a Native bridge', async () => {
    bridgeWindow.androidBridge = {
      getLoginToken() {
        return '{"token":"must-not-run"}'
      },
    }
    const disabledBridge = await loadBridge('disabled')

    await expect(disabledBridge.getLoginToken()).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'bridge-disabled',
      capability: 'getLoginToken',
    })
    expect(disabledBridge.getNativeBridgeDiagnostics()).toMatchObject({
      mode: 'disabled',
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

    delete bridgeWindow.androidBridge
    const nativeBridge = await loadBridge('native')
    await expect(nativeBridge.getLoginToken()).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'bridge-unsupported',
      capability: 'getLoginToken',
    })
  })

  it('invokes Android closeWebView with the injected object as receiver', async () => {
    const { closeWebView, getNativeBridgeDiagnostics } = await loadBridge()
    let calls = 0
    const androidBridge = {
      marker: 'android-host',
      closeWebView() {
        expect(this).toBe(androidBridge)
        calls += 1
      },
    }
    bridgeWindow.androidBridge = androidBridge

    expect(getNativeBridgeDiagnostics().capabilities.closeWebView).toBe(true)
    await expect(closeWebView()).resolves.toBeUndefined()
    expect(calls).toBe(1)
  })

  it('invokes iOS closeWebView through iosBridge with no arguments', async () => {
    const { closeWebView, getNativeBridgeDiagnostics } = await loadBridge()
    const received: unknown[][] = []
    const iosBridge = {
      closeWebView(...args: unknown[]) {
        expect(this).toBe(iosBridge)
        received.push(args)
      },
    }
    bridgeWindow.iosBridge = iosBridge

    expect(getNativeBridgeDiagnostics().capabilities.closeWebView).toBe(true)
    await expect(closeWebView()).resolves.toBeUndefined()
    expect(received).toEqual([[]])
  })

  it('keeps closeWebView fail-closed when the current host has not implemented the method', async () => {
    const { closeWebView, getNativeBridgeDiagnostics } = await loadBridge()
    bridgeWindow.androidBridge = {
      getLoginToken() {
        return '{"token":"android-token"}'
      },
    }

    expect(getNativeBridgeDiagnostics().capabilities.closeWebView).toBe(false)
    await expect(closeWebView()).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'capability-unsupported',
      capability: 'closeWebView',
    })
  })


  it('correlates Android scanCode through androidBridgeCallback and preserves one-shot routing metadata', async () => {
    const { scanCode, getNativeBridgeDiagnostics } = await loadBridge()
    const received: Array<{ scanType: string; callbackId: string }> = []
    const androidBridge = {
      scanCode(payload: unknown) {
        expect(this).toBe(androidBridge)
        const request = JSON.parse(payload as string) as {
          scanType: string
          callbackId: string
        }
        received.push(request)
        queueMicrotask(() => {
          // Android feat/1109 marks non-device recognition explicitly and returns once.
          bridgeWindow.androidBridgeCallback?.(request.callbackId, {
            code: 0,
            message: 'ok',
            data: {
              text: 'QR-ANDROID-001',
              scanType: 'qr',
              isDevice: false,
            },
          })
        })
      },
    }
    bridgeWindow.androidBridge = androidBridge

    expect(getNativeBridgeDiagnostics().capabilities.scanCode).toBe(true)
    await expect(scanCode({ scanType: 'all' })).resolves.toEqual({
      code: 'QR-ANDROID-001',
      scanType: 'qr',
      isDevice: false,
    })
    expect(received).toEqual([
      {
        scanType: 'all',
        callbackId: expect.any(String),
      },
    ])
  })

    it('supports qr/bar/all scanType values on iOS without changing the field name', async () => {
    const { scanCode } = await loadBridge()
    const received: Array<{ scanType: string; callbackId: string }> = []
    bridgeWindow.iosBridge = {
      scanCode(payload: unknown) {
        const request = JSON.parse(payload as string) as { scanType: string; callbackId: string }
        received.push(request)
        queueMicrotask(() => {
          bridgeWindow.nativeBridgeCallback?.(request.callbackId, '{"code":"IOS-CODE"}')
        })
      },
    }

    await expect(scanCode({ scanType: 'qr' })).resolves.toEqual({ code: 'IOS-CODE' })
    await expect(scanCode({ scanType: 'bar' })).resolves.toEqual({ code: 'IOS-CODE' })
    await expect(scanCode({ scanType: 'all' })).resolves.toEqual({ code: 'IOS-CODE' })
    expect(received).toEqual([
      { scanType: 'qr', callbackId: expect.any(String) },
      { scanType: 'bar', callbackId: expect.any(String) },
      { scanType: 'all', callbackId: expect.any(String) },
    ])
  })

  it('keeps scanCode fail-closed for missing method and invalid Native results', async () => {
    const { scanCode } = await loadBridge()

    bridgeWindow.androidBridge = {}
    await expect(scanCode({ scanType: 'all' })).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'capability-unsupported',
      capability: 'scanCode',
    })

    bridgeWindow.androidBridge = {
      scanCode() {
        return '{broken'
      },
    }
    await expect(scanCode({ scanType: 'all' })).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'invocation-failed',
      capability: 'scanCode',
      cause: expect.objectContaining({
        name: 'NativeTransportError',
        code: 'payload-invalid',
      }),
    })

    bridgeWindow.androidBridge = {
      scanCode() {
        return '{"code":0,"data":{"text":123}}'
      },
    }
    await expect(scanCode({ scanType: 'all' })).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'invocation-failed',
      capability: 'scanCode',
      cause: expect.objectContaining({
        name: 'NativeTransportError',
        code: 'payload-invalid',
      }),
    })
  })

  it('rejects invalid debug scanType instead of forwarding an invented Native request', async () => {
    const bridge = await loadBridge('disabled')
    const received: unknown[] = []
    bridgeWindow.androidBridge = {
      scanCode(payload: unknown) {
        received.push(payload)
        return '{"code":"should-not-run"}'
      },
    }

    await expect(
      bridge.invokeRegisteredNativeCapabilityForDebug('scanCode', { scanType: 'camera' }),
    ).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'invocation-failed',
      capability: 'scanCode',
      cause: expect.objectContaining({
        name: 'NativeTransportError',
        code: 'payload-invalid',
      }),
    })
    expect(received).toEqual([])
  })


  it('keeps Bridge Lab async capability calls pending beyond the old 5s runtime timeout', async () => {
    vi.useFakeTimers()
    const bridge = await loadBridge('disabled')
    let callbackId: string | undefined

    bridgeWindow.androidBridge = {
      takePhoto(payload: unknown) {
        callbackId = (JSON.parse(payload as string) as { callbackId: string }).callbackId
      },
    }

    const promise = bridge.invokeRegisteredNativeCapabilityForDebug('takePhoto', {
      crop: true,
      maxWidth: 1080,
      maxHeight: 1080,
      quality: 0.8,
    })
    promise.catch(() => undefined)

    await vi.advanceTimersByTimeAsync(10_000)

    let settled = false
    promise.finally(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    bridgeWindow.androidBridgeCallback?.(callbackId as string, {
      code: 0,
      message: 'ok',
      data: {
        mimeType: 'image/jpeg',
        imageBase64: 'bridge-lab-delayed-photo',
      },
    })

    await expect(promise).resolves.toEqual({
      mimeType: 'image/jpeg',
      imageBase64: 'bridge-lab-delayed-photo',
    })
  })

  it('serializes takePhoto and chooseImage as one JSON string and parses image payloads', async () => {
    const { takePhoto, chooseImage } = await loadBridge()
    const received: Array<{ method: string; payload: unknown }> = []
    bridgeWindow.androidBridge = {
      takePhoto(payload: unknown) {
        received.push({ method: 'takePhoto', payload: JSON.parse(payload as string) })
        return '{"mimeType":"image/jpeg","imageBase64":"photo-base64"}'
      },
      chooseImage(payload: unknown) {
        received.push({ method: 'chooseImage', payload: JSON.parse(payload as string) })
        return '{"mimeType":"image/png","imageBase64":"album-base64"}'
      },
    }

    await expect(takePhoto()).resolves.toEqual({
      mimeType: 'image/jpeg',
      imageBase64: 'photo-base64',
    })
    await expect(chooseImage()).resolves.toEqual({
      mimeType: 'image/png',
      imageBase64: 'album-base64',
    })

    expect(received).toEqual([
      {
        method: 'takePhoto',
        payload: {
          crop: true,
          maxWidth: 1080,
          maxHeight: 1080,
          quality: 0.8,
          callbackId: expect.any(String),
        },
      },
      {
        method: 'chooseImage',
        payload: {
          crop: true,
          maxWidth: 1080,
          maxHeight: 1080,
          quality: 0.8,
          count: 1,
          callbackId: expect.any(String),
        },
      },
    ])
  })

  it('keeps Android takePhoto pending beyond the old 5s runtime timeout', async () => {
    vi.useFakeTimers()
    const { takePhoto } = await loadBridge()
    let callbackId: string | undefined

    bridgeWindow.androidBridge = {
      takePhoto(payload: unknown) {
        callbackId = (JSON.parse(payload as string) as { callbackId: string }).callbackId
      },
    }

    const promise = takePhoto()
    promise.catch(() => undefined)

    await vi.advanceTimersByTimeAsync(10_000)

    let settled = false
    promise.finally(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    bridgeWindow.androidBridgeCallback?.(callbackId as string, {
      code: 0,
      message: 'ok',
      data: {
        mimeType: 'image/jpeg',
        imageBase64: 'delayed-photo',
      },
    })

    await expect(promise).resolves.toEqual({
      mimeType: 'image/jpeg',
      imageBase64: 'delayed-photo',
    })
  })

  it('supports iOS saveImageToAlbum and copyText with confirmed field names', async () => {
    const { saveImageToAlbum, copyText } = await loadBridge()
    const received: Array<{ method: string; payload: unknown }> = []
    bridgeWindow.iosBridge = {
      saveImageToAlbum(payload: unknown) {
        received.push({ method: 'saveImageToAlbum', payload: JSON.parse(payload as string) })
        return '{"success":true}'
      },
      copyText(payload: unknown) {
        received.push({ method: 'copyText', payload: JSON.parse(payload as string) })
        return '{"success":true}'
      },
    }

    await expect(
      saveImageToAlbum({
        imageType: 'base64',
        imageData: 'poster-base64',
        fileName: 'kaboshi-invite.png',
      }),
    ).resolves.toEqual({ success: true })
    await expect(copyText({ text: 'https://example.com/invite' })).resolves.toEqual({
      success: true,
    })

    expect(received).toEqual([
      {
        method: 'saveImageToAlbum',
        payload: {
          imageType: 'base64',
          imageData: 'poster-base64',
          fileName: 'kaboshi-invite.png',
          callbackId: expect.any(String),
        },
      },
      {
        method: 'copyText',
        payload: {
          text: 'https://example.com/invite',
          callbackId: expect.any(String),
        },
      },
    ])
  })

  it('normalizes Android code=0 callback envelopes for saveImageToAlbum and copyText', async () => {
    const { saveImageToAlbum, copyText } = await loadBridge()
    bridgeWindow.androidBridge = {
      saveImageToAlbum(payload: unknown) {
        const request = JSON.parse(payload as string) as { callbackId: string }
        queueMicrotask(() => {
          bridgeWindow.androidBridgeCallback?.(request.callbackId, {
            code: 0,
            message: 'ok',
            data: {},
          })
        })
      },
      copyText(payload: unknown) {
        const request = JSON.parse(payload as string) as { callbackId: string }
        queueMicrotask(() => {
          bridgeWindow.androidBridgeCallback?.(request.callbackId, {
            code: 0,
            message: 'ok',
            data: {},
          })
        })
      },
    }

    await expect(
      saveImageToAlbum({
        imageType: 'base64',
        imageData: 'poster-base64',
        fileName: 'kaboshi-invite.png',
      }),
    ).resolves.toEqual({ success: true })
    await expect(copyText({ text: 'invite' })).resolves.toEqual({ success: true })
  })

  it('keeps H032 capabilities fail-closed for missing methods and malformed results', async () => {
    const { takePhoto, chooseImage, saveImageToAlbum, copyText } = await loadBridge()
    bridgeWindow.androidBridge = {}

    for (const invocation of [
      () => takePhoto(),
      () => chooseImage(),
      () =>
        saveImageToAlbum({
          imageType: 'base64',
          imageData: 'poster',
          fileName: 'kaboshi-invite.png',
        }),
      () => copyText({ text: 'invite' }),
    ]) {
      await expect(invocation()).rejects.toMatchObject({
        name: 'NativeBridgeError',
        code: 'capability-unsupported',
      })
    }

    bridgeWindow.androidBridge = {
      takePhoto() {
        return '{"mimeType":"image/jpeg","imageBase64":123}'
      },
      saveImageToAlbum() {
        return '{"success":"yes"}'
      },
    }

    await expect(takePhoto()).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'invocation-failed',
      capability: 'takePhoto',
      cause: expect.objectContaining({ code: 'payload-invalid' }),
    })
    await expect(
      saveImageToAlbum({
        imageType: 'base64',
        imageData: 'poster',
        fileName: 'kaboshi-invite.png',
      }),
    ).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'invocation-failed',
      capability: 'saveImageToAlbum',
      cause: expect.objectContaining({ code: 'payload-invalid' }),
    })
  })

  it('correlates Android showRewardAd through androidBridgeCallback', async () => {
    const { showRewardAd, getNativeBridgeDiagnostics } = await loadBridge()
    const received: Array<{ scene: string; callbackId: string }> = []
    const androidBridge = {
      showRewardAd(payload: unknown) {
        expect(this).toBe(androidBridge)
        const request = JSON.parse(payload as string) as {
          scene: string
          callbackId: string
        }
        received.push(request)
        queueMicrotask(() => {
          bridgeWindow.androidBridgeCallback?.(request.callbackId, {
            code: 0,
            message: 'ok',
            data: {
              scene: 'h5CheckinResign',
              status: 'completed',
            },
          })
        })
      },
    }
    bridgeWindow.androidBridge = androidBridge

    expect(getNativeBridgeDiagnostics().capabilities.showRewardAd).toBe(true)
    await expect(showRewardAd()).resolves.toEqual({ status: 'completed' })
    expect(received).toEqual([
      {
        scene: 'h5CheckinResign',
        callbackId: expect.any(String),
      },
    ])
  })

  it('supports all four iOS reward-ad statuses without renaming values', async () => {
    const { showRewardAd } = await loadBridge()
    const statuses = ['completed', 'closed', 'failed', 'no_fill'] as const
    let index = 0
    bridgeWindow.iosBridge = {
      showRewardAd(payload: unknown) {
        const request = JSON.parse(payload as string) as { scene: string; callbackId: string }
        expect(request).toEqual({
          scene: 'h5CheckinResign',
          callbackId: expect.any(String),
        })
        const status = statuses[index]
        index += 1
        queueMicrotask(() => {
          bridgeWindow.nativeBridgeCallback?.(request.callbackId, JSON.stringify({ status }))
        })
      },
    }

    for (const status of statuses) {
      await expect(showRewardAd()).resolves.toEqual({ status })
    }
  })

  it('rejects missing showRewardAd methods, invalid scenes, and unknown statuses', async () => {
    const bridge = await loadBridge()

    bridgeWindow.androidBridge = {}
    await expect(bridge.showRewardAd()).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'capability-unsupported',
      capability: 'showRewardAd',
    })

    bridgeWindow.androidBridge = {
      showRewardAd() {
        return '{"status":"rewarded"}'
      },
    }
    await expect(bridge.showRewardAd()).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'invocation-failed',
      capability: 'showRewardAd',
      cause: expect.objectContaining({ code: 'payload-invalid' }),
    })

    await expect(
      bridge.invokeRegisteredNativeCapabilityForDebug('showRewardAd', {
        scene: 'otherScene',
      }),
    ).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'invocation-failed',
      capability: 'showRewardAd',
      cause: expect.objectContaining({ code: 'payload-invalid' }),
    })
  })

  it('serializes openApp detect/open/store actions without inventing URLs', async () => {
    const { openApp, getNativeBridgeDiagnostics } = await loadBridge()
    const received: Array<Record<string, unknown>> = []
    const androidBridge = {
      openApp(payload: unknown) {
        expect(this).toBe(androidBridge)
        received.push(JSON.parse(payload as string) as Record<string, unknown>)
        return '{"success":true,"installed":true}'
      },
    }
    bridgeWindow.androidBridge = androidBridge

    expect(getNativeBridgeDiagnostics().capabilities.openApp).toBe(true)

    for (const action of ['detect', 'open', 'store'] as const) {
      await expect(
        openApp({
          action,
          inviteCode: '',
          fallbackUrl: '',
        }),
      ).resolves.toEqual({
        success: true,
        installed: true,
      })
    }

    expect(received).toEqual([
      { action: 'detect', inviteCode: '', fallbackUrl: '', callbackId: expect.any(String) },
      { action: 'open', inviteCode: '', fallbackUrl: '', callbackId: expect.any(String) },
      { action: 'store', inviteCode: '', fallbackUrl: '', callbackId: expect.any(String) },
    ])
  })

  it('keeps iOS openApp aligned with the Android callback envelope', async () => {
    const { openApp } = await loadBridge()
    const received: Array<Record<string, unknown>> = []
    bridgeWindow.iosBridge = {
      openApp(payload: unknown) {
        const request = JSON.parse(payload as string) as Record<string, unknown> & { callbackId: string }
        received.push(request)
        queueMicrotask(() => {
          bridgeWindow.nativeBridgeCallback?.(request.callbackId, {
            code: 0,
            message: 'ok',
            data: { action: 'open' },
          })
        })
      },
    }

    await expect(
      openApp({
        action: 'open',
        inviteCode: 'invite-123',
        fallbackUrl: 'https://example.com/fallback',
      }),
    ).resolves.toEqual({
      success: true,
      installed: true,
    })

    expect(received).toEqual([
      {
        action: 'open',
        inviteCode: 'invite-123',
        fallbackUrl: 'https://example.com/fallback',
        callbackId: expect.any(String),
      },
    ])
  })

  it('keeps iOS openApp pending beyond the old 5s runtime timeout', async () => {
    vi.useFakeTimers()
    const { openApp } = await loadBridge()
    let callbackId: string | undefined

    bridgeWindow.iosBridge = {
      openApp(payload: unknown) {
        callbackId = (JSON.parse(payload as string) as { callbackId: string }).callbackId
      },
    }

    const promise = openApp({
      action: 'open',
      inviteCode: 'invite-123',
      fallbackUrl: 'https://example.com/fallback',
    })
    promise.catch(() => undefined)

    await vi.advanceTimersByTimeAsync(10_000)

    let settled = false
    promise.finally(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    bridgeWindow.nativeBridgeCallback?.(callbackId as string, {
      code: 0,
      message: 'ok',
      data: { action: 'open' },
    })

    await expect(promise).resolves.toEqual({
      success: true,
      installed: true,
    })
  })

  it('rejects a bare openApp code=0 envelope without the Android baseline data fields', async () => {
    const bridge = await loadBridge()
    bridgeWindow.androidBridge = {
      openApp() {
        return '{"code":0,"message":"ok","data":{}}'
      },
    }

    await expect(
      bridge.openApp({
        action: 'open',
        inviteCode: '',
        fallbackUrl: '',
      }),
    ).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'invocation-failed',
      capability: 'openApp',
      cause: expect.objectContaining({ code: 'payload-invalid' }),
    })
  })

  it('rejects missing openApp methods, invalid actions, and malformed result booleans', async () => {
    const bridge = await loadBridge()

    bridgeWindow.androidBridge = {}
    await expect(
      bridge.openApp({
        action: 'detect',
        inviteCode: '',
        fallbackUrl: '',
      }),
    ).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'capability-unsupported',
      capability: 'openApp',
    })

    bridgeWindow.androidBridge = {
      openApp() {
        return '{"success":"yes","installed":true}'
      },
    }
    await expect(
      bridge.openApp({
        action: 'detect',
        inviteCode: '',
        fallbackUrl: '',
      }),
    ).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'invocation-failed',
      capability: 'openApp',
      cause: expect.objectContaining({ code: 'payload-invalid' }),
    })

    await expect(
      bridge.invokeRegisteredNativeCapabilityForDebug('openApp', {
        action: 'scheme',
        inviteCode: '',
        fallbackUrl: '',
      }),
    ).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'invocation-failed',
      capability: 'openApp',
      cause: expect.objectContaining({ code: 'payload-invalid' }),
    })
  })

  it.each([
    ['cancel', 'native-cancelled'],
    ['permission_denied', 'native-permission-denied'],
    ['fail', 'native-failed'],
  ] as const)(
    'maps confirmed Native error %s to structured Bridge error %s',
    async (nativeError, bridgeCode) => {
      const { scanCode } = await loadBridge()
      bridgeWindow.androidBridge = {
        scanCode() {
          return JSON.stringify({ error: nativeError })
        },
      }

      await expect(scanCode({ scanType: 'all' })).rejects.toMatchObject({
        name: 'NativeBridgeError',
        code: bridgeCode,
        capability: 'scanCode',
        cause: expect.objectContaining({
          name: 'NativeTransportError',
        }),
      })
    },
  )

  it('rejects unknown Native error payloads as invalid protocol data', async () => {
    const { takePhoto } = await loadBridge()
    bridgeWindow.iosBridge = {
      takePhoto() {
        return '{"error":"something_new"}'
      },
    }

    await expect(takePhoto()).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'invocation-failed',
      capability: 'takePhoto',
      cause: expect.objectContaining({
        name: 'NativeTransportError',
        code: 'payload-invalid',
      }),
    })
  })

  it('applies the same Native error payload semantics across result shapes', async () => {
    const bridge = await loadBridge()
    bridgeWindow.androidBridge = {
      getLoginToken() {
        return '{"error":"fail"}'
      },
      chooseImage() {
        return '{"error":"permission_denied"}'
      },
      copyText() {
        return '{"error":"cancel"}'
      },
      showRewardAd() {
        return '{"error":"fail"}'
      },
      openApp() {
        return '{"error":"permission_denied"}'
      },
    }

    await expect(bridge.getLoginToken()).rejects.toMatchObject({
      code: 'native-failed',
      capability: 'getLoginToken',
    })
    await expect(bridge.chooseImage()).rejects.toMatchObject({
      code: 'native-permission-denied',
      capability: 'chooseImage',
    })
    await expect(bridge.copyText({ text: 'invite' })).rejects.toMatchObject({
      code: 'native-cancelled',
      capability: 'copyText',
    })
    await expect(bridge.showRewardAd()).rejects.toMatchObject({
      code: 'native-failed',
      capability: 'showRewardAd',
    })
    await expect(
      bridge.openApp({
        action: 'detect',
        inviteCode: '',
        fallbackUrl: '',
      }),
    ).rejects.toMatchObject({
      code: 'native-permission-denied',
      capability: 'openApp',
    })
  })

  it('marks photo results sensitive but keeps boolean utility results visible in Bridge Lab catalog', async () => {
    const bridge = await loadBridge('disabled')
    bridgeWindow.androidBridge = {
      takePhoto() {
        return '{"mimeType":"image/jpeg","imageBase64":"secret-image"}'
      },
      chooseImage() {
        return '{"mimeType":"image/jpeg","imageBase64":"secret-image"}'
      },
      saveImageToAlbum() {
        return '{"success":true}'
      },
      copyText() {
        return '{"success":true}'
      },
    }

    const catalog = bridge.getNativeBridgeCapabilityCatalog()
    expect(catalog.find((item) => item.name === 'takePhoto')).toMatchObject({
      supported: true,
      sensitiveResult: true,
    })
    expect(catalog.find((item) => item.name === 'chooseImage')).toMatchObject({
      supported: true,
      sensitiveResult: true,
    })
    expect(catalog.find((item) => item.name === 'saveImageToAlbum')).toMatchObject({
      supported: true,
      sensitiveResult: false,
    })
    expect(catalog.find((item) => item.name === 'copyText')).toMatchObject({
      supported: true,
      sensitiveResult: false,
    })
  })
})

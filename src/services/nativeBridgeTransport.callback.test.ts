import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createCallbackInjectedObjectTransport,
  INJECTED_CALLBACK_TIMEOUT_MS,
  subscribeNativeBridgeTransportDebugEvents,
  type NativeBridgeTransportDebugEvent,
  type NativeTransportResolution,
  type NativeTransportWindow,
} from './nativeBridgeTransport'

type CallbackRequest = {
  value: string
  callbackId: string
}

const hostWindow = window as NativeTransportWindow

function createProbeTransport(methodName: string, timeoutMs = 1_000) {
  return createCallbackInjectedObjectTransport<string, string>({
    objectName: 'androidBridge',
    methodName,
    callbackName: 'nativeBridgeCallback',
    callbackAliases: ['androidBridgeCallback'],
    timeoutMs,
    serializeArgs: (value, callbackId) => [JSON.stringify({ value, callbackId })],
    parseResult: (payload) => {
      if (!payload || typeof payload !== 'object' || typeof (payload as { value?: unknown }).value !== 'string') {
        throw new TypeError('probe payload requires a string value')
      }
      return (payload as { value: string }).value
    },
  })
}

function invoke(
  resolution: NativeTransportResolution<string>,
): Promise<string> {
  if (!resolution.supported) {
    throw new Error(`expected supported transport, got ${resolution.code}`)
  }
  return Promise.resolve(resolution.invoke())
}

afterEach(() => {
  delete hostWindow.androidBridge
  delete hostWindow.nativeBridgeCallback
  delete hostWindow.androidBridgeCallback
  delete hostWindow.iosBridge
  vi.useRealTimers()
})

describe('Android injected callback dispatcher', () => {
  it('keeps same-capability concurrent requests independently correlated', async () => {
    const requests: CallbackRequest[] = []
    hostWindow.androidBridge = {
      scanCode(payload: unknown) {
        requests.push(JSON.parse(payload as string) as CallbackRequest)
      },
    }
    const transport = createProbeTransport('scanCode')

    const first = invoke(transport.resolve(hostWindow, 'first'))
    const second = invoke(transport.resolve(hostWindow, 'second'))

    expect(requests).toHaveLength(2)
    expect(requests[0].callbackId).not.toBe(requests[1].callbackId)

    hostWindow.nativeBridgeCallback?.(requests[0].callbackId, { value: 'first-result' })
    hostWindow.nativeBridgeCallback?.(requests[1].callbackId, { value: 'second-result' })

    await expect(first).resolves.toBe('first-result')
    await expect(second).resolves.toBe('second-result')
  })

  it('shares one callback channel across different capabilities', async () => {
    const scanRequests: CallbackRequest[] = []
    const adRequests: CallbackRequest[] = []
    hostWindow.androidBridge = {
      scanCode(payload: unknown) {
        scanRequests.push(JSON.parse(payload as string) as CallbackRequest)
      },
      showRewardAd(payload: unknown) {
        adRequests.push(JSON.parse(payload as string) as CallbackRequest)
      },
    }

    const scanTransport = createProbeTransport('scanCode')
    const adTransport = createProbeTransport('showRewardAd')
    const scan = invoke(scanTransport.resolve(hostWindow, 'scan'))
    const ad = invoke(adTransport.resolve(hostWindow, 'ad'))

    hostWindow.androidBridgeCallback?.(adRequests[0].callbackId, { value: 'ad-result' })
    hostWindow.androidBridgeCallback?.(scanRequests[0].callbackId, { value: 'scan-result' })

    await expect(scan).resolves.toBe('scan-result')
    await expect(ad).resolves.toBe('ad-result')
  })

  it('keeps a confirmed intermediate callback pending until the capability marks a later payload terminal', async () => {
    const requests: CallbackRequest[] = []
    hostWindow.androidBridge = {
      scanCode(payload: unknown) {
        requests.push(JSON.parse(payload as string) as CallbackRequest)
      },
    }

    const transport = createCallbackInjectedObjectTransport<string, string>({
      objectName: 'androidBridge',
      methodName: 'scanCode',
      callbackName: 'androidBridgeCallback',
      serializeArgs: (value, callbackId) => [JSON.stringify({ value, callbackId })],
      isTerminalPayload: (_payload, callbackCount) => callbackCount > 1,
      parseResult: (payload) => (payload as { value: string }).value,
    })

    const promise = invoke(transport.resolve(hostWindow, 'voucher'))
    let settled = false
    promise.finally(() => {
      settled = true
    })

    hostWindow.androidBridgeCallback?.(requests[0].callbackId, { value: 'scan-recognized' })
    await Promise.resolve()
    expect(settled).toBe(false)

    hostWindow.androidBridgeCallback?.(requests[0].callbackId, { value: 'device-finished' })
    await expect(promise).resolves.toBe('device-finished')
  })

  it('emits request correlation and callback-stage diagnostics without changing settlement', async () => {
    const events: NativeBridgeTransportDebugEvent[] = []
    const unsubscribe = subscribeNativeBridgeTransportDebugEvents((event) => events.push(event))
    const requests: Array<{ scanType: string; callbackId: string }> = []
    hostWindow.androidBridge = {
      scanCode(payload: unknown) {
        requests.push(JSON.parse(payload as string) as { scanType: string; callbackId: string })
      },
    }
    const transport = createCallbackInjectedObjectTransport<'all', string>({
      objectName: 'androidBridge',
      methodName: 'scanCode',
      callbackName: 'nativeBridgeCallback',
      callbackAliases: ['androidBridgeCallback'],
      timeoutMs: 1_000,
      serializeArgs: (scanType, callbackId) => [JSON.stringify({ scanType, callbackId })],
      isTerminalPayload: (_payload, callbackCount) => callbackCount > 1,
      parseResult: (payload) => (payload as { result: string }).result,
    })

    try {
      const promise = invoke(transport.resolve(hostWindow, 'all'))
      const request = requests[0]
      expect(request).toBeDefined()
      expect(events[0]).toMatchObject({
        type: 'request',
        objectName: 'androidBridge',
        methodName: 'scanCode',
        callbackId: request.callbackId,
        callbackNames: ['nativeBridgeCallback', 'androidBridgeCallback'],
        timeoutMs: 1_000,
        args: [expect.stringContaining(request.callbackId)],
      })

      hostWindow.androidBridgeCallback?.(request.callbackId, { result: 'scan-recognized' })
      expect(events[1]).toMatchObject({
        type: 'callback',
        objectName: 'androidBridge',
        methodName: 'scanCode',
        callbackId: request.callbackId,
        callbackName: 'androidBridgeCallback',
        source: 'callback',
        callbackCount: 1,
        pendingMatched: true,
        terminal: false,
      })

      hostWindow.nativeBridgeCallback?.(request.callbackId, { result: 'device-finished' })
      expect(events[2]).toMatchObject({
        type: 'callback',
        callbackId: request.callbackId,
        callbackName: 'nativeBridgeCallback',
        source: 'callback',
        callbackCount: 2,
        pendingMatched: true,
        terminal: true,
      })
      await expect(promise).resolves.toBe('device-finished')

      hostWindow.androidBridgeCallback?.('unmatched-callback-id', { error: 'unknown' })
      expect(events[3]).toMatchObject({
        type: 'callback',
        callbackId: 'unmatched-callback-id',
        callbackName: 'androidBridgeCallback',
        pendingMatched: false,
      })
      expect(events).toHaveLength(4)
    } finally {
      unsubscribe()
    }
  })

  it('emits a correlated timeout event and still rejects the pending invocation', async () => {
    vi.useFakeTimers()
    const events: NativeBridgeTransportDebugEvent[] = []
    const unsubscribe = subscribeNativeBridgeTransportDebugEvents((event) => events.push(event))
    hostWindow.androidBridge = { scanCode() {} }
    const transport = createProbeTransport('scanCode', 25)

    try {
      const promise = invoke(transport.resolve(hostWindow, 'waiting'))
      const rejection = expect(promise).rejects.toMatchObject({ code: 'callback-timeout' })
      await vi.advanceTimersByTimeAsync(25)
      await rejection
      expect(events).toContainEqual(expect.objectContaining({
        type: 'timeout',
        objectName: 'androidBridge',
        methodName: 'scanCode',
        timeoutMs: 25,
        callbackId: expect.any(String),
      }))
    } finally {
      unsubscribe()
    }
  })

  it('resolves out-of-order callbacks by callbackId instead of invocation order', async () => {
    const requests: CallbackRequest[] = []
    hostWindow.androidBridge = {
      scanCode(payload: unknown) {
        requests.push(JSON.parse(payload as string) as CallbackRequest)
      },
    }
    const transport = createProbeTransport('scanCode')

    const first = invoke(transport.resolve(hostWindow, 'one'))
    const second = invoke(transport.resolve(hostWindow, 'two'))
    const third = invoke(transport.resolve(hostWindow, 'three'))

    hostWindow.androidBridgeCallback?.(requests[2].callbackId, { value: 'three-result' })
    hostWindow.androidBridgeCallback?.(requests[0].callbackId, { value: 'one-result' })
    hostWindow.androidBridgeCallback?.(requests[1].callbackId, { value: 'two-result' })

    await expect(Promise.all([first, second, third])).resolves.toEqual([
      'one-result',
      'two-result',
      'three-result',
    ])
  })

  it('keeps the same long callback timeout for Android and iOS injected-object methods', async () => {
    vi.useFakeTimers()

    const androidRequests: CallbackRequest[] = []
    const iosRequests: CallbackRequest[] = []

    hostWindow.androidBridge = {
      takePhoto(payload: unknown) {
        androidRequests.push(JSON.parse(payload as string) as CallbackRequest)
      },
    }
    hostWindow.iosBridge = {
      takePhoto(payload: unknown) {
        iosRequests.push(JSON.parse(payload as string) as CallbackRequest)
      },
    }

    const createTransport = (objectName: 'androidBridge' | 'iosBridge') =>
      createCallbackInjectedObjectTransport<string, string>({
        objectName,
        methodName: 'takePhoto',
        callbackName: 'nativeBridgeCallback',
        callbackAliases: objectName === 'androidBridge' ? ['androidBridgeCallback'] : undefined,
        serializeArgs: (value, callbackId) => [JSON.stringify({ value, callbackId })],
        parseResult: (payload) => (payload as { value: string }).value,
      })

    const android = invoke(createTransport('androidBridge').resolve(hostWindow, 'android'))
    const ios = invoke(createTransport('iosBridge').resolve(hostWindow, 'ios'))

    await vi.advanceTimersByTimeAsync(10_000)

    let androidSettled = false
    let iosSettled = false
    android.finally(() => {
      androidSettled = true
    })
    ios.finally(() => {
      iosSettled = true
    })
    await Promise.resolve()

    expect(androidSettled).toBe(false)
    expect(iosSettled).toBe(false)
    expect(INJECTED_CALLBACK_TIMEOUT_MS).toBe(120_000)

    hostWindow.androidBridgeCallback?.(androidRequests[0].callbackId, { value: 'android-result' })
    hostWindow.nativeBridgeCallback?.(iosRequests[0].callbackId, { value: 'ios-result' })

    await expect(android).resolves.toBe('android-result')
    await expect(ios).resolves.toBe('ios-result')
  })

  it('uses the same callbackId correlation model for iOS injected-object methods', async () => {
    const requests: CallbackRequest[] = []
    hostWindow.iosBridge = {
      scanCode(payload: unknown) {
        const request = JSON.parse(payload as string) as CallbackRequest
        requests.push(request)
        queueMicrotask(() => {
          hostWindow.nativeBridgeCallback?.(request.callbackId, { value: 'ios-result' })
        })
      },
    }
    const transport = createCallbackInjectedObjectTransport<string, string>({
      objectName: 'iosBridge',
      methodName: 'scanCode',
      callbackName: 'nativeBridgeCallback',
      serializeArgs: (value, callbackId) => [JSON.stringify({ value, callbackId })],
      parseResult: (payload) => (payload as { value: string }).value,
    })

    const resolution = transport.resolve(hostWindow, 'ios')
    if (!resolution.supported) throw new Error('Expected iOS callback transport to resolve.')

    await expect(Promise.resolve(resolution.invoke())).resolves.toBe('ios-result')
    expect(requests).toEqual([
      { value: 'ios', callbackId: expect.any(String) },
    ])
  })

  it('removes timed-out requests so stale callbacks cannot settle a newer invocation', async () => {
    vi.useFakeTimers()

    const fallback = vi.fn()
    hostWindow.androidBridgeCallback = fallback
    const requests: CallbackRequest[] = []
    hostWindow.androidBridge = {
      scanCode(payload: unknown) {
        requests.push(JSON.parse(payload as string) as CallbackRequest)
      },
    }
    const transport = createProbeTransport('scanCode', 25)

    const first = invoke(transport.resolve(hostWindow, 'first'))
    const firstResult = expect(first).rejects.toMatchObject({ code: 'callback-timeout' })
    await vi.advanceTimersByTimeAsync(25)
    await firstResult

    const firstId = requests[0].callbackId
    const second = invoke(transport.resolve(hostWindow, 'second'))
    const secondId = requests[1].callbackId

    hostWindow.androidBridgeCallback?.(firstId, { value: 'stale-result' })
    expect(fallback).toHaveBeenCalledWith(firstId, { value: 'stale-result' })

    hostWindow.androidBridgeCallback?.(secondId, { value: 'second-result' })
    await expect(second).resolves.toBe('second-result')
  })
})

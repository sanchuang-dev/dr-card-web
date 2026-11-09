import { afterEach, describe, expect, it, vi } from 'vitest'

import { scanCode } from './nativeBridge'
import {
  INJECTED_CALLBACK_TIMEOUT_MS,
  type NativeTransportWindow,
} from './nativeBridgeTransport'

const hostWindow = window as NativeTransportWindow

type CapturedScanRequest = {
  callbackId: string
  scanType: 'qr' | 'bar' | 'all'
}

afterEach(() => {
  vi.useRealTimers()
  delete hostWindow.androidBridge
  delete hostWindow.androidBridgeCallback
  delete hostWindow.nativeBridgeCallback
  delete hostWindow.iosBridge
})

function installAndroidScanHost() {
  let request: CapturedScanRequest | undefined
  hostWindow.androidBridge = {
    scanCode(payload: unknown) {
      request = JSON.parse(payload as string) as CapturedScanRequest
    },
  }

  return () => {
    if (!request) throw new Error('scanCode request was not captured')
    return request
  }
}

describe('scanCode Android feat/1109 callback contract', () => {
  it('settles the first non-device recognition callback and preserves its routing metadata', async () => {
    const getRequest = installAndroidScanHost()
    const promise = scanCode({ scanType: 'qr' })
    const request = getRequest()
    const raw = 'https://kbs.3cgroup.cn/buddy/invite/scan?code=550e8400-e29b-41d4-a716-446655440000'

    hostWindow.androidBridgeCallback?.(request.callbackId, {
      code: 0,
      message: 'ok',
      data: { text: raw, scanType: 'qr', isDevice: false },
    })

    await expect(promise).resolves.toEqual({
      code: raw,
      scanType: 'qr',
      isDevice: false,
    })
  })

  it('settles a Native-owned device start callback and preserves consumeUse when present', async () => {
    const getRequest = installAndroidScanHost()
    const promise = scanCode({ scanType: 'qr' })
    const request = getRequest()

    hostWindow.androidBridgeCallback?.(request.callbackId, {
      code: 0,
      message: 'ok',
      data: { text: 'DEVICE-QR-011', scanType: 'qr', consumeUse: '11' },
    })

    await expect(promise).resolves.toEqual({
      code: 'DEVICE-QR-011',
      scanType: 'qr',
      consumeUse: '11',
    })
  })

  it('settles vending use-17 callbacks without inventing isDevice or consumeUse metadata', async () => {
    const getRequest = installAndroidScanHost()
    const promise = scanCode({ scanType: 'qr' })
    const request = getRequest()

    hostWindow.androidBridgeCallback?.(request.callbackId, {
      code: 0,
      message: 'ok',
      data: { text: 'DEVICE-QR-017', scanType: 'qr' },
    })

    await expect(promise).resolves.toEqual({
      code: 'DEVICE-QR-017',
      scanType: 'qr',
    })
  })

  it('rejects when the Native-owned device start fails', async () => {
    const getRequest = installAndroidScanHost()
    const promise = scanCode({ scanType: 'qr' })
    const request = getRequest()

    hostWindow.androidBridgeCallback?.(request.callbackId, {
      code: 5,
      message: 'device start failed',
      data: {},
    })

    await expect(promise).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: 'native-failed',
      capability: 'scanCode',
    })
  })

  it.each([
    [1, 'native-cancelled'],
    [2, 'native-permission-denied'],
    [3, 'native-permission-denied'],
  ] as const)('settles Native code %s immediately as %s', async (nativeCode, errorCode) => {
    const getRequest = installAndroidScanHost()
    const promise = scanCode({ scanType: 'qr' })
    const request = getRequest()

    hostWindow.androidBridgeCallback?.(request.callbackId, {
      code: nativeCode,
      message: nativeCode === 1 ? 'cancel' : 'permission denied',
      data: {},
    })

    await expect(promise).rejects.toMatchObject({
      name: 'NativeBridgeError',
      code: errorCode,
      capability: 'scanCode',
    })
  })

  it('cleans the pending callback after the first terminal result', async () => {
    vi.useFakeTimers()

    const lateCallbackFallback = vi.fn()
    hostWindow.androidBridgeCallback = lateCallbackFallback

    const getRequest = installAndroidScanHost()
    const promise = scanCode({ scanType: 'qr' })
    const request = getRequest()

    hostWindow.androidBridgeCallback?.(request.callbackId, {
      code: 0,
      message: 'ok',
      data: { text: 'UNKNOWN-QR', scanType: 'qr', isDevice: false },
    })

    await expect(promise).resolves.toMatchObject({ code: 'UNKNOWN-QR', isDevice: false })

    const latePayload = { code: 0, message: 'duplicate', data: {} }
    hostWindow.androidBridgeCallback?.(request.callbackId, latePayload)
    expect(lateCallbackFallback).toHaveBeenCalledWith(request.callbackId, latePayload)

    await vi.advanceTimersByTimeAsync(INJECTED_CALLBACK_TIMEOUT_MS)
    expect(lateCallbackFallback).toHaveBeenCalledTimes(1)
  })

  it('keeps the existing one-shot iOS adapter shape without inferring Android metadata', async () => {
    let request: CapturedScanRequest | undefined
    hostWindow.iosBridge = {
      scanCode(payload: unknown) {
        request = JSON.parse(payload as string) as CapturedScanRequest
      },
    }

    const promise = scanCode({ scanType: 'qr' })
    if (!request) throw new Error('iOS scanCode request was not captured')

    hostWindow.nativeBridgeCallback?.(request.callbackId, JSON.stringify({ code: 'IOS-RAW-QR' }))

    await expect(promise).resolves.toEqual({ code: 'IOS-RAW-QR' })
  })
})

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

describe('scanCode Android H037 transaction contract', () => {
  it('keeps the first scan-success callback pending and resolves only after device success', async () => {
    const getRequest = installAndroidScanHost()
    const promise = scanCode({ scanType: 'all' })
    const request = getRequest()

    let settled = false
    promise.finally(() => {
      settled = true
    })

    hostWindow.androidBridgeCallback?.(request.callbackId, {
      code: 0,
      message: 'ok',
      data: { text: 'DEVICE-QR-001', scanType: 'qr' },
    })

    await Promise.resolve()
    expect(settled).toBe(false)

    hostWindow.androidBridgeCallback?.(request.callbackId, {
      code: 0,
      message: 'ok',
      data: { text: 'DEVICE-QR-001', scanType: 'qr' },
    })

    await expect(promise).resolves.toEqual({ code: 'DEVICE-QR-001', scanType: 'qr' })
  })

  it('settles a non-device QR from the first recognition callback and preserves classification', async () => {
    const getRequest = installAndroidScanHost()
    const promise = scanCode({ scanType: 'qr' })
    const request = getRequest()
    const raw = 'https://kbs.3cgroup.cn/buddy/invite/scan?code=550e8400-e29b-41d4-a716-446655440000'

    hostWindow.androidBridgeCallback?.(request.callbackId, {
      code: 0,
      message: 'ok',
      data: { text: raw, scanType: 'qr', isDevice: false },
    })

    await expect(promise).resolves.toEqual({ code: raw, scanType: 'qr', isDevice: false })
  })

  it('keeps an explicitly classified device QR pending until its terminal callback', async () => {
    const getRequest = installAndroidScanHost()
    const promise = scanCode({ scanType: 'qr' })
    const request = getRequest()
    let settled = false
    promise.finally(() => { settled = true })

    hostWindow.androidBridgeCallback?.(request.callbackId, {
      code: 0,
      message: 'ok',
      data: { text: 'DEVICE-QR-IS-DEVICE', scanType: 'qr', isDevice: true },
    })
    await Promise.resolve()
    expect(settled).toBe(false)

    hostWindow.androidBridgeCallback?.(request.callbackId, {
      code: 0,
      message: 'ok',
      data: { text: 'DEVICE-QR-IS-DEVICE', scanType: 'qr', isDevice: true },
    })

    await expect(promise).resolves.toEqual({
      code: 'DEVICE-QR-IS-DEVICE',
      scanType: 'qr',
      isDevice: true,
    })
  })

  it('rejects when the device stage fails after a successful scan', async () => {
    const getRequest = installAndroidScanHost()
    const promise = scanCode({ scanType: 'all' })
    const request = getRequest()

    hostWindow.androidBridgeCallback?.(request.callbackId, {
      code: 0,
      message: 'ok',
      data: { text: 'DEVICE-QR-002', scanType: 'qr' },
    })

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
  ] as const)('settles first-stage Native code %s immediately as %s', async (nativeCode, errorCode) => {
    const getRequest = installAndroidScanHost()
    const promise = scanCode({ scanType: 'all' })
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

  it('cleans up the Android scan pending entry at the existing callback timeout', async () => {
    vi.useFakeTimers()

    const lateCallbackFallback = vi.fn()
    hostWindow.androidBridgeCallback = lateCallbackFallback

    const getRequest = installAndroidScanHost()
    const promise = scanCode({ scanType: 'all' })
    promise.catch(() => undefined)
    const request = getRequest()

    hostWindow.androidBridgeCallback?.(request.callbackId, {
      code: 0,
      message: 'ok',
      data: { text: 'DEVICE-QR-TIMEOUT', scanType: 'qr' },
    })

    await vi.advanceTimersByTimeAsync(INJECTED_CALLBACK_TIMEOUT_MS)

    await expect(promise).rejects.toMatchObject({
      name: 'NativeBridgeError',
      capability: 'scanCode',
    })

    hostWindow.androidBridgeCallback?.(request.callbackId, {
      code: 0,
      message: 'late-device-result',
      data: { text: 'DEVICE-QR-TIMEOUT', scanType: 'qr' },
    })

    expect(lateCallbackFallback).toHaveBeenCalledWith(
      request.callbackId,
      expect.objectContaining({ message: 'late-device-result' }),
    )
  })
})

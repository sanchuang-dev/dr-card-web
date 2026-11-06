import { afterEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import BridgeLab from './BridgeLab'

type AndroidLabWindow = Window & {
  androidBridge?: Record<string, unknown>
  iosBridge?: Record<string, unknown>
  nativeBridgeCallback?: (callbackId: string, payload: unknown) => void
  androidBridgeCallback?: (callbackId: string, payload: unknown) => void
  webkit?: {
    messageHandlers?: Record<string, { postMessage(payload: unknown): void } | undefined>
  }
  onToken?: (token: unknown) => unknown
  testFunc?: (params: unknown) => string
}

const labWindow = window as AndroidLabWindow

function usePlatform(osType?: 'android' | 'iOS' | 'ios') {
  const suffix = osType ? `?osType=${osType}` : ''
  window.history.replaceState({}, '', `/__debug/bridge-lab${suffix}`)
}

afterEach(() => {
  delete labWindow.androidBridge
  delete labWindow.iosBridge
  delete labWindow.nativeBridgeCallback
  delete labWindow.androidBridgeCallback
  delete labWindow.webkit
  delete labWindow.onToken
  delete labWindow.testFunc
  usePlatform()
})

describe('Bridge Lab page', () => {
  it('uses osType to scope registered capabilities and Raw Probe to Android', () => {
    usePlatform('android')
    render(<BridgeLab />)

    expect(screen.getByRole('heading', { name: 'Bridge Lab' })).toBeTruthy()
    expect(document.querySelector('[data-capability-name="getLoginToken"]')).not.toBeNull()
    expect(document.querySelector('[data-capability-name="closeWebView"]')).not.toBeNull()
    expect(document.querySelector('[data-capability-name="scanCode"]')).not.toBeNull()
    expect(document.querySelector('[data-capability-name="takePhoto"]')).not.toBeNull()
    expect(document.querySelector('[data-capability-name="chooseImage"]')).not.toBeNull()
    expect(document.querySelector('[data-capability-name="saveImageToAlbum"]')).not.toBeNull()
    expect(document.querySelector('[data-capability-name="copyText"]')).not.toBeNull()
    expect(document.querySelector('[data-capability-name="showRewardAd"]')).not.toBeNull()
    expect(document.querySelector('[data-capability-name="openApp"]')).not.toBeNull()
    expect(document.querySelector('[data-android-raw-probe]')).not.toBeNull()
    expect(document.querySelector('[data-ios-raw-probe]')).toBeNull()
    expect(screen.getByLabelText('input JSON')).toBeTruthy()
  })

  it('keeps bridge-branch Android calls as editable Raw Probe presets', () => {
    usePlatform('android')
    render(<BridgeLab />)

    fireEvent.click(screen.getByRole('button', { name: 'Android preset submitOrder' }))

    expect((screen.getByLabelText('Android object') as HTMLInputElement).value).toBe('androidBridge')
    expect((screen.getByLabelText('Android method') as HTMLInputElement).value).toBe('submitOrder')
    expect((screen.getByLabelText('Android 参数模式') as HTMLSelectElement).value).toBe('string')
    expect((screen.getByLabelText('Android 参数') as HTMLTextAreaElement).value).toBe(
      '{"orderId":1001,"money":99}',
    )
  })

  it('accepts lowercase osType=ios and shows the iOS registered capability and Raw Probe', () => {
    usePlatform('ios')
    render(<BridgeLab />)

    expect(document.querySelector('[data-android-raw-probe]')).toBeNull()
    expect(document.querySelector('[data-ios-raw-probe]')).not.toBeNull()
    expect(document.querySelector('[data-capability-name="getLoginToken"]')).not.toBeNull()
    expect(document.querySelector('[data-capability-name="getAuthorizationInfo"]')).toBeNull()
    expect(document.querySelector('[data-capability-name="closeWebView"]')).not.toBeNull()
    expect(document.querySelector('[data-capability-name="scanCode"]')).not.toBeNull()
    expect(document.querySelector('[data-capability-name="takePhoto"]')).not.toBeNull()
    expect(document.querySelector('[data-capability-name="chooseImage"]')).not.toBeNull()
    expect(document.querySelector('[data-capability-name="saveImageToAlbum"]')).not.toBeNull()
    expect(document.querySelector('[data-capability-name="copyText"]')).not.toBeNull()
    expect(document.querySelector('[data-capability-name="showRewardAd"]')).not.toBeNull()
    expect(document.querySelector('[data-capability-name="openApp"]')).not.toBeNull()
    expect(screen.getByLabelText('input JSON')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'iOS preset getAuthorizationInfo' }))
    expect((screen.getByLabelText('iOS message handler') as HTMLInputElement).value).toBe(
      'getAuthorizationInfo',
    )
    expect((screen.getByLabelText('iOS payload 模式') as HTMLSelectElement).value).toBe(
      'empty-object',
    )
    expect((screen.getByLabelText('iOS callback') as HTMLInputElement).value).toBe('onToken')
  })

  it('lets Bridge Lab invoke the confirmed iosBridge.getLoginToken host even when preview business bridge mode is disabled', async () => {
    usePlatform('ios')
    labWindow.iosBridge = {
      getLoginToken() {
        return '{"token":"ios-preview-token"}'
      },
    }

    render(<BridgeLab />)

    const capability = document.querySelector(
      '[data-capability-name="getLoginToken"]',
    ) as HTMLButtonElement
    expect(capability).not.toBeNull()
    fireEvent.click(capability)

    const invokeButton = screen.getByRole('button', { name: '调用 getLoginToken' })
    expect((invokeButton as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(invokeButton)

    await waitFor(() => {
      expect(screen.getByText('[REDACTED]')).toBeTruthy()
    })
    expect(screen.queryByText('ios-preview-token')).toBeNull()
  })

  it('preloads scanCode input and invokes Android with a callback id', async () => {
    usePlatform('android')
    labWindow.androidBridge = {
      scanCode(payload: unknown) {
        expect(typeof payload).toBe('string')
        const request = JSON.parse(payload as string) as {
          scanType: string
          callbackId: string
        }
        expect(request).toMatchObject({
          scanType: 'all',
          callbackId: expect.any(String),
        })
        queueMicrotask(() => {
          labWindow.androidBridgeCallback?.(request.callbackId, {
            code: 0,
            message: 'ok',
            data: { text: 'bridge-lab-scan', scanType: 'qr' },
          })
          labWindow.androidBridgeCallback?.(request.callbackId, {
            code: 0,
            message: 'ok',
            data: { text: 'bridge-lab-scan', scanType: 'qr' },
          })
        })
      },
    }

    render(<BridgeLab />)

    fireEvent.click(
      document.querySelector('[data-capability-name="scanCode"]') as HTMLButtonElement,
    )
    expect((screen.getByLabelText('input JSON') as HTMLTextAreaElement).value).toBe(
      '{"scanType":"all"}',
    )
    fireEvent.click(screen.getByRole('button', { name: '调用 scanCode' }))

    await waitFor(() => {
      expect(screen.getByText('[REDACTED]')).toBeTruthy()
    })
    expect(screen.queryByText(/bridge-lab-scan/)).toBeNull()
  })

  it('shows scan callback correlation, actual endpoint, both stages, and redacts the QR text', async () => {
    usePlatform('android')
    let request: { scanType: string; callbackId: string } | undefined
    labWindow.androidBridge = {
      scanCode(payload: unknown) {
        request = JSON.parse(payload as string) as { scanType: string; callbackId: string }
      },
    }

    render(<BridgeLab />)
    fireEvent.click(document.querySelector('[data-capability-name="scanCode"]') as HTMLButtonElement)
    fireEvent.click(screen.getByRole('button', { name: '调用 scanCode' }))

    await waitFor(() => {
      expect(request).toBeDefined()
      const invocationLog = document.querySelector('[data-bridge-lab-logs]')?.textContent ?? ''
      expect(invocationLog).toContain('Native invoke')
      expect(invocationLog).toContain('androidBridge')
      expect(invocationLog).toContain('scanCode')
    })

    const logs = document.querySelector('[data-bridge-lab-logs]') as HTMLElement
    expect(logs.textContent).toContain(request!.callbackId)
    expect(logs.textContent).toContain('"scanType": "all"')
    expect(logs.textContent).toContain('window.nativeBridgeCallback')
    expect(logs.textContent).toContain('window.androidBridgeCallback')

    labWindow.androidBridgeCallback?.(request!.callbackId, {
      code: 0,
      message: 'ok',
      data: { text: 'buddy-qr-private-value', scanType: 'qr' },
    })

    await waitFor(() => expect(logs.textContent).toContain('intermediate'))
    expect(logs.textContent).toContain('"text": "[REDACTED]"')
    expect(logs.textContent).not.toContain('buddy-qr-private-value')

    labWindow.androidBridgeCallback?.(request!.callbackId, {
      code: 0,
      message: 'ok',
      data: { text: 'buddy-qr-private-value', scanType: 'qr' },
    })

    await waitFor(() => {
      expect(logs.textContent).toContain('terminal')
      expect(logs.textContent).toContain('callbackCount')
    })
    expect(logs.textContent).not.toContain('buddy-qr-private-value')
  })

  it('can invoke a registered H032 capability with editable JSON input', async () => {
    usePlatform('android')
    labWindow.androidBridge = {
      copyText(payload: unknown) {
        const request = JSON.parse(payload as string) as {
          text: string
          callbackId: string
        }
        expect(request).toMatchObject({
          text: 'hello',
          callbackId: expect.any(String),
        })
        queueMicrotask(() => {
          labWindow.nativeBridgeCallback?.(request.callbackId, {
            code: 0,
            message: 'ok',
            data: {},
          })
        })
      },
    }

    render(<BridgeLab />)

    fireEvent.click(
      document.querySelector('[data-capability-name="copyText"]') as HTMLButtonElement,
    )
    fireEvent.change(screen.getByLabelText('input JSON'), {
      target: { value: '{"text":"hello"}' },
    })
    fireEvent.click(screen.getByRole('button', { name: '调用 copyText' }))

    await waitFor(() => {
      expect(screen.getByText(/"success": true/)).toBeTruthy()
    })
  })

  it('preloads showRewardAd input and invokes Android with a callback id', async () => {
    usePlatform('android')
    labWindow.androidBridge = {
      showRewardAd(payload: unknown) {
        expect(typeof payload).toBe('string')
        const request = JSON.parse(payload as string) as {
          scene: string
          callbackId: string
        }
        expect(request).toMatchObject({
          scene: 'h5CheckinResign',
          callbackId: expect.any(String),
        })
        queueMicrotask(() => {
          labWindow.androidBridgeCallback?.(request.callbackId, {
            code: 0,
            message: 'ok',
            data: { scene: 'h5CheckinResign', status: 'completed' },
          })
        })
      },
    }

    render(<BridgeLab />)

    fireEvent.click(
      document.querySelector('[data-capability-name="showRewardAd"]') as HTMLButtonElement,
    )
    expect((screen.getByLabelText('input JSON') as HTMLTextAreaElement).value).toBe(
      '{"scene":"h5CheckinResign"}',
    )
    fireEvent.click(screen.getByRole('button', { name: '调用 showRewardAd' }))

    await waitFor(() => {
      expect(screen.getByText(/"status": "completed"/)).toBeTruthy()
    })
  })

  it('can invoke registered openApp with an explicit action payload', async () => {
    usePlatform('android')
    labWindow.androidBridge = {
      openApp(payload: unknown) {
        const request = JSON.parse(payload as string) as {
          action: string
          inviteCode: string
          fallbackUrl: string
          callbackId: string
        }
        expect(request).toMatchObject({
          action: 'detect',
          inviteCode: '',
          fallbackUrl: '',
          callbackId: expect.any(String),
        })
        queueMicrotask(() => {
          labWindow.nativeBridgeCallback?.(request.callbackId, {
            code: 0,
            message: 'ok',
            data: { installed: false },
          })
        })
      },
    }

    render(<BridgeLab />)

    fireEvent.click(
      document.querySelector('[data-capability-name="openApp"]') as HTMLButtonElement,
    )
    fireEvent.change(screen.getByLabelText('input JSON'), {
      target: {
        value: '{"action":"detect","inviteCode":"","fallbackUrl":""}',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: '调用 openApp' }))

    await waitFor(() => {
      expect(screen.getByText(/"installed": false/)).toBeTruthy()
    })
  })

  it('shows neither Native Raw Probe when osType is not selected', () => {
    usePlatform()
    render(<BridgeLab />)

    expect(document.querySelector('[data-android-raw-probe]')).toBeNull()
    expect(document.querySelector('[data-ios-raw-probe]')).toBeNull()
    expect(document.querySelector('[data-web-platform-hint]')).not.toBeNull()
  })

  it('restores the legacy Native-to-H5 testFunc endpoint on Native lab modes', async () => {
    usePlatform('android')
    render(<BridgeLab />)

    expect(document.querySelector('[data-h5-callback-endpoints]')).not.toBeNull()
    expect(document.querySelector('[data-callback-endpoint="nativeBridgeCallback"]')).not.toBeNull()
    expect(document.querySelector('[data-callback-endpoint="androidBridgeCallback"]')).not.toBeNull()
    expect(screen.queryByText(/iosBridgeCallback/)).toBeNull()
    expect(typeof labWindow.testFunc).toBe('function')
    expect(labWindow.testFunc?.({ from: 'native', value: 1 })).toBe('h5 处理完成')

    await waitFor(() => {
      const logs = document.querySelector('[data-bridge-lab-logs]')
      expect(logs?.textContent).toContain('window.testFunc(params)')
      expect(logs?.textContent).toContain('"from": "native"')
    })
  })

  it('redacts a sensitive Android Raw Probe result until explicit reveal', async () => {
    usePlatform('android')
    labWindow.androidBridge = {
      getLoginToken() {
        return 'super-secret-token'
      },
    }

    render(<BridgeLab />)
    fireEvent.click(screen.getByRole('button', { name: 'Android preset getLoginToken' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run Android Probe' }))

    await waitFor(() => {
      expect(screen.getByText('[REDACTED]')).toBeTruthy()
    })
    expect(screen.queryByText('super-secret-token')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '显式显示原始结果' }))
    expect(screen.getByText('super-secret-token')).toBeTruthy()
  })

  it('shows browser/host absence as an explicit error instead of fake success', async () => {
    usePlatform('android')
    render(<BridgeLab />)
    fireEvent.change(screen.getByLabelText('Android method'), {
      target: { value: 'missingMethod' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Run Android Probe' }))

    await waitFor(() => {
      expect(screen.getByText(/window\.androidBridge is not available/i)).toBeTruthy()
    })
  })
})

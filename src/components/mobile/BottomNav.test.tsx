import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'

type ScanResult = {
  code: string
  scanType?: 'qr' | 'bar' | 'all'
  isDevice?: boolean
  consumeUse?: string
}

const bridgeMocks = vi.hoisted(() => ({
  scanCode: vi.fn<() => Promise<ScanResult>>(() => Promise.resolve({ code: 'SAMPLE' })),
  getNativeBridgeDiagnostics: vi.fn(),
  getNativeHost: vi.fn(() => 'android'),
}))

vi.mock('../../services/nativeBridge', () => {
  class NativeBridgeError extends Error {
    readonly name = 'NativeBridgeError'

    constructor(
      readonly code: string,
      readonly capability: string,
      message: string,
    ) {
      super(message)
    }
  }

  return { ...bridgeMocks, NativeBridgeError }
})

import BottomNav from './BottomNav'

const buddyQr = 'https://kbs.3cgroup.cn/buddy/invite/scan?code=550e8400-e29b-41d4-a716-446655440000'

function LocationProbe() {
  const location = useLocation()
  return (
    <output
      data-testid="current-route"
      data-path={location.pathname}
      data-state={JSON.stringify(location.state ?? null)}
    />
  )
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  bridgeMocks.scanCode.mockReset()
  bridgeMocks.getNativeBridgeDiagnostics.mockReset()
  bridgeMocks.getNativeHost.mockReset()
  bridgeMocks.getNativeHost.mockReturnValue('android')
})

function renderNav() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <BottomNav />
      <LocationProbe />
    </MemoryRouter>,
  )
}

function currentPath() {
  return screen.getByTestId('current-route').getAttribute('data-path')
}

describe('BottomNav middle scan item', () => {
  it('disables the scan button in a browser host with no scanCode capability', () => {
    bridgeMocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: false },
    })

    renderNav()

    const button = screen.getByRole('button', { name: '扫码' }) as HTMLButtonElement
    expect(button.disabled).toBe(true)

    fireEvent.click(button)
    expect(bridgeMocks.scanCode).not.toHaveBeenCalled()
  })

  it('routes only a trusted Android buddy QR into the existing invitation preview', async () => {
    vi.stubEnv('VITE_BUDDY_PUBLIC_ORIGIN', 'https://kbs.3cgroup.cn')
    bridgeMocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: true },
    })
    bridgeMocks.scanCode.mockResolvedValueOnce({
      code: buddyQr,
      scanType: 'qr',
      isDevice: false,
    })

    renderNav()
    fireEvent.click(screen.getByRole('button', { name: '扫码' }))

    await waitFor(() => expect(currentPath()).toBe('/buddy/accept'))
    expect(JSON.parse(screen.getByTestId('current-route').getAttribute('data-state') ?? 'null'))
      .toEqual({
        buddyScan: {
          source: 'native-buddy-recognition',
          raw: buddyQr,
        },
      })
    expect(bridgeMocks.scanCode).toHaveBeenCalledWith({ scanType: 'qr' })
  })

  it('shows a visible unsupported-code message for unknown non-device QR data', async () => {
    vi.stubEnv('VITE_BUDDY_PUBLIC_ORIGIN', 'https://kbs.3cgroup.cn')
    bridgeMocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: true },
    })
    bridgeMocks.scanCode.mockResolvedValueOnce({
      code: 'https://untrusted.example/anything',
      scanType: 'qr',
      isDevice: false,
    })

    renderNav()
    fireEvent.click(screen.getByRole('button', { name: '扫码' }))

    expect(await screen.findByText('暂不支持此二维码')).toBeTruthy()
    expect(currentPath()).toBe('/')
  })

  it('leaves Native-owned device results untouched, including vending results without consumeUse', async () => {
    bridgeMocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: true },
    })
    renderNav()
    const button = screen.getByRole('button', { name: '扫码' })

    bridgeMocks.scanCode.mockResolvedValueOnce({
      code: 'DEVICE-QR-011',
      scanType: 'qr',
      consumeUse: '11',
    })
    fireEvent.click(button)
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
    expect(bridgeMocks.scanCode).toHaveBeenCalledTimes(1)
    expect(currentPath()).toBe('/')
    expect(screen.queryByText('暂不支持此二维码')).toBeNull()

    bridgeMocks.scanCode.mockResolvedValueOnce({
      code: 'DEVICE-QR-017',
      scanType: 'qr',
    })
    fireEvent.click(button)
    await waitFor(() => expect(bridgeMocks.scanCode).toHaveBeenCalledTimes(2))
    expect(currentPath()).toBe('/')
    expect(screen.queryByText('暂不支持此二维码')).toBeNull()
  })

  it('does not infer a new iOS scan-dispatch contract from a legacy raw result', async () => {
    bridgeMocks.getNativeHost.mockReturnValue('ios')
    bridgeMocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: true },
    })
    bridgeMocks.scanCode.mockResolvedValueOnce({
      code: buddyQr,
      isDevice: false,
    })

    renderNav()
    fireEvent.click(screen.getByRole('button', { name: '扫码' }))

    expect(await screen.findByText('当前 App 尚未提供可验证的扫码分流能力')).toBeTruthy()
    expect(currentPath()).toBe('/')
  })

  it('returns quietly on cancellation', async () => {
    bridgeMocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: true },
    })
    const { NativeBridgeError } = await import('../../services/nativeBridge')
    bridgeMocks.scanCode.mockRejectedValueOnce(
      new NativeBridgeError('native-cancelled', 'scanCode', 'cancelled'),
    )

    renderNav()
    fireEvent.click(screen.getByRole('button', { name: '扫码' }))

    await waitFor(() => expect(bridgeMocks.scanCode).toHaveBeenCalledTimes(1))
    expect(currentPath()).toBe('/')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows recoverable feedback when camera permission is denied', async () => {
    bridgeMocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: true },
    })
    const { NativeBridgeError } = await import('../../services/nativeBridge')
    bridgeMocks.scanCode.mockRejectedValueOnce(
      new NativeBridgeError('native-permission-denied', 'scanCode', 'permission denied'),
    )

    renderNav()
    fireEvent.click(screen.getByRole('button', { name: '扫码' }))

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('请允许相机权限后重试')
    expect(currentPath()).toBe('/')
  })

  it('prevents duplicate Native scan invocations while the first scan is pending', async () => {
    bridgeMocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: true },
    })
    let resolveScan: ((value: { code: string; isDevice: false }) => void) | undefined
    bridgeMocks.scanCode.mockReturnValueOnce(new Promise(resolve => {
      resolveScan = resolve
    }))

    renderNav()
    const button = screen.getByRole('button', { name: '扫码' })
    fireEvent.click(button)
    fireEvent.click(button)

    expect(bridgeMocks.scanCode).toHaveBeenCalledTimes(1)
    resolveScan?.({ code: 'unknown-code', isDevice: false })
    expect(await screen.findByText('暂不支持此二维码')).toBeTruthy()
  })

  it('stops background bridge polling after the late-injection discovery window', () => {
    vi.useFakeTimers()
    bridgeMocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: false },
    })

    const { unmount } = renderNav()

    act(() => {
      vi.advanceTimersByTime(10_500)
    })
    const callsAfterDiscoveryWindow = bridgeMocks.getNativeBridgeDiagnostics.mock.calls.length

    act(() => {
      vi.advanceTimersByTime(5_000)
    })

    expect(bridgeMocks.getNativeBridgeDiagnostics.mock.calls.length).toBe(callsAfterDiscoveryWindow)
    unmount()
  })
})

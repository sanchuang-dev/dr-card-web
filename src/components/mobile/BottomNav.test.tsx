import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'

const bridgeMocks = vi.hoisted(() => {
  class MockNativeBridgeError extends Error {
    constructor(readonly code: string) {
      super(code)
    }
  }

  return {
    NativeBridgeError: MockNativeBridgeError,
    scanCode: vi.fn(() => Promise.resolve({ code: 'SAMPLE' })),
    getNativeBridgeDiagnostics: vi.fn(),
    getNativeHost: vi.fn(() => 'android'),
  }
})

vi.mock('../../services/nativeBridge', () => bridgeMocks)

import BottomNav from './BottomNav'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{JSON.stringify({
    pathname: location.pathname,
    state: location.state,
  })}</output>
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  bridgeMocks.scanCode.mockReset()
  bridgeMocks.scanCode.mockResolvedValue({ code: 'SAMPLE' })
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

  it('calls the shared QR-only scanCode capability when the native host supports it', async () => {
    bridgeMocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: true },
    })

    renderNav()

    const button = screen.getByRole('button', { name: '扫码' }) as HTMLButtonElement
    expect(button.disabled).toBe(false)

    fireEvent.click(button)

    await waitFor(() => {
      expect(bridgeMocks.scanCode).toHaveBeenCalledWith({ scanType: 'qr' })
    })
  })

  it('routes a recognized non-device buddy QR into the existing BuddyAccept state contract', async () => {
    const raw = 'https://kbs.3cgroup.cn/buddy/invite/scan?code=550e8400-e29b-41d4-a716-446655440000'
    vi.stubEnv('VITE_BUDDY_PUBLIC_ORIGIN', 'https://kbs.3cgroup.cn')
    bridgeMocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: true },
    })
    bridgeMocks.scanCode.mockResolvedValueOnce({
      code: raw,
      scanType: 'qr',
      isDevice: false,
    } as { code: string })

    renderNav()
    fireEvent.click(screen.getByRole('button', { name: '扫码' }))

    await waitFor(() => {
      const location = JSON.parse(screen.getByTestId('location').textContent ?? '{}')
      expect(location.pathname).toBe('/buddy/accept')
      expect(location.state).toEqual({
        buddyScan: { source: 'native-buddy-recognition', raw },
      })
    })
  })

  it('rejects an unknown non-device QR without entering device verification', async () => {
    bridgeMocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: true },
    })
    bridgeMocks.scanCode.mockResolvedValueOnce({
      code: 'https://example.com/not-a-buddy-qr',
      scanType: 'qr',
      isDevice: false,
    } as { code: string })

    renderNav()
    fireEvent.click(screen.getByRole('button', { name: '扫码' }))

    expect(await screen.findByText('暂不支持此二维码，请扫描设备码或洗头搭子邀请二维码')).toBeTruthy()
    expect(JSON.parse(screen.getByTestId('location').textContent ?? '{}').pathname).toBe('/')
  })

  it('routes a completed device transaction to the existing Native result state', async () => {
    bridgeMocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: true },
    })
    bridgeMocks.scanCode.mockResolvedValueOnce({
      code: 'DEVICE-QR-001',
      isDevice: true,
    } as { code: string })

    renderNav()
    fireEvent.click(screen.getByRole('button', { name: '扫码' }))

    await waitFor(() => {
      const location = JSON.parse(screen.getByTestId('location').textContent ?? '{}')
      expect(location.pathname).toBe('/card/verify/confirm')
      expect(location.state).toEqual({
        nativeScanCode: 'DEVICE-QR-001',
        nativeVerifyResult: 'done',
      })
    })
  })

  it('shows cancellation feedback instead of silently swallowing Native errors', async () => {
    bridgeMocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: true },
    })
    bridgeMocks.scanCode.mockRejectedValueOnce(new bridgeMocks.NativeBridgeError('native-cancelled'))

    renderNav()
    fireEvent.click(screen.getByRole('button', { name: '扫码' }))

    expect(await screen.findByText('已取消扫码')).toBeTruthy()
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

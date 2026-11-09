import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  scanCode: vi.fn(),
  getNativeBridgeDiagnostics: vi.fn(),
  getNativeHost: vi.fn(),
  closeWebView: vi.fn(() => Promise.resolve()),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  }
})

vi.mock('../services/nativeBridge', () => {
  class NativeBridgeError extends Error {
    constructor(readonly code: string) {
      super(code)
    }
  }

  return {
    NativeBridgeError,
    scanCode: mocks.scanCode,
    getNativeBridgeDiagnostics: mocks.getNativeBridgeDiagnostics,
    getNativeHost: mocks.getNativeHost,
    closeWebView: mocks.closeWebView,
  }
})

import ScanVerify from './ScanVerify'

afterEach(() => {
  mocks.navigate.mockReset()
  mocks.scanCode.mockReset()
  mocks.getNativeBridgeDiagnostics.mockReset()
  mocks.getNativeHost.mockReset()
  mocks.getNativeHost.mockReturnValue('browser')
  mocks.closeWebView.mockClear()
  vi.unstubAllEnvs()
})

describe('ScanVerify', () => {
  it('shows explicit unsupported state instead of simulated scan success', () => {
    mocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: {
        scanCode: false,
        closeWebView: false,
      },
    })

    render(<ScanVerify />)

    const button = screen.getByRole('button', {
      name: '当前 App 版本暂不支持扫码',
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.dataset.nativeScanSupported).toBe('false')
    expect(screen.getByText('当前 App 版本暂不支持扫码')).toBeTruthy()
    expect(mocks.scanCode).not.toHaveBeenCalled()
  })

  it('refreshes scan support after late bridge injection', async () => {
    mocks.getNativeBridgeDiagnostics
      .mockReturnValueOnce({
        capabilities: {
          scanCode: false,
          closeWebView: false,
        },
      })
      .mockReturnValue({
        capabilities: {
          scanCode: true,
          closeWebView: false,
        },
      })

    render(<ScanVerify />)

    expect(
      (screen.getByRole('button', {
        name: '当前 App 版本暂不支持扫码',
      }) as HTMLButtonElement).disabled,
    ).toBe(true)

    fireEvent(window, new Event('focus'))

    await waitFor(() => {
      expect(
        (screen.getByRole('button', { name: '开始扫码核销' }) as HTMLButtonElement).disabled,
      ).toBe(false)
    })
  })

  it('waits for the confirmed Android transaction and resumes directly at the completed result state', async () => {
    mocks.getNativeHost.mockReturnValue('android')
    mocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: {
        scanCode: true,
        closeWebView: false,
      },
    })
    mocks.scanCode.mockResolvedValue({ code: 'REAL-SCAN-CODE' })

    render(<ScanVerify />)

    fireEvent.click(screen.getByRole('button', { name: '开始扫码核销' }))

    await waitFor(() => {
      expect(mocks.scanCode).toHaveBeenCalledWith({ scanType: 'qr' })
    })
    expect(mocks.navigate).toHaveBeenCalledWith('/card/verify/confirm', {
      replace: true,
      state: {
        nativeScanCode: 'REAL-SCAN-CODE',
        nativeVerifyResult: 'done',
      },
    })
  })

  it('keeps iOS on the existing confirmation flow until terminal transaction semantics are confirmed', async () => {
    mocks.getNativeHost.mockReturnValue('ios')
    mocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: {
        scanCode: true,
        closeWebView: false,
      },
    })
    mocks.scanCode.mockResolvedValue({ code: 'IOS-SCAN-CODE' })

    render(<ScanVerify />)
    fireEvent.click(screen.getByRole('button', { name: '开始扫码核销' }))

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/card/verify/confirm', {
        state: { nativeScanCode: 'IOS-SCAN-CODE' },
      })
    })
    expect(mocks.scanCode).toHaveBeenCalledWith({ scanType: 'qr' })
    expect(mocks.navigate).not.toHaveBeenCalledWith(
      '/card/verify/confirm',
      expect.objectContaining({
        state: expect.objectContaining({ nativeVerifyResult: 'done' }),
      }),
    )
  })

  it('routes a recognized non-device buddy QR to the existing BuddyAccept page', async () => {
    const raw = 'https://kbs.3cgroup.cn/buddy/invite/scan?code=550e8400-e29b-41d4-a716-446655440000'
    vi.stubEnv('VITE_BUDDY_PUBLIC_ORIGIN', 'https://kbs.3cgroup.cn')
    mocks.getNativeHost.mockReturnValue('android')
    mocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: true, closeWebView: false },
    })
    mocks.scanCode.mockResolvedValue({ code: raw, scanType: 'qr', isDevice: false })

    render(<ScanVerify />)
    fireEvent.click(screen.getByRole('button', { name: '开始扫码核销' }))

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/buddy/accept', {
        replace: true,
        state: { buddyScan: { source: 'native-buddy-recognition', raw } },
      })
    })
  })

  it('rejects an unknown non-device QR without entering device verification', async () => {
    mocks.getNativeHost.mockReturnValue('android')
    mocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: true, closeWebView: false },
    })
    mocks.scanCode.mockResolvedValue({
      code: 'https://example.com/unknown',
      scanType: 'qr',
      isDevice: false,
    })

    render(<ScanVerify />)
    fireEvent.click(screen.getByRole('button', { name: '开始扫码核销' }))

    await waitFor(() => {
      expect(screen.getByText('暂不支持此二维码，请扫描设备码或洗头搭子邀请二维码')).toBeTruthy()
    })
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('keeps an unknown Native failure on the scan page', async () => {
    mocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: {
        scanCode: true,
        closeWebView: false,
      },
    })
    mocks.scanCode.mockRejectedValue(new Error('native failed'))

    render(<ScanVerify />)

    fireEvent.click(screen.getByRole('button', { name: '开始扫码核销' }))

    await waitFor(() => {
      expect(screen.getByText('扫码失败，请重试')).toBeTruthy()
    })
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it.each([
    ['native-cancelled', '已取消扫码'],
    ['native-permission-denied', '请允许相机权限后重试'],
  ] as const)('shows confirmed %s semantics without navigating', async (code, message) => {
    mocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: {
        scanCode: true,
        closeWebView: false,
      },
    })
    const { NativeBridgeError } = await import('../services/nativeBridge')
    mocks.scanCode.mockRejectedValue(
      new NativeBridgeError(code, 'scanCode', 'confirmed Native failure'),
    )

    render(<ScanVerify />)
    fireEvent.click(screen.getByRole('button', { name: '开始扫码核销' }))

    await waitFor(() => {
      expect(screen.getByText(message)).toBeTruthy()
    })
    expect(mocks.navigate).not.toHaveBeenCalled()
  })
})

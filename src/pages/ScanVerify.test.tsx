import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  scanCode: vi.fn(),
  getNativeBridgeDiagnostics: vi.fn(),
  closeWebView: vi.fn(() => Promise.resolve()),
}))

vi.mock('../services/nativeBridge', () => {
  class NativeBridgeError extends Error {
    readonly name = 'NativeBridgeError'

    constructor(readonly code: string, readonly capability: string, message: string) {
      super(message)
    }
  }

  return {
    NativeBridgeError,
    scanCode: mocks.scanCode,
    getNativeBridgeDiagnostics: mocks.getNativeBridgeDiagnostics,
    closeWebView: mocks.closeWebView,
  }
})

import ScanVerify from './ScanVerify'

afterEach(() => {
  mocks.scanCode.mockReset()
  mocks.getNativeBridgeDiagnostics.mockReset()
  mocks.closeWebView.mockClear()
})

describe('ScanVerify card-voucher boundary', () => {
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

  it('does not send a Native-owned device result into the card-voucher confirmation page', async () => {
    mocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: true, closeWebView: false },
    })
    mocks.scanCode.mockResolvedValue({
      code: 'DEVICE-QR-011',
      scanType: 'qr',
      consumeUse: '11',
    })

    render(<ScanVerify />)
    fireEvent.click(screen.getByRole('button', { name: '开始扫码核销' }))

    await waitFor(() => {
      expect(screen.getByText('已识别设备二维码，请按 App 设备页面提示操作')).toBeTruthy()
    })
    expect(mocks.scanCode).toHaveBeenCalledWith({ scanType: 'qr' })
  })

  it('does not require consumeUse to avoid misclassifying the Native vending use-17 callback', async () => {
    mocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: true, closeWebView: false },
    })
    mocks.scanCode.mockResolvedValue({
      code: 'DEVICE-QR-017',
      scanType: 'qr',
    })

    render(<ScanVerify />)
    fireEvent.click(screen.getByRole('button', { name: '开始扫码核销' }))

    await waitFor(() => {
      expect(screen.getByText('当前扫码结果无法验证为卡券核销码，未发起核销')).toBeTruthy()
    })
  })

  it('does not treat every non-device QR as a card voucher', async () => {
    mocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: true, closeWebView: false },
    })
    mocks.scanCode.mockResolvedValue({
      code: 'UNKNOWN-NON-DEVICE-QR',
      scanType: 'qr',
      isDevice: false,
    })

    render(<ScanVerify />)
    fireEvent.click(screen.getByRole('button', { name: '开始扫码核销' }))

    await waitFor(() => {
      expect(screen.getByText('暂不支持此卡券核销码，未发起核销')).toBeTruthy()
    })
  })

  it('does not infer a card-voucher result from a legacy raw iOS payload', async () => {
    mocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: true, closeWebView: false },
    })
    mocks.scanCode.mockResolvedValue({ code: 'IOS-RAW-QR' })

    render(<ScanVerify />)
    fireEvent.click(screen.getByRole('button', { name: '开始扫码核销' }))

    await waitFor(() => {
      expect(screen.getByText('当前扫码结果无法验证为卡券核销码，未发起核销')).toBeTruthy()
    })
  })

  it('shows a recoverable failure instead of leaving the scan page busy', async () => {
    mocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: true, closeWebView: false },
    })
    mocks.scanCode.mockRejectedValue(new Error('native failed'))

    render(<ScanVerify />)
    fireEvent.click(screen.getByRole('button', { name: '开始扫码核销' }))

    await waitFor(() => {
      expect(screen.getByText('扫码失败，请重试')).toBeTruthy()
    })
    expect((screen.getByRole('button', { name: '开始扫码核销' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('returns quietly when the user cancels the card scan', async () => {
    mocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: true, closeWebView: false },
    })
    const { NativeBridgeError } = await import('../services/nativeBridge')
    mocks.scanCode.mockRejectedValue(
      new NativeBridgeError('native-cancelled', 'scanCode', 'cancelled'),
    )

    render(<ScanVerify />)
    fireEvent.click(screen.getByRole('button', { name: '开始扫码核销' }))

    await waitFor(() => expect(mocks.scanCode).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('已取消扫码')).toBeNull()
    expect(screen.getByText('将卡券二维码对准扫描框，点击开始扫码')).toBeTruthy()
  })

  it('shows a recoverable message when camera permission is denied', async () => {
    mocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: true, closeWebView: false },
    })
    const { NativeBridgeError } = await import('../services/nativeBridge')
    mocks.scanCode.mockRejectedValue(
      new NativeBridgeError('native-permission-denied', 'scanCode', 'permission denied'),
    )

    render(<ScanVerify />)
    fireEvent.click(screen.getByRole('button', { name: '开始扫码核销' }))

    await waitFor(() => {
      expect(screen.getByText('请允许相机权限后重试')).toBeTruthy()
    })
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const bridgeMocks = vi.hoisted(() => ({
  scanCode: vi.fn(() => Promise.resolve({ code: 'SAMPLE' })),
  getNativeBridgeDiagnostics: vi.fn(),
}))

vi.mock('../../services/nativeBridge', () => bridgeMocks)

import BottomNav from './BottomNav'

afterEach(() => {
  vi.useRealTimers()
  bridgeMocks.scanCode.mockClear()
  bridgeMocks.getNativeBridgeDiagnostics.mockReset()
})

function renderNav() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <BottomNav />
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

  it('calls the shared scanCode capability when the native host supports it', async () => {
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

  it('silently swallows scan cancellation without leaving the current page', async () => {
    bridgeMocks.getNativeBridgeDiagnostics.mockReturnValue({
      capabilities: { scanCode: true },
    })
    bridgeMocks.scanCode.mockRejectedValueOnce(new Error('cancelled'))

    renderNav()

    fireEvent.click(screen.getByRole('button', { name: '扫码' }))

    await waitFor(() => {
      expect(bridgeMocks.scanCode).toHaveBeenCalledTimes(1)
    })
  })
})

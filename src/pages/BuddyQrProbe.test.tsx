import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import BuddyQrProbe from './BuddyQrProbe'

const qr = 'https://kbs.3cgroup.cn/buddy/invite/scan?code=550e8400-e29b-41d4-a716-446655440000'

function ReceiveState() {
  const location = useLocation()
  const scan = (location.state as { buddyScan?: { source: string; raw: string } } | null)?.buddyScan
  return <div data-testid="route-scan">{scan?.source} / {scan?.raw}</div>
}

function mount() {
  return render(
    <MemoryRouter initialEntries={['/__debug/buddy-qr']}>
      <Routes>
        <Route path="/__debug/buddy-qr" element={<BuddyQrProbe />} />
        <Route path="/buddy/accept" element={<ReceiveState />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => vi.unstubAllEnvs())

describe('#107 H5-only QR acceptance rehearsal entry', () => {
  it('transfers a validated QR only via internal route state, never public query parameters', async () => {
    vi.stubEnv('VITE_BUDDY_PUBLIC_ORIGIN', 'https://kbs.3cgroup.cn')
    mount()
    fireEvent.change(screen.getByLabelText('扫码结果 URL'), { target: { value: qr } })
    fireEvent.click(screen.getByRole('button', { name: '查询并打开邀请确认页' }))
    await waitFor(() => {
      expect(screen.getByTestId('route-scan').textContent).toContain('native-buddy-recognition')
      expect(screen.getByTestId('route-scan').textContent).toContain(qr)
    })
  })

  it('rejects external hosts and cannot navigate without a trusted origin', () => {
    vi.stubEnv('VITE_BUDDY_PUBLIC_ORIGIN', 'https://kbs.3cgroup.cn')
    mount()
    fireEvent.change(screen.getByLabelText('扫码结果 URL'), {
      target: { value: qr.replace('kbs.3cgroup.cn', 'untrusted.example') },
    })
    fireEvent.click(screen.getByRole('button', { name: '查询并打开邀请确认页' }))
    expect(screen.getByRole('alert').textContent).toContain('不是有效的洗头搭子二维码')
    expect(screen.queryByTestId('route-scan')).toBeNull()
  })
})

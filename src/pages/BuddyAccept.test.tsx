import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  mode: 'mock',
  preview: vi.fn(),
  accept: vi.fn(),
  navigate: vi.fn(),
  patch: vi.fn(),
  get: vi.fn((): string | null => null),
}))

vi.mock('../app/config/runtime', () => ({ runtimePolicy: { get dataMode() { return mocks.mode } } }))
vi.mock('../app/fixtures/useFixture', () => ({
  useFixtureDebug: () => false,
  useFixtureNavigate: () => mocks.navigate,
  useFixtureQueryControls: () => ({ get: mocks.get, patch: mocks.patch }),
}))
vi.mock('../services/buddyRelations', async () => {
  const actual = await vi.importActual<typeof import('../services/buddyRelations')>('../services/buddyRelations')
  return { ...actual, previewBuddyQr: mocks.preview, acceptBuddyQr: mocks.accept }
})
vi.mock('./Home', () => ({ default: () => <div data-testid="current-home-background" /> }))

import BuddyAccept from './BuddyAccept'

const inviter = { id: 'demo-inviter', nickname: '后台邀请人', avatarUrl: null }
afterEach(() => {
  mocks.mode = 'mock'
  mocks.preview.mockReset()
  mocks.accept.mockReset()
  mocks.navigate.mockReset()
  mocks.patch.mockReset()
  mocks.get.mockReset()
  mocks.get.mockReturnValue(null)
})
function mount(scan?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{
      pathname: '/buddy/accept',
      state: scan === undefined ? null : { buddyScan: scan },
    }]}>
      <BuddyAccept />
    </MemoryRouter>,
  )
}

describe('H5 scan invite confirmation', () => {
  it('shows the server preview before allowing confirmation; cancel cannot bind', async () => {
    mocks.preview.mockResolvedValue({ inviter, relationship: 'available', demo: false })
    mount({ source: 'native-buddy-recognition', raw: 'https://example.com/buddy/invite/scan?token=opaque-identifier-12345678' })
    await waitFor(() => expect(screen.getByText(/后台邀请人邀请你成为洗头搭子/)).toBeTruthy())
    expect(screen.getByText(/当前版本暂不支持解除关系/)).toBeTruthy()
    expect(screen.getByTestId('current-home-background')).toBeTruthy()
    expect(mocks.accept).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(mocks.navigate).toHaveBeenCalledWith('/', { debug: null }, { replace: true })
    expect(mocks.accept).not.toHaveBeenCalled()
  })

  it('does not write a real relationship for a demo-only QR', async () => {
    mocks.preview.mockResolvedValue({ inviter, relationship: 'available', demo: true })
    mocks.accept.mockResolvedValue({ result: 'demo-only', demo: true })
    mount()
    await waitFor(() => expect(screen.getByRole('button', { name: /演示添加/ })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /演示添加/ }))
    await waitFor(() => expect(screen.getByText(/不会创建或保存真实搭子关系/)).toBeTruthy())
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('blocks self but never suppresses add on an already-related preview status', async () => {
    mocks.preview.mockResolvedValue({ inviter, relationship: 'self', demo: false })
    const { unmount } = mount()
    await waitFor(() => expect(screen.getByText('不能邀请自己')).toBeTruthy())
    expect(screen.queryByRole('button', { name: '添加好友' })).toBeNull()
    unmount()
    mocks.preview.mockResolvedValue({ inviter, relationship: 'already-buddies', demo: false })
    mount()
    await waitFor(() => expect(screen.getByText(/后台邀请人邀请你成为洗头搭子/)).toBeTruthy())
    expect(screen.getByRole('button', { name: '添加好友' })).toBeTruthy()
    expect(mocks.accept).not.toHaveBeenCalled()
  })

  it('shows the real inviter but disables unsupported QR relationship creation', async () => {
    mocks.mode = 'api'
    mocks.preview.mockResolvedValue({
      inviter: { id: '9', nickname: '真实邀请人', avatarUrl: null },
      relationship: 'available',
      demo: false,
      confirmationAvailable: false,
    })
    mount({ source: 'native-buddy-recognition', raw: 'https://kbs.3cgroup.cn/buddy/invite/scan?code=550e8400-e29b-41d4-a716-446655440000' })
    await waitFor(() => expect(screen.getByText(/真实邀请人邀请你成为洗头搭子/)).toBeTruthy())
    expect(screen.getByText(/后台暂未开放二维码添加好友接口/)).toBeTruthy()
    expect((screen.getByRole('button', { name: '添加好友' }) as HTMLButtonElement).disabled).toBe(true)
    expect(mocks.accept).not.toHaveBeenCalled()
  })

  it('does not expose a fake acceptance in API mode without a native recognition result', async () => {
    mocks.mode = 'api'
    mount()
    await waitFor(() => expect(screen.getByText('等待诗得丽扫码结果')).toBeTruthy())
    expect(mocks.preview).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '添加好友' })).toBeNull()
  })

  it('retains failed preview and retries without writing a relation', async () => {
    mocks.preview.mockRejectedValueOnce(new Error('网络异常，请稍后重试'))
      .mockResolvedValueOnce({ inviter, relationship: 'available', demo: true })
    mount()
    await waitFor(() => expect(screen.getByText('网络异常，请稍后重试')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: '重新查询' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /演示添加/ })).toBeTruthy())
    expect(mocks.accept).not.toHaveBeenCalled()
  })
})

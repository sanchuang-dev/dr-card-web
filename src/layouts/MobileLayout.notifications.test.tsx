import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import type { ReactNode } from 'react'

const mocks = vi.hoisted(() => ({
  refresh: vi.fn().mockResolvedValue(undefined),
  setAuthFlowEnabled: vi.fn(),
  unreadCount: 6,
  countLoaded: true,
}))

vi.mock('../app/state/notifications', () => ({
  useNotifications: () => ({ unreadCount: mocks.unreadCount, countLoaded: mocks.countLoaded }),
  refreshRemoteUnreadCount: mocks.refresh,
}))
vi.mock('../components/mobile/TitleBar', () => ({
  default: ({ action }: { action: ReactNode }) => <header>{action}</header>,
}))
vi.mock('../components/mobile/BottomNav', () => ({ default: () => null }))
vi.mock('../components/mobile/H5ScrollRestoration', () => ({ default: () => null }))
vi.mock('../app/fixtures/useFixture', () => ({
  protectedFixtureRedirect: () => null,
  useOverlay: () => ({ open: vi.fn() }),
}))
vi.mock('../services/auth/session', () => ({
  AUTH_EXPIRED_EVENT: 'test:expired',
  AUTH_FAILURE_EVENT: 'test:failed',
  setAuthFlowEnabled: mocks.setAuthFlowEnabled,
}))
vi.mock('../services/nativeBridge', () => ({ closeWebView: vi.fn() }))

import MobileLayout from './MobileLayout'

function showShell(initialPath: string) {
  const router = createMemoryRouter([
    {
      path: '/',
      element: <MobileLayout />,
      children: [
        { path: 'profile', element: <p>会员首页</p> },
        { path: 'points', element: <p>泡泡值</p> },
        { path: 'dearseed', element: <p>诗得丽</p> },
        { path: 'notifications', element: <p>消息列表</p> },
      ],
    },
  ], { initialEntries: [initialPath] })
  render(<RouterProvider router={router} />)
  return router
}

afterEach(() => {
  cleanup()
  mocks.refresh.mockClear()
  mocks.setAuthFlowEnabled.mockClear()
  mocks.unreadCount = 6
  mocks.countLoaded = true
})

describe('member-center unread badge lifecycle', () => {
  it('shows the shared notice count on the profile header and refreshes once on return to the tab', async () => {
    const router = showShell('/profile')
    expect(screen.getByRole('button', { name: '通知，6 条未读' }).textContent).toBe('6')
    // useNotifications already performs its initial request; do not double-query on mount.
    expect(mocks.refresh).not.toHaveBeenCalled()

    await act(async () => { await router.navigate('/dearseed') })
    expect(screen.getByRole('button', { name: '通知' }).textContent).toBe('')
    expect(mocks.refresh).not.toHaveBeenCalled()
    await act(async () => { await router.navigate('/points') })
    expect(mocks.refresh).not.toHaveBeenCalled()
    await act(async () => { await router.navigate('/profile') })
    expect(mocks.refresh).toHaveBeenCalledTimes(1)

    await act(async () => { await router.navigate('/notifications') })
    await act(async () => { await router.navigate('/profile') })
    expect(mocks.refresh).toHaveBeenCalledTimes(2)
  })
})

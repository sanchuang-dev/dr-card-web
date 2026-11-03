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
        { path: 'mall', element: <p>商城路由 Outlet 不应重复渲染</p> },
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


describe('mall iframe lifecycle', () => {
  it('does not mount the mall before first entry and reuses the iframe after leaving the tab', async () => {
    const router = showShell('/')
    expect(screen.queryByTitle('卡博士商城')).toBeNull()

    await act(async () => { await router.navigate('/mall') })
    const iframe = screen.getByTitle('卡博士商城')
    const mallShell = iframe.closest('[data-mall-shell]')
    expect(mallShell).not.toBeNull()
    expect(mallShell?.classList.contains('invisible')).toBe(false)

    await act(async () => { await router.navigate('/points') })
    expect(screen.getByTitle('卡博士商城')).toBe(iframe)
    expect(mallShell?.classList.contains('invisible')).toBe(true)
    expect(mallShell?.classList.contains('pointer-events-none')).toBe(true)

    await act(async () => { await router.navigate('/mall') })
    expect(screen.getByTitle('卡博士商城')).toBe(iframe)
    expect(mallShell?.classList.contains('invisible')).toBe(false)
  })

  it('mounts the mall immediately when /mall is the initial route', () => {
    showShell('/mall')
    expect(screen.getByTitle('卡博士商城')).toBeTruthy()
  })
})

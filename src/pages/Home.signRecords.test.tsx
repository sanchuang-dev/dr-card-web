import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

const mocks = vi.hoisted(() => ({
  useSignRecords: vi.fn(),
  navigate: vi.fn(),
  reloadSignStatus: vi.fn(),
  bridgeLabEnabled: true,
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...original,
    useNavigate: () => mocks.navigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  }
})
vi.mock('../app/config/runtime', async (importOriginal) => {
  const original = await importOriginal<typeof import('../app/config/runtime')>()
  return {
    ...original,
    runtimePolicy: {
      ...original.runtimePolicy,
      get bridgeLabEnabled() { return mocks.bridgeLabEnabled },
    },
  }
})
vi.mock('./checkin/useCheckinFeed', () => ({ useSignRecords: mocks.useSignRecords }))
vi.mock('./home/useHomeFeed', () => ({
  useHomeBanners: () => ({ state: 'success', data: [] }),
  useSignStatus: () => ({ state: 'loading', reload: mocks.reloadSignStatus }),
}))
vi.mock('../app/fixtures/useFixture', () => ({
  useFixtureState: () => null,
  useOverlay: () => ({ overlay: null, close: vi.fn() }),
}))
vi.mock('../app/router/routes', () => ({ findRouteByPathname: () => ({ path: '/' }) }))
vi.mock('../components/mobile/PageContainer', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
vi.mock('../components/mobile/BannerCarousel', () => ({ default: () => null }))
vi.mock('./checkin/components/CheckinBoard', () => ({
  default: () => <div data-testid="home-checkin-board" />,
}))
vi.mock('../components/mobile/CheckinMakeupSuccessOverlay', () => ({ default: () => null }))
vi.mock('../components/mobile/DebugPanel', () => ({ default: () => null }))

import Home from './Home'
import { MALL_SEARCH_TAB_ROUTE } from '../app/router/mallSearch'

afterEach(() => {
  cleanup()
  mocks.useSignRecords.mockReset()
  mocks.navigate.mockReset()
  mocks.reloadSignStatus.mockReset()
  mocks.bridgeLabEnabled = true
  vi.useRealTimers()
})

describe('Issue #89: home check-in scope', () => {
  it('requests this week rather than reusing the full-month record feed', () => {
    mocks.useSignRecords.mockReturnValue({ remote: { state: 'loading' }, reload: vi.fn() })
    render(<Home />)
    expect(screen.getByTestId('home-checkin-board')).toBeTruthy()
    expect(mocks.useSignRecords).toHaveBeenCalledWith('week')
  })
})

describe('Issue #220: cross-day refresh', () => {
  it('reloads week records on returning to the visible app after the local day changes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 11, 23, 30))
    const reload = vi.fn()
    mocks.useSignRecords.mockReturnValue({ remote: { state: 'success', data: [] }, reload })
    render(<Home />)

    vi.setSystemTime(new Date(2026, 9, 12, 8))
    fireEvent(document, new Event('visibilitychange'))
    expect(reload).toHaveBeenCalledTimes(1)
    expect(mocks.reloadSignStatus).toHaveBeenCalledTimes(1)
    fireEvent(document, new Event('visibilitychange'))
    expect(reload).toHaveBeenCalledTimes(1)
    expect(mocks.reloadSignStatus).toHaveBeenCalledTimes(1)
  })
})

describe('Issue #304: home search and production debug entry', () => {
  it('switches the Mall tab when the entire search box is tapped', () => {
    mocks.useSignRecords.mockReturnValue({ remote: { state: 'loading' }, reload: vi.fn() })
    render(<Home />)
    const search = screen.getByRole('button', { name: '搜索商品' })
    expect(search.textContent).toContain('搜索你想要的商品')
    expect(search.querySelector('svg')).toBeTruthy()
    fireEvent.click(search)
    expect(mocks.navigate).toHaveBeenCalledWith(MALL_SEARCH_TAB_ROUTE)
  })

  it('hides the temporary left-side Bridge Lab entry in prod without hiding search', () => {
    mocks.bridgeLabEnabled = false
    mocks.useSignRecords.mockReturnValue({ remote: { state: 'loading' }, reload: vi.fn() })
    render(<Home />)
    expect(screen.queryByRole('button', { name: '打开 Bridge Lab（临时调试入口）' })).toBeNull()
    expect(screen.getByRole('button', { name: '搜索商品' }).querySelector('svg')).toBeTruthy()
  })

  it('preserves the debug shortcut in nonproduction builds', () => {
    mocks.useSignRecords.mockReturnValue({ remote: { state: 'loading' }, reload: vi.fn() })
    render(<Home />)
    fireEvent.click(screen.getByRole('button', { name: '打开 Bridge Lab（临时调试入口）' }))
    expect(mocks.navigate).toHaveBeenCalledWith('/__debug/bridge-lab?osType=Android')
  })
})

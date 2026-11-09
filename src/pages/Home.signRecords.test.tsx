import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'

const mocks = vi.hoisted(() => ({ useSignRecords: vi.fn(), navigate: vi.fn(), reloadSignStatus: vi.fn() }))

vi.mock('react-router-dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...original,
    useNavigate: () => mocks.navigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
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

afterEach(() => {
  cleanup()
  mocks.useSignRecords.mockReset()
  mocks.navigate.mockReset()
  mocks.reloadSignStatus.mockReset()
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

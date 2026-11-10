import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

const mocks = vi.hoisted(() => ({
  redeem: vi.fn(),
  useExchangeCoupons: vi.fn(),
  reloadCoupons: vi.fn(),
  reloadPoints: vi.fn(),
  categoryRemote: { state: 'success', data: [
    { key: '2', label: '洗发体验' }, { key: '3', label: '护发体验' },
  ] } as { state: string; data?: Array<{ key: string; label: string }>; message?: string },
  categoryReload: vi.fn(),
  mode: 'mock' as 'mock' | 'api',
  pointsRemote: { state: 'success', data: { points: 500, income: 0, expense: 0 } } as
    | { state: 'success'; data: { points: number; income: number; expense: number } }
    | { state: 'loading' }
    | { state: 'error'; message: string },
}))

vi.mock('../app/config/runtime', () => ({
  runtimePolicy: { get dataMode() { return mocks.mode } },
}))
vi.mock('../services/exchange', () => ({
  redeemExchangeProduct: mocks.redeem,
}))
vi.mock('./exchange/useExchangeFeed', () => ({
  useExchangeCoupons: mocks.useExchangeCoupons,
  useExchangeCategories: () => ({ remote: mocks.categoryRemote, reload: mocks.categoryReload }),
}))
vi.mock('./exchange/useCouponProjects', () => ({
  useCouponProjects: () => ({
    items: [{ id: 12, shop_name: 'Mock·广州南沙蕉门体验中心', activity_name: 'Mock·洗护活动', discountcard_no: 'DC1' }],
    page: 1, lastPage: 1, total: 1, loading: false, loadingMore: false, hasMore: false,
    error: null, loadMoreError: null, reload: vi.fn(), loadMore: vi.fn(),
  }),
}))
vi.mock('./points/usePointsFeed', () => ({
  useUserPointsStat: () => ({ remote: mocks.pointsRemote, reload: mocks.reloadPoints }),
}))
vi.mock('../app/router/routes', () => ({
  findRouteByPathname: () => ({ path: '/exchange', task: 'T008', nodes: [18], states: [], overlays: [] }),
}))
vi.mock('../components/mobile/DebugPanel', () => ({ default: () => null }))
vi.mock('../components/mobile/PageContainer', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
vi.mock('../components/card/BubbleValueRedeemCard', () => ({
  default: ({ onRedeem }: { onRedeem?: () => void }) => (
    <button type="button" onClick={onRedeem}>顶部立即兑换</button>
  ),
}))

import { EXCHANGE_COPY } from '../app/fixtures'
import Exchange from './Exchange'
import ExchangeResult from './ExchangeResult'

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="route">{location.pathname + location.search + location.hash}</output>
}

function renderExchange(entry = '/exchange') {
  return render(
    <MemoryRouter initialEntries={['/previous', entry]} initialIndex={1}>
      <LocationProbe />
      <Routes>
        <Route path="/exchange" element={<Exchange />} />
        <Route path="/exchange/result" element={<ExchangeResult />} />
        <Route path="/card" element={<p>卡包页面</p>} />
        <Route path="/previous" element={<p>上一个页面</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const COUPONS = [
  {
    id: 1,
    name: 'Mock·洗护体验券',
    desc: '洗发 / 护发 / 沐浴体验，限到店核销',
    cost: 200,
    redeemed: 12,
    image: undefined,
    soldOut: false,
  },
  {
    id: 2,
    name: 'Mock·已兑完券',
    desc: '单次体验',
    cost: 320,
    redeemed: 720,
    image: undefined,
    soldOut: true,
  },
  {
    id: 3,
    name: 'Mock·高价券',
    desc: '泡泡值不足',
    cost: 900,
    redeemed: 1,
    image: undefined,
    soldOut: false,
  },
]

function successRemote() {
  return { remote: { state: 'success', data: COUPONS }, reload: mocks.reloadCoupons }
}

function chooseProject(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByRole('radio', { name: /Mock·广州南沙蕉门体验中心/ }))
  return within(dialog).getByRole('button', { name: '确认兑换' })
}

function openCoupon(id = 1) {
  const p = COUPONS.find(x => x.id === id)!
  fireEvent.click(screen.getByRole('button', { name: `${p.name}，${p.cost} 泡泡值` }))
  return screen.getByRole('dialog', { name: '选择适用片区' })
}

afterEach(() => {
  mocks.categoryRemote = { state: 'success', data: [
    { key: '2', label: '洗发体验' }, { key: '3', label: '护发体验' },
  ] }
  mocks.categoryReload.mockReset()
  mocks.redeem.mockReset()
  mocks.useExchangeCoupons.mockReset()
  mocks.reloadCoupons.mockReset()
  mocks.reloadPoints.mockReset()
  mocks.mode = 'mock'
  mocks.pointsRemote = { state: 'success', data: { points: 500, income: 0, expense: 0 } }
})

describe('UX-E: page-local exchange flow', () => {
  it('shows coupon cost and redemption count from the remote list', () => {
    mocks.useExchangeCoupons.mockReturnValue(successRemote())
    renderExchange()
    expect(screen.getByText('Mock·洗护体验券')).toBeTruthy()
    expect(screen.getByText('Mock·已兑完券')).toBeTruthy()
    expect(screen.getByText('兑换量 12')).toBeTruthy()
    expect(screen.getAllByText('200', { exact: false }).length).toBeGreaterThan(0)
  })

  it('keeps every category switch, full-screen close and selected coupon on /exchange with no query/hash', () => {
    mocks.useExchangeCoupons.mockReturnValue(successRemote())
    renderExchange()
    fireEvent.click(screen.getByRole('tab', { name: '洗发体验' }))
    expect(screen.getByTestId('route').textContent).toBe('/exchange')
    expect(screen.getByRole('tab', { name: '洗发体验' }).getAttribute('aria-selected')).toBe('true')

    openCoupon()
    expect(screen.getByTestId('route').textContent).toBe('/exchange')
    fireEvent.click(screen.getByRole('button', { name: '返回兑换专区' }))
    expect(screen.getByTestId('route').textContent).toBe('/exchange')

    fireEvent.click(screen.getByRole('tab', { name: '护发体验' }))
    expect(screen.queryByRole('dialog', { name: '选择适用片区' })).toBeNull()
    expect(screen.getByTestId('route').textContent).toBe('/exchange')

    openCoupon(3)
    expect(screen.getByTestId('route').textContent).toBe('/exchange')
  })

  it('ignores legacy URL product/overlay/category query as a source of exchange state', () => {
    mocks.useExchangeCoupons.mockReturnValue(successRemote())
    renderExchange('/exchange?category=conditioner&product=1&overlay=redeem')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('tab', { name: '全部' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('tab', { name: '洗发体验' }))
    expect(screen.getByTestId('route').textContent).toBe('/exchange?category=conditioner&product=1&overlay=redeem')
  })

  it('uses dynamic category keys while retaining UX-E page-local state', () => {
    mocks.useExchangeCoupons.mockReturnValue(successRemote())
    renderExchange()
    expect(mocks.useExchangeCoupons).toHaveBeenCalledWith(undefined, true)
    fireEvent.click(screen.getByRole('tab', { name: '护发体验' }))
    expect(mocks.useExchangeCoupons).toHaveBeenLastCalledWith('3', true)
    expect(screen.getByTestId('route').textContent).toBe('/exchange')
  })

  it('surfaces category failure and exposes explicit retry without fabricated tabs', () => {
    mocks.categoryRemote = { state: 'error', message: '分类服务器错误' }
    mocks.useExchangeCoupons.mockReturnValue(successRemote())
    renderExchange()
    expect(screen.getByRole('alert').textContent).toContain('分类服务器错误')
    expect(screen.queryByRole('tab', { name: '洗发体验' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '重试分类' }))
    expect(mocks.categoryReload).toHaveBeenCalledOnce()
    expect(screen.getByTestId('route').textContent).toBe('/exchange')
  })

  it('blocks selected category data when backend categories are unavailable', () => {
    mocks.useExchangeCoupons.mockReturnValue(successRemote())
    const view = renderExchange()
    fireEvent.click(screen.getByRole('tab', { name: '洗发体验' }))
    mocks.categoryRemote = { state: 'error', message: '后台分类失败' }
    // Re-render the SAME router/component tree so the UX-E local tab selection persists.
    view.rerender(
      <MemoryRouter initialEntries={['/previous', '/exchange']} initialIndex={1}>
        <LocationProbe />
        <Routes>
          <Route path="/exchange" element={<Exchange />} />
          <Route path="/exchange/result" element={<ExchangeResult />} />
          <Route path="/card" element={<p>卡包页面</p>} />
          <Route path="/previous" element={<p>上一个页面</p>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('请先重试分类加载')).toBeTruthy()
    expect(screen.queryByText('Mock·洗护体验券')).toBeNull()
    expect(mocks.useExchangeCoupons).toHaveBeenLastCalledWith('2', false)
  })

  it('keeps the top CTA inside the page and scrolls to the coupon list', () => {
    mocks.useExchangeCoupons.mockReturnValue(successRemote())
    renderExchange()
    const list = screen.getByRole('region', { name: '洗护体验券列表' })
    list.scrollIntoView = vi.fn()
    fireEvent.click(screen.getByRole('button', { name: '顶部立即兑换' }))
    expect(list.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    expect(screen.getByTestId('route').textContent).toBe('/exchange')
  })

  it('blocks sold-out, insufficient and unavailable-balance submissions', () => {
    mocks.useExchangeCoupons.mockReturnValue(successRemote())
    renderExchange()
    let sheet = openCoupon(2)
    expect((chooseProject(sheet) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(within(sheet).getByRole('button', { name: '返回兑换专区' }))
    sheet = openCoupon(3)
    expect((chooseProject(sheet) as HTMLButtonElement).disabled).toBe(true)
    expect(mocks.redeem).not.toHaveBeenCalled()
  })

  it('blocks submission when balance is loading or has failed', () => {
    mocks.pointsRemote = { state: 'error', message: '余额服务异常' }
    mocks.useExchangeCoupons.mockReturnValue(successRemote())
    renderExchange()
    const sheet = openCoupon()
    expect((chooseProject(sheet) as HTMLButtonElement).disabled).toBe(true)
    expect(mocks.redeem).not.toHaveBeenCalled()
  })

  it('preserves request failure in the same sheet and permits an explicit retry', async () => {
    mocks.useExchangeCoupons.mockReturnValue(successRemote())
    mocks.redeem
      .mockRejectedValueOnce(new Error('后端拒绝兑换'))
      .mockResolvedValueOnce({ couponId: 1, points: 300 })
    renderExchange()
    let sheet = openCoupon()
    fireEvent.click(chooseProject(sheet))
    await waitFor(() => expect(within(sheet).getByRole('alert').textContent).toContain('后端拒绝兑换'))
    expect(screen.getByTestId('route').textContent).toBe('/exchange')

    fireEvent.click(chooseProject(sheet))
    await waitFor(() => expect(screen.getByRole('dialog', { name: '模拟兑换结果' })).toBeTruthy())
    expect(mocks.redeem).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('route').textContent).toBe('/exchange')
  })

  it('guards against rapid double submission until pending request settles', async () => {
    mocks.useExchangeCoupons.mockReturnValue(successRemote())
    let resolveRequest!: () => void
    mocks.redeem.mockReturnValue(new Promise(resolve => {
      resolveRequest = () => resolve({ couponId: 1, points: 300 })
    }))
    renderExchange()
    const sheet = openCoupon()
    const submit = chooseProject(sheet)
    fireEvent.click(submit)
    fireEvent.click(submit)
    expect(mocks.redeem).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('route').textContent).toBe('/exchange')
    await act(async () => resolveRequest())
    expect(screen.getByRole('dialog', { name: '模拟兑换结果' })).toBeTruthy()
    expect(mocks.redeem).toHaveBeenCalledTimes(1)
  })

  it('shows mock success as simulation only and only navigates by explicit card-pack action', async () => {
    mocks.useExchangeCoupons.mockReturnValue(successRemote())
    mocks.redeem.mockResolvedValue({ couponId: 1, points: 300 })
    renderExchange()
    const sheet = openCoupon()
    fireEvent.click(chooseProject(sheet))
    const result = await screen.findByRole('dialog', { name: '模拟兑换结果' })
    expect(within(result).getByText('当前为 Mock 预览，仅验证正式兑换协议与页面状态，不代表真实扣值或发券。')).toBeTruthy()
    expect(mocks.reloadPoints).toHaveBeenCalledOnce()
    expect(mocks.reloadCoupons).toHaveBeenCalledOnce()
    expect(screen.getByTestId('route').textContent).toBe('/exchange')
    fireEvent.click(within(result).getByRole('button', { name: '关闭' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByTestId('route').textContent).toBe('/exchange')
    openCoupon()
    fireEvent.click(chooseProject(screen.getByRole('dialog', { name: '选择适用片区' })))
    const nextResult = await screen.findByRole('dialog', { name: '模拟兑换结果' })
    fireEvent.click(within(nextResult).getByRole('button', { name: '查看我的卡包' }))
    expect(screen.getByTestId('route').textContent).toBe('/card')
    expect(screen.getByText('卡包页面')).toBeTruthy()
  })

  it('uses the real exchange service in API mode and refreshes authoritative reads after success', async () => {
    mocks.mode = 'api'
    mocks.useExchangeCoupons.mockReturnValue(successRemote())
    mocks.redeem.mockResolvedValue({ couponId: 1, points: 300 })
    renderExchange()

    const sheet = openCoupon()
    const submit = chooseProject(sheet) as HTMLButtonElement
    expect(submit.disabled).toBe(false)
    fireEvent.click(submit)

    const result = await screen.findByRole('dialog', { name: '兑换结果' })
    expect(within(result).getByText('兑换完成，剩余泡泡值 300。可前往卡包查看新券。')).toBeTruthy()
    expect(mocks.redeem).toHaveBeenCalledWith(1, 12)
    expect(mocks.reloadPoints).toHaveBeenCalledOnce()
    expect(mocks.reloadCoupons).toHaveBeenCalledOnce()
    expect(screen.getByTestId('route').textContent).toBe('/exchange')
  })

  it('does not convert legacy /exchange/result deep links into a success state', async () => {
    mocks.useExchangeCoupons.mockReturnValue(successRemote())
    renderExchange('/exchange/result?product=1&overlay=redeem')
    await waitFor(() => expect(screen.getByTestId('route').textContent).toBe('/exchange'))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mocks.redeem).not.toHaveBeenCalled()
  })

  it('keeps list empty/error handling and retry behavior intact', () => {
    mocks.useExchangeCoupons.mockReturnValue({ remote: { state: 'error', message: '优惠券列表获取失败' }, reload: mocks.reloadCoupons })
    const view = renderExchange()
    expect(screen.getByText('体验券加载失败')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '重新加载' }))
    expect(mocks.reloadCoupons).toHaveBeenCalledOnce()
    view.unmount()
    mocks.useExchangeCoupons.mockReturnValue({ remote: { state: 'success', data: [] }, reload: mocks.reloadCoupons })
    renderExchange()
    const emptyTitle = screen.getByText('没有找到相关体验券')
    const emptySection = emptyTitle.closest('section')
    expect(emptySection).toBeTruthy()
    const illustration = emptySection?.querySelector('[data-empty-state-illustration] img')
    expect(illustration).toBeTruthy()
    expect(illustration?.className).toContain('w-[168px]')
    expect(emptySection?.parentElement?.className).not.toContain('bg-surface')
  })

  it('retains the category reset action in the illustrated empty state', () => {
    mocks.useExchangeCoupons.mockReturnValue({ remote: { state: 'success', data: [] }, reload: mocks.reloadCoupons })
    renderExchange()
    fireEvent.click(screen.getByRole('tab', { name: '洗发体验' }))
    expect(screen.getByText('没有找到相关体验券')).toBeTruthy()
    expect(document.querySelector('[data-empty-state-illustration]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: EXCHANGE_COPY.emptyAction }))
    expect(screen.getByRole('tab', { name: '全部' }).getAttribute('aria-selected')).toBe('true')
  })
})

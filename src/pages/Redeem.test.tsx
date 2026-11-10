import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ redeemCardCode: vi.fn() }))

vi.mock('../services/redeemCode', () => ({
  redeemCardCode: mocks.redeemCardCode,
}))
vi.mock('./exchange/useCouponProjects', () => ({
  useCouponProjects: (keyword: string) => ({
    items: keyword === '天河'
      ? [{ id: 14, shop_name: 'Mock·广州天河店', activity_name: 'Mock·活动', discountcard_no: 'MOCK' }]
      : [{ id: 12, shop_name: 'Mock·南沙蕉门店', activity_name: 'Mock·活动', discountcard_no: 'MOCK' }],
    page: 1, lastPage: 1, total: 1,
    loading: false, loadingMore: false, hasMore: false,
    error: null, loadMoreError: null, restartRequired: false,
    reload: vi.fn(), loadMore: vi.fn(),
  }),
}))
vi.mock('../app/config/runtime', async (importOriginal) => {
  const original = await importOriginal<typeof import('../app/config/runtime')>()
  return { ...original, runtimePolicy: { ...original.runtimePolicy, dataMode: 'api' } }
})
vi.mock('../app/fixtures/useFixture', () => ({
  useFixtureState: () => ({ state: null }),
}))
vi.mock('../app/router/routes', () => ({
  findRouteByPathname: () => ({ path: '/redeem' }),
}))
vi.mock('../components/mobile/DebugPanel', () => ({ default: () => null }))
vi.mock('../components/mobile/PageContainer', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

import Redeem from './Redeem'
import { AppError } from '../lib/appError'

const renderRedeem = () => {
  const router = createMemoryRouter(
    [{ path: '/before', element: <div>上一页</div> }, { path: '/redeem', element: <Redeem /> }],
    { initialEntries: ['/before', '/redeem'] },
  )
  render(<RouterProvider router={router} />)
  return router
}
const enterCode = (code = 'Abc- 123456') => {
  fireEvent.change(screen.getByRole('textbox', { name: '兑换码' }), {
    target: { value: code },
  })
  fireEvent.click(screen.getByRole('button', { name: '选择适用片区' }))
  return screen.getByRole('dialog', { name: '选择适用片区' })
}
const selectProject = (dialog: HTMLElement) => {
  fireEvent.click(within(dialog).getByRole('radio', { name: /Mock·南沙蕉门店/ }))
  return within(dialog).getByRole('button', { name: '确认兑换' })
}
afterEach(() => mocks.redeemCardCode.mockReset())

describe('Redeem updated API and shared full-screen project selector', () => {
  it('does not request redemption until project selected, then submits original code and id', async () => {
    mocks.redeemCardCode.mockResolvedValue({ coupons_id: 7 })
    renderRedeem()
    const dialog = enterCode()
    expect(within(dialog).getByText('Abc- 123456')).toBeTruthy()
    expect(within(dialog).queryByText(/泡泡值余额/)).toBeNull()
    expect(mocks.redeemCardCode).not.toHaveBeenCalled()
    expect((within(dialog).getByRole('button', { name: '请选择适用片区' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(selectProject(dialog))
    await waitFor(() => expect(mocks.redeemCardCode).toHaveBeenCalledWith('Abc- 123456', 12))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '选择适用片区' })).toBeNull())
    expect(screen.getByText('兑换成功')).toBeTruthy()
    expect(screen.getByRole('button', { name: '查看我的卡包' })).toBeTruthy()
    expect(screen.queryByText(/卡券编号：/)).toBeNull()
  })

  it('keeps selected project even when searching a different keyword', async () => {
    mocks.redeemCardCode.mockResolvedValue({ coupons_id: 15 })
    renderRedeem()
    const dialog = enterCode('ABC123456789')
    selectProject(dialog)
    fireEvent.change(within(dialog).getByRole('searchbox', { name: '搜索片区或项目名称' }), {
      target: { value: '天河' },
    })
    await waitFor(() => expect(within(dialog).getByRole('radio', { name: /Mock·广州天河店/ })).toBeTruthy())
    expect(within(dialog).getByRole('region', { name: '已选片区' }).textContent).toContain('南沙蕉门')
    fireEvent.click(within(dialog).getByRole('button', { name: '确认兑换' }))
    await waitFor(() => expect(mocks.redeemCardCode).toHaveBeenCalledWith('ABC123456789', 12))
  })

  it('system/browser back closes the selector first without adding a history entry', async () => {
    const router = renderRedeem()
    const dialog = enterCode('ABC123456789')
    await router.navigate(-1)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '选择适用片区' })).toBeNull())
    expect(router.state.location.pathname).toBe('/redeem')
    expect(screen.getByRole('textbox', { name: '兑换码' })).toHaveProperty('value', 'ABC123456789')
    expect(mocks.redeemCardCode).not.toHaveBeenCalled()
    expect(dialog.isConnected).toBe(false)
  })

  it('keeps the picker and original code when the backend returns a business error', async () => {
    mocks.redeemCardCode.mockRejectedValue(new Error('该兑换码已被使用'))
    renderRedeem()
    const dialog = enterCode('ABC123456789')
    fireEvent.click(selectProject(dialog))
    expect(await within(dialog).findByText('该兑换码已被使用')).toBeTruthy()
    expect(within(dialog).getByText('ABC123456789')).toBeTruthy()
    expect(screen.queryByText('兑换成功')).toBeNull()
    expect((within(dialog).getByRole('button', { name: '确认兑换' }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(within(dialog).getByRole('button', { name: '返回兑换码' }))
    expect(screen.getByRole('textbox', { name: '兑换码' })).toHaveProperty('value', 'ABC123456789')
  })

  it('avoids false success when receipt is not verifiable', async () => {
    mocks.redeemCardCode.mockRejectedValue(new AppError({
      kind: 'contract', message: '外部数据不符合 cardredemptioncodes.redeem.data 契约',
    }))
    renderRedeem()
    const dialog = enterCode('ABC123456789')
    fireEvent.click(selectProject(dialog))
    expect(await within(dialog).findByText('兑换结果暂时无法确认，请稍后重试')).toBeTruthy()
    expect(screen.queryByText(/cardredemptioncodes.redeem.data/)).toBeNull()
    expect(screen.queryByText('兑换成功')).toBeNull()
  })

  it('disables entry under ten chars, preserves formatting, and offers no picker', () => {
    renderRedeem()
    fireEvent.change(screen.getByRole('textbox', { name: '兑换码' }), {
      target: { value: 'a1-b2+3' },
    })
    expect((screen.getByRole('textbox', { name: '兑换码' }) as HTMLInputElement).value).toBe('a1-b2+3')
    expect((screen.getByRole('button', { name: '选择适用片区' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(mocks.redeemCardCode).not.toHaveBeenCalled()
  })
})

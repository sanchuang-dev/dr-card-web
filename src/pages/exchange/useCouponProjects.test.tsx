import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../../services/couponProjects', () => ({ fetchCouponProjects: mocks.fetch }))

import { useCouponProjects } from './useCouponProjects'

const row = (id: number) => ({
  id, shop_name: 'Mock·片区' + id, activity_name: 'Mock·体验券', discountcard_no: 'DC' + id,
})
const page = (n: number, total: number, ids: number[], lastPage = 2) => ({
  data: ids.map(row), current_page: n, per_page: 15, total, last_page: lastPage,
})

afterEach(() => mocks.fetch.mockReset())

describe('project pagination search generation', () => {
  it('restores page one after a changed server catalog instead of infinitely retrying stale page two', async () => {
    mocks.fetch.mockResolvedValueOnce(page(1, 16, [1, 2]))
      .mockResolvedValueOnce(page(2, 17, [3]))
      .mockResolvedValueOnce(page(1, 17, [1, 2, 3]))
    const hook = renderHook(() => useCouponProjects(''))
    await waitFor(() => expect(hook.result.current.page).toBe(1))

    act(() => hook.result.current.loadMore())
    await waitFor(() => expect(hook.result.current.restartRequired).toBe(true))
    expect(hook.result.current.items.map(p => p.id)).toEqual([1, 2])

    act(() => hook.result.current.reload())
    await waitFor(() => expect(hook.result.current.total).toBe(17))
    expect(hook.result.current.restartRequired).toBe(false)
    expect(mocks.fetch.mock.calls.map(call => call[1])).toEqual([1, 2, 1])
    hook.unmount()
  })

  it('ignores an old search response after a new keyword is entered', async () => {
    let completeOld!: (value: ReturnType<typeof page>) => void
    mocks.fetch.mockImplementationOnce(() => new Promise(resolve => { completeOld = resolve }))
      .mockResolvedValueOnce(page(1, 1, [30], 1))
    const hook = renderHook(({ keyword }) => useCouponProjects(keyword), {
      initialProps: { keyword: '南沙' },
    })
    hook.rerender({ keyword: '天河' })
    await waitFor(() => expect(hook.result.current.items.map(p => p.id)).toEqual([30]))
    await act(async () => completeOld(page(1, 1, [10], 1)))
    expect(hook.result.current.items.map(p => p.id)).toEqual([30])
    hook.unmount()
  })
})

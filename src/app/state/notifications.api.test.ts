import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  fetchPage: vi.fn(), fetchDetail: vi.fn(), fetchCounts: vi.fn(), readAll: vi.fn(),
  token: 'A',
}))
vi.mock('../config/runtime', () => ({ runtimePolicy: { dataMode: 'api' } }))
vi.mock('../../services/auth/session', () => ({
  getAuthSession: () => ({ accessToken: mocks.token }),
}))
vi.mock('../../services/notices', async importOriginal => {
  const real = await importOriginal<typeof import('../../services/notices')>()
  return {
    ...real,
    fetchNoticePage: mocks.fetchPage,
    fetchNoticeDetail: mocks.fetchDetail,
    fetchNoticeUnreadCounts: mocks.fetchCounts,
    readAllNotices: mocks.readAll,
  }
})

import {
  loadMoreRemoteNotices, loadRemoteNoticeDetail, markAllNotificationsRead,
  refreshRemoteNotices, refreshRemoteUnreadCount, resetNotifications, useApiNoticeStore,
} from './notifications'

const data = (id: number, isRead = 0) => ({
  id, title: '真实消息 ' + id, content: '<p>正文</p>', type: 10,
  send_time: 1790000300, create_time: '2026-10-01 12:05:00',
  is_read: isRead, extra_json: null,
})
const page = (ids: number[], current_page = 1, last_page = 1) => ({
  data: ids.map(id => data(id)), current_page, per_page: 30, last_page,
  total: last_page === 1 ? ids.length : 31,
})

describe('#122 remote notice state', () => {
  beforeEach(() => {
    mocks.token = 'A'
    mocks.fetchPage.mockReset()
    mocks.fetchDetail.mockReset()
    mocks.fetchCounts.mockReset().mockResolvedValue({ total: 2, items: [] })
    mocks.readAll.mockReset()
    act(() => resetNotifications())
  })

  it('refetches the current user count after a 401 transparently rotates the auth token', async () => {
    mocks.fetchCounts.mockImplementationOnce(async () => {
      mocks.token = 'B' // Axios renewed the stored token while the count request was in flight.
      return { total: 7, items: [] }
    }).mockResolvedValueOnce({ total: 4, items: [] })

    await act(async () => { await refreshRemoteUnreadCount() })
    expect(mocks.fetchCounts).toHaveBeenCalledTimes(2)
    expect(useApiNoticeStore.getState().countLoaded).toBe(true)
    expect(useApiNoticeStore.getState().unreadCount).toBe(4)
  })

  it('loads backend notices with paging, not the preview fixture list', async () => {
    mocks.fetchPage.mockResolvedValueOnce(page([31], 1, 2))
      .mockResolvedValueOnce(page([32], 2, 2))
    await act(async () => { await refreshRemoteNotices() })
    expect(useApiNoticeStore.getState().items.map(x => x.id)).toEqual(['31'])
    expect(useApiNoticeStore.getState().total).toBe(31)
    await act(async () => { await loadMoreRemoteNotices() })
    expect(useApiNoticeStore.getState().items.map(x => x.id)).toEqual(['31', '32'])
    expect(mocks.fetchPage).toHaveBeenLastCalledWith(2)
  })

  it('GET detail marks read only after backend success and refreshes unread count', async () => {
    mocks.fetchPage.mockResolvedValue(page([31]))
    await act(async () => { await refreshRemoteNotices() })
    mocks.fetchDetail.mockResolvedValue(data(31, 1))
    await act(async () => { await loadRemoteNoticeDetail('31') })
    expect(useApiNoticeStore.getState().items[0]?.unread).toBe(false)
    expect(useApiNoticeStore.getState().details['31']?.unread).toBe(false)
    expect(mocks.fetchDetail).toHaveBeenCalledWith('31')
  })

  it('does not fake mark-all success when the backend write fails', async () => {
    mocks.fetchPage.mockResolvedValueOnce(page([31]))
      .mockResolvedValueOnce({ ...page([31]), data: [data(31, 1)] })
    await act(async () => { await refreshRemoteNotices() })
    mocks.readAll.mockRejectedValueOnce(new Error('backend offline'))
    await expect(markAllNotificationsRead()).rejects.toThrow('backend offline')
    expect(useApiNoticeStore.getState().items[0]?.unread).toBe(true)
    mocks.readAll.mockResolvedValueOnce(1)
    await act(async () => { await markAllNotificationsRead() })
    expect(useApiNoticeStore.getState().items[0]?.unread).toBe(false)
  })

  it('releases pagination after a superseding refresh, ignoring the stale page response', async () => {
    mocks.fetchPage.mockResolvedValueOnce(page([31], 1, 2))
    await act(async () => { await refreshRemoteNotices() })
    let resolveOld: ((data: ReturnType<typeof page>) => void) | undefined
    mocks.fetchPage.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
      .mockResolvedValueOnce(page([31], 1, 2))
    const oldPage = loadMoreRemoteNotices()
    expect(useApiNoticeStore.getState().loadingMore).toBe(true)
    await act(async () => { await refreshRemoteNotices() })
    expect(useApiNoticeStore.getState().loadingMore).toBe(false)
    resolveOld?.(page([32], 2, 2))
    await act(async () => { await oldPage })
    expect(useApiNoticeStore.getState().items.map(x => x.id)).toEqual(['31'])
    expect(useApiNoticeStore.getState().loadingMore).toBe(false)
    mocks.fetchPage.mockResolvedValueOnce(page([33], 2, 2))
    await act(async () => { await loadMoreRemoteNotices() })
    expect(useApiNoticeStore.getState().items.map(x => x.id)).toEqual(['31', '33'])
  })

  it('releases pagination when its superseding refresh fails', async () => {
    mocks.fetchPage.mockResolvedValueOnce(page([31], 1, 2))
    await act(async () => { await refreshRemoteNotices() })
    let resolveOld: ((data: ReturnType<typeof page>) => void) | undefined
    mocks.fetchPage.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
      .mockRejectedValueOnce(new Error('backend offline'))
    const oldPage = loadMoreRemoteNotices()
    await act(async () => { await refreshRemoteNotices() })
    expect(useApiNoticeStore.getState().loadingMore).toBe(false)
    expect(useApiNoticeStore.getState().error).toMatch(/加载失败/)
    resolveOld?.(page([32], 2, 2))
    await act(async () => { await oldPage })
    expect(useApiNoticeStore.getState().loadingMore).toBe(false)
  })

  it('scopes a detail error to the notice that failed', async () => {
    mocks.fetchDetail.mockRejectedValueOnce(new Error('missing'))
    await act(async () => { await loadRemoteNoticeDetail('31') })
    expect(useApiNoticeStore.getState().detailErrorId).toBe('31')
    mocks.fetchDetail.mockResolvedValueOnce(data(91, 1))
    await act(async () => { await loadRemoteNoticeDetail('91') })
    expect(useApiNoticeStore.getState().detailError).toBeNull()
    expect(useApiNoticeStore.getState().detailErrorId).toBeNull()
    expect(useApiNoticeStore.getState().details['91']?.id).toBe('91')
  })

  it('clears cached messages on authenticated identity change', async () => {
    mocks.fetchPage.mockResolvedValueOnce(page([31])).mockResolvedValueOnce(page([91]))
    await act(async () => { await refreshRemoteNotices() })
    expect(useApiNoticeStore.getState().items[0]?.id).toBe('31')
    mocks.token = 'B'
    await act(async () => { await refreshRemoteNotices() })
    expect(useApiNoticeStore.getState().items.map(x => x.id)).toEqual(['91'])
  })

  it('refuses to replace a newer feed with a stale response', async () => {
    let resolveOld: ((data: ReturnType<typeof page>) => void) | undefined
    mocks.fetchPage.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
      .mockResolvedValueOnce(page([92]))
    const old = refreshRemoteNotices()
    await act(async () => { await refreshRemoteNotices() })
    resolveOld?.(page([31]))
    await act(async () => { await old })
    expect(useApiNoticeStore.getState().items.map(x => x.id)).toEqual(['92'])
  })
})

/**
 * Notifications have two explicitly separate data sources:
 * - preview/dev Mock: original T012 fixture/Zustand state, for UI/e2e baselines;
 * - API/test/prod: authenticated backend notice list/reads/counts, never fixture fallback.
 * Invitation confirmation remains owned by #111, not the generic notification read flag.
 */
import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import { runtimePolicy } from '../config/runtime'
import { NOTIFICATION_FIXTURES, type NotificationFixture } from '../fixtures'
import { bootstrapAuthSession, getAuthSession } from '../../services/auth/session'
import {
  fetchNoticeDetail,
  fetchNoticePage,
  fetchNoticeUnreadCounts,
  mapNotice,
  readAllNotices,
} from '../../services/notices'

export type NotificationItem = NotificationFixture
const isApi = runtimePolicy.dataMode === 'api'
const INITIAL_READ = NOTIFICATION_FIXTURES.filter(item => !item.unread).map(item => item.id)

interface MockNotificationStore {
  readIds: Set<string>
  markRead: (id: string) => void
  markAllRead: () => void
  reset: () => void
}
const initialReadIds = () => new Set(INITIAL_READ)
export const useNotificationStore = create<MockNotificationStore>((set, get) => ({
  readIds: initialReadIds(),
  markRead: id => {
    if (!get().readIds.has(id)) set(s => ({ readIds: new Set(s.readIds).add(id) }))
  },
  markAllRead: () => set({ readIds: new Set(NOTIFICATION_FIXTURES.map(i => i.id)) }),
  reset: () => set({ readIds: initialReadIds() }),
}))

interface ApiNoticeStore {
  items: NotificationItem[]
  details: Record<string, NotificationItem>
  unreadCount: number
  countLoaded: boolean
  total: number
  page: number
  lastPage: number
  loading: boolean
  loadingMore: boolean
  loaded: boolean
  error: string | null
  detailLoadingId: string | null
  detailError: string | null
  detailErrorId: string | null
}

const initialApiState: ApiNoticeStore = {
  items: [], details: {}, unreadCount: 0, countLoaded: false, total: 0, page: 0, lastPage: 1,
  loading: false, loadingMore: false, loaded: false, error: null,
  detailLoadingId: null, detailError: null, detailErrorId: null,
}
export const useApiNoticeStore = create<ApiNoticeStore>(() => ({ ...initialApiState }))
let lastAccessToken: string | undefined
let sessionEpoch = 0
let feedSequence = 0
let detailSequence = 0
let countSequence = 0
let feedRequest = 0
let detailRequest = 0

/** Replace per-account in-memory notice data if the authenticated identity changes. */
function currentGeneration(): number {
  const token = getAuthSession()?.accessToken
  if (lastAccessToken !== token) {
    lastAccessToken = token
    sessionEpoch += 1
    feedSequence += 1
    detailSequence += 1
    countSequence += 1
    useApiNoticeStore.setState({ ...initialApiState })
  }
  return sessionEpoch
}

function errorLabel(): string {
  return '加载失败，请检查网络或登录状态后重试'
}

async function ensureNoticeSession(): Promise<void> {
  if (!getAuthSession()?.accessToken) await bootstrapAuthSession()
}

export async function refreshRemoteUnreadCount(retryAfterSessionChange = true): Promise<void> {
  if (!isApi) return
  try {
    await ensureNoticeSession()
    const epoch = currentGeneration()
    const seq = ++countSequence
    const counts = await fetchNoticeUnreadCounts()
    if (currentGeneration() !== epoch) {
      // Axios can renew an expired Bearer token and retry this request successfully.
      // Never apply an earlier session's count: fetch once more for the new token instead.
      if (retryAfterSessionChange && getAuthSession()?.accessToken) {
        await refreshRemoteUnreadCount(false)
      }
      return
    }
    if (countSequence === seq) {
      useApiNoticeStore.setState({ unreadCount: counts.total, countLoaded: true })
    }
  } catch {
    // Failed count queries do not reintroduce fixtures or mutate the last confirmed count.
  }
}

export async function refreshRemoteNotices(): Promise<void> {
  if (!isApi) return
  const request = ++feedRequest
  // Supersede pagination without stranding its loading spinner.
  useApiNoticeStore.setState({ loading: true, loadingMore: false, loaded: false, error: null })
  let epoch = 0
  let seq = 0
  try {
    await ensureNoticeSession()
    epoch = currentGeneration()
    seq = ++feedSequence
    const result = await fetchNoticePage(1)
    if (currentGeneration() !== epoch || feedSequence !== seq) return
    useApiNoticeStore.setState({
      items: result.data.map(mapNotice),
      page: result.current_page, lastPage: result.last_page, total: result.total,
      loading: false, loadingMore: false, loaded: true, error: null,
    })
  } catch {
    if (feedRequest === request && (seq === 0 || (currentGeneration() === epoch && feedSequence === seq))) {
      useApiNoticeStore.setState({ loading: false, loadingMore: false, loaded: true, error: errorLabel() })
    }
  }
  if (seq !== 0) void refreshRemoteUnreadCount()
}

export async function loadMoreRemoteNotices(): Promise<void> {
  if (!isApi) return
  const epoch = currentGeneration()
  const s = useApiNoticeStore.getState()
  if (s.loading || s.loadingMore || !s.loaded || s.page >= s.lastPage) return
  const nextPage = s.page + 1
  const seq = feedSequence
  useApiNoticeStore.setState({ loadingMore: true, error: null })
  try {
    const result = await fetchNoticePage(nextPage)
    if (currentGeneration() !== epoch || feedSequence !== seq) return
    useApiNoticeStore.setState(prev => {
      const map = new Map(prev.items.map(item => [item.id, item]))
      for (const item of result.data.map(mapNotice)) map.set(item.id, item)
      return {
        items: [...map.values()], page: result.current_page,
        lastPage: result.last_page, total: result.total,
        loadingMore: false, error: null,
      }
    })
  } catch {
    if (currentGeneration() === epoch && feedSequence === seq) useApiNoticeStore.setState({
      loadingMore: false, error: '加载更多通知失败，请重试',
    })
  }
}

export async function loadRemoteNoticeDetail(id: string): Promise<void> {
  if (!isApi) return
  const request = ++detailRequest
  useApiNoticeStore.setState({ detailLoadingId: id, detailError: null, detailErrorId: null })
  let epoch = 0
  let seq = 0
  try {
    await ensureNoticeSession()
    epoch = currentGeneration()
    seq = ++detailSequence
    const data = await fetchNoticeDetail(id) // server marks the current user's notice read
    if (currentGeneration() !== epoch || detailSequence !== seq) return
    const item = mapNotice(data)
    useApiNoticeStore.setState(prev => ({
      details: { ...prev.details, [id]: item },
      items: prev.items.map(existing => existing.id === id ? item : existing),
      detailLoadingId: null, detailError: null, detailErrorId: null,
    }))
    void refreshRemoteUnreadCount()
  } catch {
    if (detailRequest === request && (seq === 0 || (currentGeneration() === epoch && detailSequence === seq))) {
      useApiNoticeStore.setState({ detailLoadingId: null, detailError: '通知无法加载，可能已删除或无权查看', detailErrorId: id })
    }
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  if (!isApi) {
    useNotificationStore.getState().markAllRead()
    return
  }
  await ensureNoticeSession()
  const epoch = currentGeneration()
  await readAllNotices()
  if (currentGeneration() !== epoch) return
  // Only update displayed read flags AFTER successful backend mutation.
  useApiNoticeStore.setState(prev => ({
    unreadCount: 0, countLoaded: true,
    items: prev.items.map(item => ({ ...item, unread: false })),
    details: Object.fromEntries(Object.entries(prev.details).map(([id, item]) => [id, { ...item, unread: false }])),
  }))
  await Promise.all([refreshRemoteNotices(), refreshRemoteUnreadCount()])
}

export function markNotificationRead(id: string): void {
  if (!isApi) useNotificationStore.getState().markRead(id)
  // API mode must call GET /notices/detail (which atomically marks read); never local mark.
}

export function resetNotifications(): void {
  useNotificationStore.getState().reset()
  useApiNoticeStore.setState({ ...initialApiState })
  sessionEpoch += 1
  feedSequence += 1
  detailSequence += 1
  countSequence += 1
  feedRequest += 1
  detailRequest += 1
}

export function useNotifications() {
  const readIds = useNotificationStore(s => s.readIds)
  const remote = useApiNoticeStore()

  useEffect(() => {
    if (!isApi) return
    void refreshRemoteUnreadCount()
    const onFocus = () => { void refreshRemoteUnreadCount() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const mock = useMemo(() => {
    const items = NOTIFICATION_FIXTURES.map(item => ({ ...item, unread: !readIds.has(item.id) }))
    return { items, unreadCount: items.filter(item => item.unread).length }
  }, [readIds])

  if (!isApi) return {
    ...mock, countLoaded: true, total: mock.items.length, loading: false, loadingMore: false,
    loaded: true, hasMore: false, error: null,
  }
  return {
    items: remote.items, unreadCount: remote.unreadCount, countLoaded: remote.countLoaded, total: remote.total,
    loading: remote.loading, loadingMore: remote.loadingMore,
    loaded: remote.loaded, hasMore: remote.page < remote.lastPage,
    error: remote.error,
  }
}

export function useNotification(id?: string): NotificationItem | undefined {
  const readIds = useNotificationStore(s => s.readIds)
  const remoteDetails = useApiNoticeStore(s => s.details)
  return useMemo(() => {
    if (isApi) return id ? remoteDetails[id] : undefined
    const fixture = NOTIFICATION_FIXTURES.find(item => item.id === id)
    return fixture ? { ...fixture, unread: !readIds.has(fixture.id) } : undefined
  }, [id, readIds, remoteDetails])
}

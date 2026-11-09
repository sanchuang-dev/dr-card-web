import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchCouponProjects, type CouponProject } from '../../services/couponProjects'

interface ProjectQueryState {
  items: CouponProject[]
  page: number
  lastPage: number
  total: number
  loading: boolean
  loadingMore: boolean
  error: string | null
  loadMoreError: string | null
  restartRequired: boolean
}

const initial: ProjectQueryState = {
  items: [], page: 0, lastPage: 1, total: 0,
  loading: true, loadingMore: false, error: null, loadMoreError: null, restartRequired: false,
}
const errorText = (error: unknown) => error instanceof Error ? error.message : '片区加载失败，请重试'

/** Server pagination per query. Older search responses must never override newer results. */
export function useCouponProjects(keyword: string) {
  const [retry, setRetry] = useState(0)
  const [state, setState] = useState<ProjectQueryState>(initial)
  const generation = useRef(0)
  const morePending = useRef(false)
  const query = keyword.trim()

  useEffect(() => {
    const current = ++generation.current
    morePending.current = false
    setState({ ...initial })
    void fetchCouponProjects(query, 1).then(
      result => {
        if (generation.current !== current) return
        setState({
          items: result.data, page: result.current_page, lastPage: result.last_page,
          total: result.total, loading: false, loadingMore: false,
          error: null, loadMoreError: null, restartRequired: false,
        })
      },
      error => {
        if (generation.current !== current) return
        setState({ ...initial, loading: false, error: errorText(error) })
      },
    )
    return () => { generation.current += 1 }
  }, [query, retry])

  const reload = useCallback(() => setRetry(value => value + 1), [])
  const hasMore = !state.loading && !state.error && state.page > 0 && state.page < state.lastPage
  const loadMore = useCallback(() => {
    if (!hasMore || state.loadingMore || state.restartRequired || morePending.current) return
    morePending.current = true
    const current = generation.current
    const next = state.page + 1
    setState(prev => ({ ...prev, loadingMore: true, loadMoreError: null }))
    void fetchCouponProjects(query, next).then(
      result => {
        if (generation.current !== current) return
        setState(prev => {
          // Never append a changed catalog as if it were a consistent page.
          if (result.total !== prev.total || result.last_page !== prev.lastPage) {
            return { ...prev, loadingMore: false, loadMoreError: '列表已变化，请重新加载', restartRequired: true }
          }
          const rows = new Map(prev.items.map(item => [item.id, item]))
          result.data.forEach(item => rows.set(item.id, item))
          return { ...prev, items: [...rows.values()], page: result.current_page,
            loadingMore: false, loadMoreError: null, restartRequired: false }
        })
        morePending.current = false
      },
      error => {
        if (generation.current !== current) return
        morePending.current = false
        setState(prev => ({ ...prev, loadingMore: false, loadMoreError: errorText(error) }))
      },
    )
  }, [hasMore, query, state.loadingMore, state.page])

  return { ...state, hasMore, reload, loadMore }
}

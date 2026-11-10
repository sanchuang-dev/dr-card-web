import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, RefreshCw } from 'lucide-react'
import DebugPanel from '../components/mobile/DebugPanel'
import EmptyStateIllustration from '../components/mobile/EmptyStateIllustration'
import PageContainer from '../components/mobile/PageContainer'
import { Button, EmptyState, LoadingIndicator, SegmentedControl } from '../components/ui'
import { useFixtureState } from '../app/fixtures/useFixture'
import { findRouteByPathname } from '../app/router/routes'
import {
  BUBBLE_FILTERS,
  BUBBLE_LIST_END,
  isBubbleFilter,
  type BubbleFilter,
} from '../app/fixtures'
import {
  USER_POINTS_TYPE_EXPENSE,
  USER_POINTS_TYPE_INCOME,
  type UserPointsRecord,
} from '../services/userpoints'
import { useUserPointsList } from './points/usePointsFeed'

/**
 * 泡泡值明细（#5 明细分支）
 * -------------------------------------------------------------
 * 事实源：docs/prototype/02-membership-and-checkin.md §3
 * 需求确认（docs/requirements/2026-08-27-ui-change-requirements.md §4.1）：
 *   本页是「纯明细页」，内容只包含全部 / 收入 / 消耗 Tab、泡泡值流水列表与已有空态；
 *   Tab 与列表样式直接继承原泡泡值页面，不新增视觉方案。
 * 因此本页不承载任务、泡泡福利、资产营销与底部兑换主操作。
 * 2026-09-28：接入 GET /api/userpoints/index —— 三个 Tab 复用同一接口，切换只改 type；
 *   Tab 与列表视觉保持不变，分页每页 15 条。
 * 可复现状态：?state=income / expense / empty（仅 preview/dev，用于视觉验收）
 */

const PAGE_SIZE = 15

/** Tab → 接口 type：全部不传，收入=10，消费=20。 */
const FILTER_TO_TYPE: Record<BubbleFilter, number | undefined> = {
  all: undefined,
  income: USER_POINTS_TYPE_INCOME,
  expense: USER_POINTS_TYPE_EXPENSE,
}

/**
 * object_type → 列表展示文案。
 * 当前只有 task=签到；order 待兑换功能上线后才会出现，未知值给通用兜底文案，
 * 不硬编码业务不可知项。
 */
function resolveRecordTitle(record: UserPointsRecord): string {
  if (record.object_type === 'task') return '每日签到'
  if (record.object_type === 'order') return '兑换消耗'
  return '泡泡值变动'
}

export default function PointsDetail() {
  const route = findRouteByPathname('/points/detail')
  const { state } = useFixtureState(route)

  const initialFilter: BubbleFilter = isBubbleFilter(state?.key ?? null) ? (state!.key as BubbleFilter) : 'all'
  const [filter, setFilter] = useState<BubbleFilter>(initialFilter)

  /** ?state=empty 用于验收空态；API 模式下该 fixture 失效，仍按真实数据渲染。 */
  const forceEmpty = state?.key === 'empty'

  const {
    remote,
    canLoadMore,
    loadingMore,
    loadMoreError,
    loadMore,
    reload,
  } = useUserPointsList({
    type: FILTER_TO_TYPE[filter],
    pageSize: PAGE_SIZE,
  })

  const records = useMemo(
    () => (forceEmpty || remote.state !== 'success' ? [] : remote.data.data),
    [forceEmpty, remote],
  )

  const isLoading = !forceEmpty && remote.state === 'loading'
  const isError = !forceEmpty && remote.state === 'error'

  return (
    <PageContainer inset={false} className="pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
      {/* Tab 固定在滚动区顶部：内容从下方穿过，用同色系暖白 + 背景模糊遮挡 */}
      <div className="sticky top-0 z-20 bg-[linear-gradient(180deg,rgba(255,249,238,0.96),rgba(255,252,247,0.9))] px-4 pb-3 pt-3 backdrop-blur-sm">
        <SegmentedControl
          items={BUBBLE_FILTERS.map((item) => ({ value: item.value, label: item.label }))}
          value={filter}
          className="border border-[#eadbc2]/80 bg-[#f5ecdf]/90 shadow-[inset_0_1px_1px_rgba(127,82,27,0.04)] [&>button]:text-[#74634f] [&>button[aria-selected=true]]:border [&>button[aria-selected=true]]:border-[#ebd1a4] [&>button[aria-selected=true]]:bg-[#fffaf1] [&>button[aria-selected=true]]:text-[#b56e22] [&>button[aria-selected=true]]:shadow-[0_2px_6px_rgba(145,91,24,0.08)]"
          onChange={(value) => {
            if (isBubbleFilter(value)) setFilter(value)
          }}
        />
      </div>

      <section className="mx-4 mt-1" aria-label="泡泡值变动记录">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <LoadingIndicator label="加载中" />
          </div>
        ) : isError ? (
          <EmptyState
            variant="recoverable-error"
            title="明细加载失败"
            supportingText={remote.message}
            primaryAction={
              <Button variant="outline" leadingIcon={RefreshCw} onClick={reload}>
                重新加载
              </Button>
            }
          />
        ) : records.length === 0 ? (
          /* 原型 §3 只给了「暂时没有更多记录啦」，不额外补写引导文案；
             视觉统一使用品牌插画空态，直接落在页面背景上，不再套白卡片容器。 */
          <EmptyState
            variant="no-data"
            visual={<EmptyStateIllustration size="md" />}
            title={BUBBLE_LIST_END}
          />
        ) : (
          <>
            <div className="overflow-hidden rounded-feature border border-border-subtle bg-surface shadow-bubble">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center gap-3 border-b border-border-subtle px-4 py-3.5 last:border-0"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      record.type === USER_POINTS_TYPE_INCOME
                        ? 'bg-success-bg text-success-text'
                        : 'bg-danger-bg text-danger-text'
                    }`}
                    aria-hidden
                  >
                    {record.type === USER_POINTS_TYPE_INCOME ? (
                      <ArrowDownLeft className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{resolveRecordTitle(record)}</p>
                    <p className="mt-0.5 text-xs text-text-tertiary">{record.create_time}</p>
                  </div>
                  <span
                    className={`text-base font-semibold ${
                      record.type === USER_POINTS_TYPE_INCOME ? 'text-success-text' : 'text-danger-text'
                    }`}
                  >
                    {record.type === USER_POINTS_TYPE_INCOME ? '+' : '-'}
                    {record.points}
                    <span className="ml-0.5 text-xs font-normal">🫧</span>
                  </span>
                </div>
              ))}
            </div>

            {canLoadMore ? (
              <div className="mt-4 flex flex-col items-center gap-2">
                <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? '加载中…' : '加载更多'}
                </Button>
                {loadMoreError ? (
                  <p role="alert" className="text-center text-xs text-danger-text">
                    {loadMoreError}，可再次点击重试
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-center text-xs text-text-tertiary">{BUBBLE_LIST_END}</p>
            )}
          </>
        )}
      </section>

      <DebugPanel route={route} />
    </PageContainer>
  )
}

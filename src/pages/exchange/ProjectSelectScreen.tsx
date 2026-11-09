import { useEffect, useMemo, useRef, useState, type UIEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronLeft, Search, Ticket, X } from 'lucide-react'
import type { CouponRedeemView } from '../../services/coupons'
import type { CouponProject } from '../../services/couponProjects'
import { useCouponProjects } from './useCouponProjects'

type Props = {
  submitting: boolean
  submitError: string | null
  onClose: () => void
  onConfirm: (projectId: number) => void
} & (
  | { mode: 'code'; code: string }
  | { mode?: 'coupon'; coupon: CouponRedeemView; fallbackImage: string; balance: number | null }
)

function ProjectOption({ project, checked, onChoose }: {
  project: CouponProject
  checked: boolean
  onChoose: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onChoose}
      className={`flex min-h-[76px] w-full items-center gap-3 rounded-[13px] border px-3 py-3 text-left shadow-[0_3px_16px_rgba(70,51,30,.035)] transition active:scale-[.993] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#DF4800] ${
        checked ? 'border-[#EBA879] bg-[#FFF8F2]' : 'border-[#F1EAE2] bg-white'
      }`}
    >
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
        checked ? 'border-[#DF4800] bg-[#DF4800] text-white' : 'border-[#CCC4B9] bg-white'
      }`}>
        {checked && <Check size={13} strokeWidth={2.5} aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-[14px] font-semibold leading-[21px] text-[#28231E]">{project.shop_name}</span>
        <span className="mt-[5px] block truncate text-[11px] leading-[17px] text-[#999086]">{project.activity_name}</span>
      </span>
      {checked && <span className="shrink-0 rounded-full bg-[#FFEDE0] px-2 py-1 text-[10px] text-[#BF672C]">已选择</span>}
    </button>
  )
}

/** Full-screen, in-page exchange step. Selection survives every search and page change. */
export default function ProjectSelectScreen(props: Props) {
  const { submitting, submitError, onClose, onConfirm } = props
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<CouponProject | null>(null)
  const scroller = useRef<HTMLElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const { items, total, page, loading, loadingMore, hasMore, error, loadMoreError, restartRequired, reload, loadMore } =
    useCouponProjects(query)

  useEffect(() => {
    const timeout = window.setTimeout(() => setQuery(input.trim()), 300)
    return () => window.clearTimeout(timeout)
  }, [input])

  useEffect(() => { if (scroller.current) scroller.current.scrollTop = 0 }, [query])

  // An in-page portal must own keyboard focus just like the shared Dialog.
  // Focus the back action (not the search input) to avoid opening the mobile keyboard.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    const first = dialog?.querySelector<HTMLButtonElement>('button:not(:disabled)')
    first?.focus({ preventScroll: true })
    const keepFocusInside = (event: FocusEvent) => {
      if (dialog && event.target instanceof Node && !dialog.contains(event.target)) {
        first?.focus({ preventScroll: true })
      }
    }
    document.addEventListener('focusin', keepFocusInside)
    return () => {
      document.removeEventListener('focusin', keepFocusInside)
      previous?.focus({ preventScroll: true })
    }
  }, [])


  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose()
      if (event.key === 'Tab') {
        const elements = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ) ?? [])]
        if (!elements.length) return
        const first = elements[0]
        const last = elements[elements.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, submitting])

  const otherItems = useMemo(
    () => items.filter(item => item.id !== selected?.id),
    [items, selected?.id],
  )

  const onScroll = (event: UIEvent<HTMLElement>) => {
    const target = event.currentTarget
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 160) loadMore()
  }

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="选择适用片区"
      className="fixed inset-0 z-[150] flex flex-col bg-[#FFFBF5] text-[#28231E]"
      style={{ height: '100dvh' }}
    >
      <header className="shrink-0 pt-[env(safe-area-inset-top)]">
        <div className="grid h-12 grid-cols-[44px_minmax(0,1fr)_44px] items-center px-4">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            aria-label={props.mode === 'code' ? '返回兑换码' : '返回兑换专区'}
            className="flex h-10 w-10 items-center justify-center rounded-full active:bg-[#F7EEE3] disabled:opacity-50"
          >
            <ChevronLeft size={23} strokeWidth={1.9} aria-hidden />
          </button>
          <h1 className="text-center text-[16px] font-semibold">选择适用片区</h1>
        </div>

        {props.mode === 'code' ? (
          <section className="mx-4 mt-[7px] rounded-[15px] border border-[#F2E9DF] bg-white px-[13px] py-[13px] shadow-[0_3px_16px_rgba(70,51,30,.035)]" aria-label="待核兑兑换码">
            <div className="mb-[10px] flex items-center justify-between text-[11px] text-[#99826B]">
              <span>待核兑兑换码</span><span className="font-medium text-[#7B756F]">×1</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[10px] bg-[#FFF2E9] text-[#DF4800]" aria-hidden>
                <Ticket size={28} strokeWidth={1.7} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-5">兑换码兑换卡券</p>
                <p className="mt-1 break-all text-[12px] leading-[19px] text-[#8B8379]">{props.code}</p>
                <p className="mt-[5px] text-[11px] text-[#996B30]">选择片区后确认核兑</p>
              </div>
            </div>
          </section>
        ) : (
          <section className="mx-4 mt-[7px] rounded-[15px] border border-[#F2E9DF] bg-white px-[13px] pb-3 pt-[13px] shadow-[0_3px_16px_rgba(70,51,30,.035)]" aria-label="待兑换券详情">
            <div className="mb-[10px] flex items-center justify-between text-[11px] text-[#99826B]">
              <span>待兑换体验券</span><span className="font-medium text-[#7B756F]">×1</span>
            </div>
            <div className="flex items-center gap-3">
              <img src={props.coupon.image || props.fallbackImage} alt="" className="h-[67px] w-[67px] shrink-0 rounded-[10px] border border-[#F3EFE7] object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold leading-5">{props.coupon.name}</p>
                <p className="mt-1 truncate text-[11px] leading-[17px] text-[#8B8379]">{props.coupon.desc}</p>
                <p className="mt-[7px] text-[11px] font-medium text-[#996B30]">
                  <span className="mr-1 text-[17px] font-bold text-[#DF4800]">{props.coupon.cost}</span>泡泡值
                </p>
              </div>
            </div>
          </section>
        )}

        <div className="px-4 pb-[10px] pt-[15px]">
          <div className="flex h-[46px] items-center gap-[10px] rounded-full border border-[#EEE6DC] bg-white px-[15px] focus-within:border-[#ED9C69]">
            <Search size={19} className="shrink-0 text-[#AAA095]" aria-hidden />
            <input
              type="search"
              aria-label="搜索片区或项目名称"
              placeholder="搜索片区或项目名称"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              value={input}
              onChange={event => setInput(event.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#AFA79F] [&::-webkit-search-cancel-button]:hidden"
            />
            {input && (
              <button type="button" onClick={() => setInput('')} aria-label="清空搜索"
                className="flex h-[25px] w-[25px] shrink-0 items-center justify-center rounded-full bg-[#F3F0EB] text-[#978D84]">
                <X size={14} aria-hidden />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between px-[2px] pt-3 text-[11px] text-[#A3998E]">
            <span>单选一个适用项目</span><span>每次加载 15 条</span>
          </div>
        </div>
      </header>

      <section
        ref={scroller}
        onScroll={onScroll}
        aria-label="片区搜索结果"
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-4"
      >
        <div role="radiogroup" aria-label="选择一个适用片区">
          {selected && (
            <section className="mb-[15px]" aria-label="已选片区">
              <p className="mb-[9px] mt-1 flex items-center gap-[6px] px-[2px] text-[12px] font-semibold text-[#AE662E]">
                <Check size={14} className="text-[#DF4800]" aria-hidden />已选片区 · 搜索后仍保留
              </p>
              <ProjectOption project={selected} checked onChoose={() => setSelected(selected)} />
            </section>
          )}
          <div className="mb-[6px] flex min-h-[29px] items-center justify-between px-[2px] text-[12px]">
            <strong className="font-semibold">搜索结果</strong>
            <span className="text-[11px] text-[#9B9389]">{loading ? '正在搜索…' : `共 ${total} 条`}</span>
          </div>
          {loading && page === 0 ? (
            <div role="status" aria-label="正在加载项目" className="space-y-[9px]">
              {[0, 1, 2].map(n => <div key={n} className="h-[76px] animate-pulse rounded-[13px] border border-[#F3EDE5] bg-[#FBF5EC]" />)}
            </div>
          ) : error ? (
            <div role="alert" className="py-10 text-center text-[13px] text-[#716B64]">
              <p>片区加载失败：{error}</p>
              <button type="button" onClick={reload} className="mt-3 rounded-full border border-[#EBA879] px-5 py-2 text-[#DF4800]">重试</button>
            </div>
          ) : otherItems.length === 0 ? (
            <div className="py-10 text-center">
              <Search size={23} className="mx-auto text-[#B7A48E]" aria-hidden />
              <p className="mt-3 text-[14px] text-[#605950]">没有找到相关片区</p>
              <p className="mt-[6px] text-[12px] leading-5 text-[#AEA49A]">
                换个名称再试试{selected ? '，已选片区仍可继续兑换' : ''}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-[9px]">
              {otherItems.map(item => (
                <ProjectOption key={item.id} project={item} checked={false} onChoose={() => setSelected(item)} />
              ))}
            </div>
          )}
        </div>
        {loadingMore && <p role="status" className="py-4 text-center text-[12px] text-[#AAA299]">正在加载下一页…</p>}
        {loadMoreError && <div role="alert" className="py-4 text-center text-[12px] text-[#716B64]">{loadMoreError}
          <button type="button" onClick={restartRequired ? reload : loadMore} className="ml-2 text-[#DF4800]">重试</button>
        </div>}
        {hasMore && !loadingMore && !loadMoreError && (
          <button type="button" onClick={loadMore} className="w-full py-4 text-center text-[12px] text-[#AA6C42]">
            继续加载下一页
          </button>
        )}
        {!loading && !error && page > 0 && !hasMore &&
          <p className="py-4 text-center text-[11px] text-[#AAA299]">已加载全部 {total} 条项目</p>}
      </section>

      <footer className="shrink-0 border-t border-[#F1E9DF] bg-[#FFFBF5] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        {submitError && <p role="alert" className="mb-2 text-[12px] text-danger-text">{submitError}</p>}
        {props.mode !== 'code' && (
          <>
            {props.coupon.soldOut && <p role="status" className="mb-2 text-[12px] text-danger-text">体验券已兑完</p>}
            {!props.coupon.soldOut && props.balance !== null && props.balance < props.coupon.cost && (
              <p role="status" className="mb-2 text-[12px] text-danger-text">泡泡值不足，暂时无法兑换</p>
            )}
            {!props.coupon.soldOut && props.balance === null && (
              <p role="status" className="mb-2 text-[12px] text-danger-text">当前余额不可用，请稍后重试</p>
            )}
            <div className="mb-3 flex items-baseline justify-between gap-2 text-[12px] text-[#93867A]">
              <span>泡泡值余额 <b className="text-[#38302A]">{props.balance?.toLocaleString() ?? '--'}</b></span>
              <span>本次消耗 <b className="text-[14px] text-[#DF4800]">{props.coupon.cost}</b> 泡泡值</span>
            </div>
          </>
        )}
        <button
          type="button"
          disabled={!selected || submitting || (props.mode !== 'code' && (props.balance === null || props.balance < props.coupon.cost || props.coupon.soldOut))}
          onClick={() => { if (selected) onConfirm(selected.id) }}
          className="h-[49px] w-full rounded-full bg-[#DF4800] text-[15px] font-semibold text-white active:bg-[#C83D00] disabled:bg-[#DCCFC1]"
        >
          {submitting ? '兑换中…' : selected ? '确认兑换' : '请选择适用片区'}
        </button>
      </footer>
    </div>,
    document.body,
  )
}

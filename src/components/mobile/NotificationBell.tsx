import { Bell } from 'lucide-react'

interface NotificationBellProps {
  unreadCount: number
  countLoaded: boolean
  onClick: () => void
  showBadge?: boolean
}

/** A single notice badge for the shared title bar; the API store owns the count. */
export default function NotificationBell({ unreadCount, countLoaded, onClick, showBadge = false }: NotificationBellProps) {
  const hasUnread = showBadge && countLoaded && unreadCount > 0

  return (
    <button
      type="button"
      aria-label={hasUnread ? `通知，${unreadCount} 条未读` : '通知'}
      onClick={onClick}
      className="relative flex h-9 w-9 items-center justify-center rounded-full text-text-primary active:bg-[rgba(89,55,15,0.06)]"
    >
      <Bell className="h-[22px] w-[22px]" aria-hidden />
      {hasUnread && (
        <span
          aria-hidden="true"
          className="absolute right-0 top-0 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#EF4444] px-[3px] text-[10px] font-semibold leading-none tabular-nums text-white"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}

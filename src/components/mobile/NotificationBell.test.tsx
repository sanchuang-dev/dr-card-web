import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import NotificationBell from './NotificationBell'

describe('member-center notification bell', () => {
  it('shows a red unread count, preserves the notice navigation and exposes the real count accessibly', () => {
    const onClick = vi.fn()
    const { container } = render(<NotificationBell unreadCount={8} countLoaded showBadge onClick={onClick} />)
    const button = screen.getByRole('button', { name: '通知，8 条未读' })
    const badge = container.querySelector('span[aria-hidden="true"]')
    expect(button.textContent).toBe('8')
    expect(badge?.textContent).toBe('8')
    expect(badge?.className).toContain('bg-[#EF4444]')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('hides the badge for zero or not-yet-loaded API counts, without displaying a fake zero', () => {
    const { rerender } = render(<NotificationBell unreadCount={0} countLoaded showBadge onClick={() => {}} />)
    expect(screen.getByRole('button', { name: '通知' }).textContent).toBe('')
    rerender(<NotificationBell unreadCount={4} countLoaded={false} showBadge onClick={() => {}} />)
    expect(screen.getByRole('button', { name: '通知' }).textContent).toBe('')
  })

  it('keeps the original uncounted bell on other routes sharing the title bar', () => {
    render(<NotificationBell unreadCount={8} countLoaded onClick={() => {}} />)
    expect(screen.getByRole('button', { name: '通知' }).textContent).toBe('')
  })

  it('caps only the visual number at 99+ while preserving the exact count for accessibility', () => {
    render(<NotificationBell unreadCount={123} countLoaded showBadge onClick={() => {}} />)
    expect(screen.getByRole('button', { name: '通知，123 条未读' }).textContent).toBe('99+')
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import CheckinBoard, { type HomeSignStatusView } from './CheckinBoard'

afterEach(() => { cleanup(); vi.useRealTimers() })

function renderBoard(signStatus?: HomeSignStatusView) {
  render(
    <MemoryRouter>
      <CheckinBoard signStatus={signStatus} />
    </MemoryRouter>,
  )
  return within(screen.getByRole('region', { name: '每日任务' }))
}

describe('每日打卡奖励', () => {
  it('uses the same real sign status points as the 7-day status hint', () => {
    const mission = renderBoard({
      signed: false,
      consecutiveDays: 1,
      points: 10,
      rewardDesc: '',
    })
    expect(mission.getByText(/\+10 泡泡值/)).toBeTruthy()
    expect(mission.queryByText(/\+100 泡泡值/)).toBeNull()
    expect(mission.getByText('待完成')).toBeTruthy()
  })

  it('updates the reward with the returned value after signing in', () => {
    const mission = renderBoard({
      signed: true,
      consecutiveDays: 1,
      points: 20,
      rewardDesc: '',
    })
    expect(mission.getByText(/\+20 泡泡值/)).toBeTruthy()
    expect(mission.getByText('已完成')).toBeTruthy()
  })

  it('does not invent a reward while the sign status is unavailable', () => {
    const mission = renderBoard()
    expect(mission.queryByText(/\+\d+ 泡泡值/)).toBeNull()
  })
})

describe('Issue #220: homepage natural week entry', () => {
  it('shows the actual week count instead of the account streak and navigates straight to the month', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 14, 12))
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={
            <CheckinBoard
              mode="home"
              weekRecordsState="success"
              records={[
                { id: 1, user_id: 3, points: 10, consecutive_days: 20, status: 10, year: '2026', month: '10', day: '12' },
                { id: 2, user_id: 3, points: 10, consecutive_days: 21, status: 20, year: '2026', month: '10', day: '13' },
              ]}
              signStatus={{ signed: false, consecutiveDays: 22, points: 10, rewardDesc: '' }}
            />
          } />
          <Route path="/checkin" element={<div>自然月签到详情</div>} />
        </Routes>
      </MemoryRouter>,
    )
    const entry = screen.getByRole('button', { name: /已签到 2 \/ 7 天，进入本月签到日历/ })
    expect(entry.textContent).toContain('2/7')
    expect(entry.textContent).not.toContain('7/7')
    expect(screen.getByText('周一至周日 · 10/12—10/18')).toBeTruthy()
    fireEvent.click(entry)
    expect(screen.getByText('自然月签到详情')).toBeTruthy()
  })

  it('does not fabricate zero progress or weekly reward when API data is unavailable', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 14, 12))
    render(
      <MemoryRouter>
        <CheckinBoard
          mode="home"
          weekRecordsState="error"
          records={null}
          signStatus={{ signed: true, consecutiveDays: 99, points: 10, rewardDesc: '' }}
        />
      </MemoryRouter>,
    )
    const entry = screen.getByRole('button', { name: '查看本周签到，进入本月签到日历' })
    expect(entry.getAttribute('data-checkin-week-state')).toBe('error')
    expect(entry.textContent).toContain('—/7')
    expect(entry.textContent).toContain('记录暂不可用')
    expect(entry.textContent).not.toContain('已满勤')
    expect(entry.textContent).toContain('周奖励以后台活动规则为准')
  })

  it('renders V8 short day tiles, dates only for today, signed check for earlier dates, and API-driven points', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 14, 12))
    render(
      <MemoryRouter>
        <CheckinBoard
          mode="home"
          weekRecordsState="success"
          records={[
            { id: 1, user_id: 3, points: 10, consecutive_days: 1, status: 10, year: '2026', month: '10', day: '12' },
            { id: 2, user_id: 3, points: 30, consecutive_days: 3, status: 10, year: '2026', month: '10', day: '14' },
          ]}
          signStatus={{ signed: true, consecutiveDays: 3, points: 30, rewardDesc: '' }}
        />
      </MemoryRouter>,
    )

    const today = document.querySelector('[data-checkin-week-day="2026-10-14"]')
    const monday = document.querySelector('[data-checkin-week-day="2026-10-12"]')
    expect(today?.textContent).toContain('14')
    expect(today?.textContent).not.toContain('今天')
    expect(today?.textContent).not.toContain('已签')
    expect(today?.querySelector('svg')).toBeNull()
    expect(today?.className).toContain('min-h-[65px]')
    expect(monday?.querySelector('svg')).not.toBeNull()
    expect(screen.getByText('+30')).toBeTruthy()
    expect(screen.getByText('查看月历')).toBeTruthy()
    expect(screen.queryByText('签到详情')).toBeNull()
    expect(screen.queryByText('签到规则')).toBeNull()
  })

  it('never fills missing daily points with a guessed +10', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 14, 12))
    render(
      <MemoryRouter>
        <CheckinBoard mode="home" weekRecordsState="error" records={null} signStatus={null} />
      </MemoryRouter>,
    )
    const entry = screen.getByRole('button', { name: '查看本周签到，进入本月签到日历' })
    expect(entry.textContent).toContain('—/7')
    expect(entry.textContent).toContain('签到记录暂不可用')
    expect(entry.textContent).toContain('每日签到 · 领取泡泡值')
    expect(entry.textContent).not.toContain('+10')
  })

  it('keeps loading distinct from failure and hides confirmed zero points', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 14, 12))
    render(
      <MemoryRouter>
        <CheckinBoard
          mode="home"
          weekRecordsState="loading"
          records={null}
          signStatus={{ signed: false, consecutiveDays: 0, points: 0, rewardDesc: '' }}
        />
      </MemoryRouter>,
    )

    const entry = screen.getByRole('button', { name: '查看本周签到，进入本月签到日历' })
    expect(entry.textContent).toContain('—/7')
    expect(entry.textContent).toContain('签到记录加载中')
    expect(entry.textContent).not.toContain('签到记录暂不可用')
    expect(entry.textContent).not.toContain('+0')
  })

})

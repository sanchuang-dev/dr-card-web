import { describe, expect, it } from 'vitest'

import { buildCheckinCalendar, buildCycleDays, buildRollingCycleDays, resolveChallengeCompletedDays, resolveWeeklyCompletedDays } from './components/CheckinBoard'

const record = (id: number, createTime: string, status: number) => {
  const [year, month, day] = createTime.slice(0, 10).split('-')
  return {
    id,
    create_time: createTime,
    user_id: 3,
    points: 0,
    consecutive_days: 0,
    status,
    day,
    month,
    year,
  }
}

describe('buildCheckinCalendar', () => {
  it('renders the local month with correct length and week offset', () => {
    // 2026-09：30 天，9 月 1 日是周二（offset = 2）。
    const calendar = buildCheckinCalendar({ today: new Date(2026, 8, 28), records: [] })

    expect(calendar.monthLabel).toBe('2026 年 9 月')
    expect(calendar.days).toHaveLength(30)
    expect(calendar.startOffset).toBe(2)
    expect(calendar.days[0].dateKey).toBe('2026-09-01')
    expect(calendar.days[29].dateKey).toBe('2026-09-30')
  })

  it('handles February in a leap year', () => {
    const calendar = buildCheckinCalendar({ today: new Date(2028, 1, 10), records: [] })

    expect(calendar.monthLabel).toBe('2028 年 2 月')
    expect(calendar.days).toHaveLength(29)
  })

  it('derives done / today / makeup / upcoming from safe records and local today', () => {
    const calendar = buildCheckinCalendar({
      today: new Date(2026, 8, 28),
      records: [record(1, '2026-09-26 09:00:00', 10), record(2, '2026-09-27 09:00:00', 10)],
    })

    const byDay = new Map(calendar.days.map((item) => [item.day, item]))
    expect(byDay.get(26)?.state).toBe('done')
    expect(byDay.get(27)?.state).toBe('done')
    expect(byDay.get(27)?.makeup).toBe(false)
    expect(byDay.get(28)?.state).toBe('today')
    expect(byDay.get(25)?.state).toBe('makeup')
    expect(byDay.get(29)?.state).toBe('upcoming')
  })

  it('marks today as signed when a record exists for the local today', () => {
    const signed = buildCheckinCalendar({
      today: new Date(2026, 8, 28),
      records: [record(1, '2026-09-28 09:00:00', 10)],
    })
    expect(signed.todaySigned).toBe(true)

    const unsigned = buildCheckinCalendar({ today: new Date(2026, 8, 28), records: [] })
    expect(unsigned.todaySigned).toBe(false)
  })

  it('lights up a makeup record on its supplemented date (create_time is the supplemented date)', () => {
    const calendar = buildCheckinCalendar({
      today: new Date(2026, 8, 28),
      records: [record(1, '2026-09-20 00:00:00', 20)],
    })

    const day = calendar.days.find((item) => item.dateKey === '2026-09-20')
    expect(day?.state).toBe('done')
    expect(day?.signed).toBe(true)
    expect(day?.makeup).toBe(true)
  })

  it('attributes a makeup record to its business date even when create_time is today', () => {
    // 今天(9-29)补签 9-20：create_time 是操作时刻 9-29，业务日期字段才是 9-20。
    const calendar = buildCheckinCalendar({
      today: new Date(2026, 8, 29),
      records: [
        {
          id: 7,
          create_time: '2026-09-29 15:57:18',
          user_id: 3,
          points: 0,
          consecutive_days: 0,
          status: 20,
          day: '20',
          month: '09',
          year: '2026',
        },
      ],
    })

    expect(calendar.days.find((item) => item.dateKey === '2026-09-20')?.makeup).toBe(true)

    const today = calendar.days.find((item) => item.dateKey === '2026-09-29')
    expect(today?.makeup).toBe(false)
    expect(today?.signed).toBe(false)
    expect(calendar.todaySigned).toBe(false)
    expect(calendar.litDays).toBe(1)
  })

  it('keeps past missed days static without counting them as signed', () => {
    const calendar = buildCheckinCalendar({
      today: new Date(2026, 8, 28),
      records: [],
    })

    const missed = calendar.days.find((item) => item.dateKey === '2026-09-20')
    expect(missed?.state).toBe('makeup')
    expect(missed?.signed).toBe(false)
  })

  it('lights up optimistic makeup days before the API refresh returns', () => {
    const calendar = buildCheckinCalendar({
      today: new Date(2026, 8, 28),
      records: [],
      optimisticMakeupDays: ['2026-09-20'],
    })

    const day = calendar.days.find((item) => item.dateKey === '2026-09-20')
    expect(day?.state).toBe('done')
    expect(day?.makeup).toBe(true)
    expect(day?.makeupApplied).toBe(true)
  })

  it('does not flag an API-backed day as optimistic', () => {
    const calendar = buildCheckinCalendar({
      today: new Date(2026, 8, 28),
      records: [record(1, '2026-09-20 00:00:00', 20)],
      optimisticMakeupDays: ['2026-09-20'],
    })

    const day = calendar.days.find((item) => item.dateKey === '2026-09-20')
    expect(day?.makeupApplied).toBe(false)
  })

  it('does not treat a makeup record created today as today signed', () => {
    // 文档口径：补签记录的 create_time 是被补签日期；若补的是今天之前，则今天仍未签。
    const calendar = buildCheckinCalendar({
      today: new Date(2026, 8, 28),
      records: [record(1, '2026-09-20 00:00:00', 20)],
    })

    expect(calendar.todaySigned).toBe(false)
    expect(calendar.litDays).toBe(1)
  })

  it('counts lit days as signed days, including today when signed', () => {
    const unsignedToday = buildCheckinCalendar({
      today: new Date(2026, 8, 28),
      records: [record(1, '2026-09-26 09:00:00', 10), record(2, '2026-09-27 09:00:00', 10)],
    })
    // 26、27 已签 = 2；28 今天未签不计入。
    expect(unsignedToday.litDays).toBe(2)
    expect(unsignedToday.todaySigned).toBe(false)

    const signedToday = buildCheckinCalendar({
      today: new Date(2026, 8, 28),
      records: [record(1, '2026-09-26 09:00:00', 10), record(2, '2026-09-28 09:00:00', 10)],
    })
    // 26、28 已签 = 2；今天已签计入，且 state 仍为 today。
    expect(signedToday.litDays).toBe(2)
    expect(signedToday.todaySigned).toBe(true)
    expect(signedToday.days.find((item) => item.dateKey === '2026-09-28')?.state).toBe('today')
  })
})


describe('Issue #220: natural-week model', () => {
  it('shows Monday through Sunday with future dates, never a rolling last-seven-days window', () => {
    const days = buildCycleDays(
      [record(1, '2026-09-26 09:00:00', 10), record(2, '2026-09-27 09:00:00', 10)],
      new Date(2026, 8, 28), // Monday
    )
    expect(days.map((item) => item.dateKey)).toEqual([
      '2026-09-28', '2026-09-29', '2026-09-30',
      '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
    ])
    expect(days[0].state).toBe('today')
    expect(days.slice(1).every((item) => item.state === 'upcoming')).toBe(true)
    expect(resolveWeeklyCompletedDays(days)).toBe(0)
  })

  it('includes seven completed days on Sunday and resets the display on Monday', () => {
    const records = Array.from({ length: 7 }, (_, index) =>
      record(index + 1, `2026-10-${String(5 + index).padStart(2, '0')} 09:00:00`, 10),
    )
    const sunday = buildCycleDays(records, new Date(2026, 9, 11))
    expect(sunday[0].dateKey).toBe('2026-10-05')
    expect(sunday[6].dateKey).toBe('2026-10-11')
    expect(resolveWeeklyCompletedDays(sunday)).toBe(7)

    const monday = buildCycleDays(records, new Date(2026, 9, 12))
    expect(monday[0].dateKey).toBe('2026-10-12')
    expect(monday[6].dateKey).toBe('2026-10-18')
    expect(resolveWeeklyCompletedDays(monday)).toBe(0)
  })

  it('keeps a cross-year natural week and counts valid makeup exactly once', () => {
    const days = buildCycleDays(
      [record(1, '2026-12-31 09:00:00', 20), record(2, '2027-01-01 09:00:00', 10),
        record(3, '2026-12-31 18:00:00', 20)],
      new Date(2027, 0, 2),
    )
    expect(days.map((item) => item.dateKey)).toEqual([
      '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31',
      '2027-01-01', '2027-01-02', '2027-01-03',
    ])
    expect(days[3].makeup).toBe(true)
    expect(resolveWeeklyCompletedDays(days)).toBe(2)
  })

  it('ignores future records and includes an optimistic makeup only for a past day', () => {
    const days = buildCycleDays(
      [record(1, '2026-10-17 09:00:00', 10)],
      new Date(2026, 9, 14),
      ['2026-10-13', '2026-10-16'],
    )
    expect(days[1].makeupApplied).toBe(true)
    expect(days[4].state).toBe('upcoming')
    expect(days[5].signed).toBe(false)
    expect(resolveWeeklyCompletedDays(days)).toBe(1)
  })

  it('does not mistake a 20-day account streak for natural-week progress', () => {
    const days = buildCycleDays([record(1, '2026-10-12 09:00:00', 10)], new Date(2026, 9, 14))
    expect(resolveWeeklyCompletedDays(days)).toBe(1)
    // Old streak resolver remains exclusive to the existing /checkin Hero until #221.
    expect(resolveChallengeCompletedDays({ signed: true, consecutiveDays: 20, points: 5, rewardDesc: '' }, days)).toBe(7)
  })
})

describe('Issue #220: keep detail-page fallback unchanged', () => {
  it('still shows the prior rolling 7-day streak on Monday if status is unavailable', () => {
    const today = new Date(2026, 9, 12)
    const lastSeven = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(2026, 9, 6 + index)
      return record(index + 1, `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')} 09:00:00`, 10)
    })
    expect(resolveWeeklyCompletedDays(buildCycleDays(lastSeven, today))).toBe(1)
    expect(resolveChallengeCompletedDays(null, buildRollingCycleDays(lastSeven, today))).toBe(7)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ fetchSignStatus: vi.fn() }))

vi.mock('../../services/signrecords', () => ({
  fetchSignStatus: mocks.fetchSignStatus,
}))

import { useSignStatus } from './useHomeFeed'

afterEach(() => {
  cleanup()
  mocks.fetchSignStatus.mockReset()
})

describe('Issue #220: home sign status cross-day refresh', () => {
  it('reloads the real status feed and replaces the previous day result', async () => {
    let resolveRefresh!: (value: {
      signed: boolean
      consecutive_days: number
      points: number
      reward_desc: string
    }) => void
    const refresh = new Promise<{
      signed: boolean
      consecutive_days: number
      points: number
      reward_desc: string
    }>((resolve) => { resolveRefresh = resolve })
    mocks.fetchSignStatus
      .mockResolvedValueOnce({
        signed: true,
        consecutive_days: 7,
        points: 10,
        reward_desc: '',
      })
      .mockReturnValueOnce(refresh)

    const { result } = renderHook(() => useSignStatus())

    await waitFor(() => {
      expect(result.current.state).toBe('success')
      if (result.current.state === 'success') expect(result.current.data.signed).toBe(true)
    })

    act(() => result.current.reload())
    expect(result.current.state).toBe('loading')

    await act(async () => {
      resolveRefresh({ signed: false, consecutive_days: 8, points: 10, reward_desc: '' })
      await refresh
    })

    await waitFor(() => {
      expect(result.current.state).toBe('success')
      if (result.current.state === 'success') expect(result.current.data.signed).toBe(false)
    })
    expect(mocks.fetchSignStatus).toHaveBeenCalledTimes(2)
  })
})

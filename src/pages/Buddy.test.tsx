import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  mode: 'api',
  list: vi.fn(),
}))
vi.mock('../app/config/runtime', () => ({ runtimePolicy: { get dataMode() { return mocks.mode } } }))
vi.mock('../services/buddyRelations', () => ({ loadBuddyRelations: mocks.list }))
vi.mock('../app/fixtures/useFixture', () => ({
  useFixtureState: () => ({ raw: null }),
  useFixtureDebug: () => false,
  withFixtureQuery: (path: string) => path,
}))
vi.mock('../app/state/buddies', () => ({
  applyBuddyPreset: vi.fn(),
  ensureBuddyDefaultPreset: vi.fn(),
  useBuddies: () => ({ items: [{ id: 'demo-1', name: '小美' }], count: 1 }),
}))
vi.mock('../components/mobile/DebugPanel', () => ({ default: () => null }))
import Buddy from './Buddy'
afterEach(() => { mocks.mode = 'api'; mocks.list.mockReset() })
function mount() {
  return render(<MemoryRouter><Buddy /></MemoryRouter>)
}

describe('buddy list backend truth', () => {
  it('shows only backend-returned nickname and empty avatar fallback in API mode', async () => {
    mocks.list.mockResolvedValue([{ id: 'server-1', nickname: '服务端好友', avatarUrl: null }])
    mount()
    await waitFor(() => expect(screen.getByText('服务端好友')).toBeTruthy())
    expect(screen.queryByText('小美')).toBeNull()
    expect(screen.getByLabelText('我的洗头搭子')).toBeTruthy()
  })

  it('keeps refresh as a light inline action in the buddy section header', async () => {
    mocks.list.mockResolvedValue([{ id: 'server-1', nickname: 'HuangChao', avatarUrl: null }])
    mount()
    await waitFor(() => expect(screen.getByText('HuangChao')).toBeTruthy())
    const toolbar = screen.getByLabelText('搭子列表操作')
    expect(within(toolbar).getByRole('heading', { name: '我的搭子' })).toBeTruthy()
    const refresh = within(toolbar).getByRole('button', { name: '刷新搭子列表' })
    expect(refresh.textContent).toBe('刷新')
    expect(refresh.className).toContain('bg-transparent')
    expect(refresh.classList.contains('border')).toBe(false)
    expect(toolbar.nextElementSibling?.getAttribute('aria-label')).toBe('我的洗头搭子')
    expect(screen.getAllByRole('button', { name: '刷新搭子列表' })).toHaveLength(1)
  })

  it('treats server empty relations as an actual empty state', async () => {
    mocks.list.mockResolvedValue([])
    mount()
    await waitFor(() => expect(screen.getByText('还没有洗头搭子噢～')).toBeTruthy())
    expect(screen.queryByText('小美')).toBeNull()
    expect(screen.getByLabelText('搭子列表操作')).toBeTruthy()
    expect(screen.getByRole('button', { name: '刷新搭子列表' })).toBeTruthy()
  })

  it('refreshes real list after an accepted relation without local fixtures', async () => {
    mocks.list.mockResolvedValueOnce([{ id: 'server-1', nickname: '原好友', avatarUrl: null }])
      .mockResolvedValueOnce([
        { id: 'server-1', nickname: '原好友', avatarUrl: null },
        { id: 'server-2', nickname: '新搭子', avatarUrl: null },
      ])
    mount()
    await waitFor(() => expect(screen.getByText('原好友')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: '刷新搭子列表' }))
    await waitFor(() => expect(screen.getByText('新搭子')).toBeTruthy())
    expect(mocks.list).toHaveBeenCalledTimes(2)
  })

  it('allows retry after backend failure; never falls back to a mocked buddy', async () => {
    mocks.list.mockRejectedValueOnce(new Error('后台接口未接通'))
      .mockResolvedValueOnce([{ id: 'server-2', nickname: '恢复后的好友', avatarUrl: null }])
    mount()
    await waitFor(() => expect(screen.getByText('后台接口未接通')).toBeTruthy())
    expect(screen.queryByText('小美')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '重试加载' }))
    await waitFor(() => expect(screen.getByText('恢复后的好友')).toBeTruthy())
    expect(mocks.list).toHaveBeenCalledTimes(2)
  })

  it('marks fixture data as demo-only when using mock mode', async () => {
    mocks.mode = 'mock'
    mount()
    expect(screen.getByText('演示搭子资料，非真实账号关系')).toBeTruthy()
    expect(screen.getByText('小美')).toBeTruthy()
    expect(screen.queryByLabelText('搭子列表操作')).toBeNull()
    expect(mocks.list).not.toHaveBeenCalled()
  })
})

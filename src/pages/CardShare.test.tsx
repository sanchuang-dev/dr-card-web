import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

const mocks = vi.hoisted(() => ({ mode: 'api', relations: vi.fn() }))
vi.mock('../app/config/runtime', () => ({ runtimePolicy: { get dataMode() { return mocks.mode } } }))
vi.mock('../services/buddyRelations', () => ({ loadBuddyRelations: mocks.relations }))
vi.mock('../components/mobile/DebugPanel', () => ({ default: () => null }))
vi.mock('../components/mobile/PageContainer', () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

import CardShare from './CardShare'

const people = [
  { id: '19', nickname: '南沙搭子阿明', avatarUrl: null },
  { id: '22', nickname: '天河搭子小芳', avatarUrl: 'https://example.com/avatar.jpg' },
]

const mount = (url = '/card/share?coupon=91001') => render(
  <MemoryRouter initialEntries={[url]}><CardShare /></MemoryRouter>,
)
afterEach(() => { mocks.mode = 'api'; mocks.relations.mockReset() })

describe('card transfer only prepares a real buddy recipient', () => {
  it('reads current authenticated buddies, never the old fixture names, and never claims transfer succeeded', async () => {
    mocks.relations.mockResolvedValue(people)
    mount()
    expect(screen.getByText('正在加载我的搭子…')).toBeTruthy()
    expect(await screen.findByRole('radio', { name: '南沙搭子阿明' })).toBeTruthy()
    expect(mocks.relations).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('小美')).toBeNull()
    expect(screen.getByRole('button', { name: '确认选择' }).hasAttribute('disabled')).toBe(true)

    fireEvent.click(screen.getByRole('radio', { name: '南沙搭子阿明' }))
    fireEvent.change(screen.getByPlaceholderText('搜索我的搭子'), { target: { value: '天河' } })
    expect(within(screen.getByLabelText('已选搭子')).getByRole('radio', { name: '南沙搭子阿明' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: '天河搭子小芳' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '确认选择' }))
    expect(screen.getByText('已选择「南沙搭子阿明」。转赠接口尚未接入，卡券没有转出。')).toBeTruthy()
    expect(screen.queryByText('分享成功')).toBeNull()
    expect(mocks.relations).toHaveBeenCalledTimes(1)
  })

  it('keeps selection when keyword finds nobody, then changes it only on a real click', async () => {
    mocks.relations.mockResolvedValue(people)
    mount()
    fireEvent.click(await screen.findByRole('radio', { name: '南沙搭子阿明' }))
    fireEvent.change(screen.getByPlaceholderText('搜索我的搭子'), { target: { value: '不存在' } })
    expect(screen.getByText('没有匹配的搭子，已选搭子仍保留')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('搜索我的搭子'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('radio', { name: '天河搭子小芳' }))
    expect(within(screen.getByLabelText('已选搭子')).getByRole('radio', { name: '天河搭子小芳' })).toBeTruthy()
    expect(screen.queryByText('分享成功')).toBeNull()
  })

  it('shows empty and failure states without falling back to fixture relations', async () => {
    mocks.relations.mockRejectedValueOnce(new Error('登录搭子服务暂不可用')).mockResolvedValueOnce([])
    mount()
    expect(await screen.findByText('登录搭子服务暂不可用')).toBeTruthy()
    expect(screen.queryByText('小美')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '重新加载' }))
    await waitFor(() => expect(screen.getByText('暂无搭子，可先去「洗头搭子」添加好友')).toBeTruthy())
    expect(mocks.relations).toHaveBeenCalledTimes(2)
  })

  it('does not request buddies or invent a coupon when link has no coupon ID', () => {
    mount('/card/share')
    expect(screen.getByText('未选择待转赠卡券，请从卡包点击「转赠」进入')).toBeTruthy()
    expect(mocks.relations).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '确认选择' })).toBeNull()
  })

  it('clearly labels mock-only preview relations and never calls real list service', async () => {
    mocks.mode = 'mock'
    mount()
    expect(await screen.findByText('演示搭子，仅用于 UI 预览；非真实账号')).toBeTruthy()
    expect(screen.getByRole('radio', { name: '小美' })).toBeTruthy()
    expect(mocks.relations).not.toHaveBeenCalled()
  })
})

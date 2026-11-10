import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

const mocks = vi.hoisted(() => ({
  mode: 'api',
  relations: vi.fn(),
  give: vi.fn(),
}))

vi.mock('../app/config/runtime', () => ({ runtimePolicy: { get dataMode() { return mocks.mode } } }))
vi.mock('../services/buddyRelations', () => ({ loadBuddyRelations: mocks.relations }))
vi.mock('../services/couponGift', () => ({ giveCoupon: mocks.give }))
vi.mock('../components/mobile/DebugPanel', () => ({ default: () => null }))
vi.mock('../components/mobile/PageContainer', () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

import CardShare from './CardShare'

const people = [
  { id: '19', nickname: '南沙搭子阿明', avatarUrl: null },
  { id: '22', nickname: '天河搭子小芳', avatarUrl: 'https://example.com/avatar.jpg' },
]

const mount = (
  url: string | { pathname: string; search?: string; state?: unknown } = '/card/share?coupon=91001',
) => render(
  <MemoryRouter initialEntries={[url]}><CardShare /></MemoryRouter>,
)

afterEach(() => {
  mocks.mode = 'api'
  mocks.relations.mockReset()
  mocks.give.mockReset()
})

describe('card transfer uses the confirmed give API', () => {
  it('loads authenticated buddies, posts the coupon log ID and friend user ID, then shows success', async () => {
    mocks.relations.mockResolvedValue(people)
    mocks.give.mockResolvedValue({ log_id: 91001, friend_id: 19 })
    mount()

    expect(screen.getByText('正在加载我的搭子…')).toBeTruthy()
    expect(await screen.findByRole('radio', { name: '南沙搭子阿明' })).toBeTruthy()
    expect(mocks.relations).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('小美')).toBeNull()
    expect(screen.getByRole('button', { name: '确认转赠' }).hasAttribute('disabled')).toBe(true)

    fireEvent.click(screen.getByRole('radio', { name: '南沙搭子阿明' }))
    fireEvent.click(screen.getByRole('button', { name: '确认转赠' }))

    await waitFor(() => {
      expect(mocks.give).toHaveBeenCalledWith({ logId: '91001', friendId: '19' })
    })
    expect(await screen.findByRole('heading', { level: 2, name: '转赠成功' })).toBeTruthy()
    expect(screen.getByText('已成功转赠给「南沙搭子阿明」')).toBeTruthy()
    expect(screen.getByRole('button', { name: '查看我的卡包' })).toBeTruthy()
    expect(mocks.relations).toHaveBeenCalledTimes(1)
  })

  it('keeps the selected recipient while searching and only replaces it on a real click', async () => {
    mocks.relations.mockResolvedValue(people)
    mount()
    fireEvent.click(await screen.findByRole('radio', { name: '南沙搭子阿明' }))
    fireEvent.change(screen.getByPlaceholderText('搜索我的搭子'), { target: { value: '不存在' } })
    expect(screen.getByText('没有匹配的搭子，已选搭子仍保留')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('搜索我的搭子'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('radio', { name: '天河搭子小芳' }))
    expect(within(screen.getByLabelText('已选搭子')).getByRole('radio', { name: '天河搭子小芳' })).toBeTruthy()
    expect(mocks.give).not.toHaveBeenCalled()
    expect(screen.queryByText('转赠成功')).toBeNull()
  })

  it('disables the screen while submitting and never posts twice', async () => {
    mocks.relations.mockResolvedValue(people)
    let resolveGift: (value: { log_id: number; friend_id: number }) => void = () => {}
    mocks.give.mockImplementation(() => new Promise((resolve) => { resolveGift = resolve }))
    mount()

    fireEvent.click(await screen.findByRole('radio', { name: '南沙搭子阿明' }))
    fireEvent.click(screen.getByRole('button', { name: '确认转赠' }))
    const submittingButton = await screen.findByRole('button', { name: '正在转赠…' })
    expect(submittingButton.hasAttribute('disabled')).toBe(true)
    expect(screen.getByPlaceholderText('搜索我的搭子').hasAttribute('disabled')).toBe(true)

    fireEvent.click(submittingButton)
    expect(mocks.give).toHaveBeenCalledTimes(1)

    resolveGift({ log_id: 91001, friend_id: 19 })
    expect(await screen.findByRole('heading', { level: 2, name: '转赠成功' })).toBeTruthy()
  })

  it('shows the backend business reason and keeps the recipient for a retry', async () => {
    const { AppError } = await import('../lib/appError')
    mocks.relations.mockResolvedValue(people)
    mocks.give.mockRejectedValue(new AppError({
      kind: 'business',
      message: '对方未绑定手机号，无法赠送',
    }))
    mount()

    fireEvent.click(await screen.findByRole('radio', { name: '南沙搭子阿明' }))
    fireEvent.click(screen.getByRole('button', { name: '确认转赠' }))

    expect(await screen.findByText('对方未绑定手机号，无法赠送')).toBeTruthy()
    expect(within(screen.getByLabelText('已选搭子')).getByRole('radio', { name: '南沙搭子阿明' })).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 2, name: '转赠成功' })).toBeNull()

    fireEvent.click(screen.getByRole('radio', { name: '天河搭子小芳' }))
    expect(screen.queryByText('对方未绑定手机号，无法赠送')).toBeNull()
  })

  it('maps transport failures to actionable copy instead of a false success', async () => {
    const { AppError } = await import('../lib/appError')
    mocks.relations.mockResolvedValue(people)
    mocks.give.mockRejectedValue(new AppError({ kind: 'network', message: 'Network Error' }))
    mount()

    fireEvent.click(await screen.findByRole('radio', { name: '南沙搭子阿明' }))
    fireEvent.click(screen.getByRole('button', { name: '确认转赠' }))

    expect(await screen.findByText('网络异常，请检查网络后重试')).toBeTruthy()
    expect(screen.queryByRole('heading', { level: 2, name: '转赠成功' })).toBeNull()
  })

  it('shows the coupon preview captured from the card pack on the success screen', async () => {
    mocks.relations.mockResolvedValue(people)
    mocks.give.mockResolvedValue({ log_id: 91001, friend_id: 19 })
    mount({
      pathname: '/card/share',
      search: '?coupon=91001',
      state: {
        couponPreview: {
          name: '新人体验活动',
          amountLabel: '¥30.00',
          validityLabel: '2026-10-30 到期',
        },
      },
    })

    fireEvent.click(await screen.findByRole('radio', { name: '南沙搭子阿明' }))
    fireEvent.click(screen.getByRole('button', { name: '确认转赠' }))

    expect(await screen.findByText('新人体验活动')).toBeTruthy()
    expect(screen.getByText('¥30.00 · 2026-10-30 到期')).toBeTruthy()
  })

  it('shows empty and failure states without falling back to fixture relations', async () => {
    mocks.relations.mockRejectedValueOnce(new Error('登录搭子服务暂不可用')).mockResolvedValueOnce([])
    mount()
    expect(await screen.findByText('登录搭子服务暂不可用')).toBeTruthy()
    expect(screen.queryByText('小美')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '重新加载' }))
    await waitFor(() => expect(screen.getByText('暂无搭子，可先去「洗头搭子」添加好友')).toBeTruthy())
    expect(mocks.relations).toHaveBeenCalledTimes(2)
    expect(mocks.give).not.toHaveBeenCalled()
  })

  it('does not request buddies or invent a coupon when the link has no coupon ID', () => {
    mount('/card/share')
    expect(screen.getByText('未选择待转赠卡券，请从卡包点击「转赠」进入')).toBeTruthy()
    expect(mocks.relations).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '确认转赠' })).toBeNull()
  })

  it('keeps mock-only preview relations clearly labelled and never calls the real list service', async () => {
    mocks.mode = 'mock'
    mount()
    expect(await screen.findByText('演示搭子，仅用于 UI 预览；非真实账号')).toBeTruthy()
    expect(screen.getByRole('radio', { name: '小美' })).toBeTruthy()
    expect(mocks.relations).not.toHaveBeenCalled()
  })
})

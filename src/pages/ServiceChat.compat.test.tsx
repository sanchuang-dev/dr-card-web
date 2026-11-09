import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

vi.mock('../app/config/runtime', async original => {
  const actual = await original<typeof import('../app/config/runtime')>()
  return { ...actual, runtimePolicy: { ...actual.runtimePolicy, dataMode: 'mock' } }
})
vi.mock('../app/fixtures/useFixture', () => ({
  useFixtureState: () => ({ state: null }),
}))
vi.mock('../app/router/routes', () => ({
  findRouteByPathname: () => ({ path: '/service/chat' }),
}))
vi.mock('../components/mobile/DebugPanel', () => ({ default: () => null }))
vi.mock('../components/mobile/PageContainer', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
vi.mock('../components/mobile/ChatMessageList', () => ({
  default: () => <div>欢迎聊天</div>,
}))
vi.mock('../components/mobile/WecomQrPlaceholder', () => ({
  default: () => <div>原企微二维码区域</div>,
}))
vi.mock('../components/ui', async original => {
  const actual = await original<typeof import('../components/ui')>()
  return { ...actual, BottomSheet: ({ open, children, actions }: {
    open: boolean; children: ReactNode; actions: ReactNode
  }) => open ? <div role="dialog">{children}{actions}</div> : null }
})

import ServiceChat from './ServiceChat'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('legacy/mock ServiceChat compatibility', () => {
  it('restores the original human button without opening the separate WeCom QR', () => {
    render(<MemoryRouter initialEntries={['/service/chat']}><ServiceChat /></MemoryRouter>)
    const button = screen.getByRole('button', { name: '人工' }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    fireEvent.click(button)
    expect(document.querySelector('[data-human-stage]')?.getAttribute('data-human-stage')).toBe('queuing')
    expect(button.disabled).toBe(true)
    expect((screen.getByRole('button', { name: '发送' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText('原企微二维码区域')).toBeNull()
  })

  it('keeps a pending message unsent when the user switches to a human queue', () => {
    render(<MemoryRouter initialEntries={['/service/chat']}><ServiceChat /></MemoryRouter>)
    const input = screen.getByRole('textbox', { name: '输入你的问题' }) as HTMLInputElement
    fireEvent.change(input, { target: { value: '待发送的问题' } })
    const sendButton = screen.getByRole('button', { name: '发送' }) as HTMLButtonElement
    expect(sendButton.disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '人工' }))
    expect(sendButton.disabled).toBe(true)
    fireEvent.click(sendButton)
    expect(input.value).toBe('待发送的问题')
  })

  it('keeps mock AI input available and original typed 人工 transfer reachable', () => {
    render(<MemoryRouter initialEntries={['/service/chat']}><ServiceChat /></MemoryRouter>)
    const input = screen.getByRole('textbox', { name: '输入你的问题' }) as HTMLInputElement
    expect(input.disabled).toBe(false)
    fireEvent.change(input, { target: { value: '你好' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    expect(document.querySelector('[data-human-stage]')?.getAttribute('data-human-stage')).toBe('idle')

    fireEvent.change(input, { target: { value: '人工' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    expect(document.querySelector('[data-human-stage]')?.getAttribute('data-human-stage')).toBe('queuing')
    expect(input.disabled).toBe(true)
  })

  it('keeps the previous #wecom deep link working', () => {
    render(<MemoryRouter initialEntries={['/service/chat#wecom']}><ServiceChat /></MemoryRouter>)
    expect(screen.getByText('原企微二维码区域')).toBeTruthy()
  })
})

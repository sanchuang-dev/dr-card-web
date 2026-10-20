import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createBridge: vi.fn(),
}))

vi.mock('../services/sso/mallSso', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/sso/mallSso')>()
  return { ...actual, createMallSsoBridge: mocks.createBridge }
})

import MallWebView from './MallWebView'
import { MALL_SHOPS } from '../services/sso/mallSso'

function setup() {
  const dispose = vi.fn()
  mocks.createBridge.mockReturnValue({ dispose })
  const view = render(<MallWebView target="kbs_shop" />)
  const iframe = screen.getByTitle('卡博士商城') as HTMLIFrameElement
  return { view, iframe, dispose }
}

describe('MallWebView', () => {
  it('loads the configured shop /h5 entry after attaching the SSO bridge', async () => {
    const { iframe } = setup()

    await waitFor(() => expect(iframe.src).toBe(MALL_SHOPS.kbs_shop.url))
    expect(mocks.createBridge).toHaveBeenCalledWith(
      iframe,
      'kbs_shop',
      expect.objectContaining({
        onSsoError: expect.any(Function),
        onSsoResult: expect.any(Function),
      }),
    )
    expect(screen.getByText('商城加载中…')).toBeTruthy()
    expect(screen.getByText('商城加载中…').closest('[data-mall-target]')).toBeTruthy()
  })

  it('stops showing the loading state once the shop reports load', async () => {
    const { iframe } = setup()
    await waitFor(() => expect(iframe.src).toBe(MALL_SHOPS.kbs_shop.url))

    fireEvent.load(iframe)

    await waitFor(() => expect(screen.queryByText('商城加载中…')).toBeNull())
  })

  it('shows a retry state when the mall reports an SSO failure', async () => {
    const { iframe } = setup()
    await waitFor(() => expect(iframe.src).toBe(MALL_SHOPS.kbs_shop.url))

    const options = mocks.createBridge.mock.calls[0][2] as {
      onSsoError: (error: { code: string; message: string }) => void
    }
    act(() => {
      options.onSsoError({ code: 'SSO_TICKET_EXPIRED', message: '登录凭证已失效' })
    })

    expect(screen.getByText('商城登录未完成，请重试')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '重试' }))

    await waitFor(() => expect(mocks.createBridge).toHaveBeenCalledTimes(2))
  })

  it('uses the second shop origin and /h5 entry when selected', async () => {
    mocks.createBridge.mockReturnValue({ dispose: vi.fn() })
    render(<MallWebView target="kbs_shop2" />)

    const iframe = screen.getByTitle('卡博士商城') as HTMLIFrameElement
    await waitFor(() => expect(iframe.src).toBe(MALL_SHOPS.kbs_shop2.url))
    expect(mocks.createBridge).toHaveBeenCalledWith(
      iframe,
      'kbs_shop2',
      expect.any(Object),
    )
  })
})

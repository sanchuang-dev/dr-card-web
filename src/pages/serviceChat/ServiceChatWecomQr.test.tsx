import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('../../services/welfareOfficer', () => ({
  fetchWelfareOfficerConfig: mocks.fetch,
}))

import ServiceChatWecomQr from './ServiceChatWecomQr'

afterEach(() => mocks.fetch.mockReset())

describe('real WeCom QR in API service chat', () => {
  it('loads the actual welfare-configured image, never a fake QR', async () => {
    mocks.fetch.mockResolvedValue({
      configured: true, title: '福利官', subtitle: '诗得丽品牌福利官',
      qrcodeUrl: 'https://oss.example.com/qr.png', qrcodeUnavailable: false, benefits: [],
    })
    render(<ServiceChatWecomQr />)
    const image = await screen.findByRole('img', { name: '企业微信福利官二维码' })
    expect(image.getAttribute('src')).toBe('https://oss.example.com/qr.png')
    expect(screen.getByText('诗得丽品牌福利官')).toBeTruthy()
    expect(screen.queryByText('QR Placeholder')).toBeNull()
    expect(mocks.fetch).toHaveBeenCalledOnce()
  })

  it('does not show a fake or broken QR when backend has no usable URL', async () => {
    mocks.fetch.mockResolvedValue({
      configured: true, title: '福利官', subtitle: '',
      qrcodeUrl: undefined, qrcodeUnavailable: true, benefits: [],
    })
    render(<ServiceChatWecomQr />)
    expect(await screen.findByText('二维码图片地址不可用')).toBeTruthy()
    expect(screen.queryByRole('img', { name: '企业微信福利官二维码' })).toBeNull()
  })

  it('distinguishes an empty configuration from the loading state', async () => {
    mocks.fetch.mockResolvedValue({
      configured: false, title: '', subtitle: '',
      qrcodeUrl: undefined, qrcodeUnavailable: false, benefits: [],
    })
    render(<ServiceChatWecomQr />)
    expect(await screen.findByText('暂未配置企业微信二维码')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('retries the configuration API after a network error', async () => {
    mocks.fetch.mockRejectedValueOnce(new Error('网络错误')).mockResolvedValueOnce({
      configured: true, title: '福利官', subtitle: '',
      qrcodeUrl: 'https://oss.example.com/retry.png', qrcodeUnavailable: false, benefits: [],
    })
    render(<ServiceChatWecomQr />)
    expect(await screen.findByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() => expect(screen.getByRole('img', { name: '企业微信福利官二维码' }).getAttribute('src')).toBe('https://oss.example.com/retry.png'))
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
  })

  it('reports broken image data rather than hiding the broken image icon', async () => {
    mocks.fetch.mockResolvedValue({
      configured: true, title: '福利官', subtitle: '',
      qrcodeUrl: 'https://oss.example.com/broken.png', qrcodeUnavailable: false, benefits: [],
    })
    render(<ServiceChatWecomQr />)
    const image = await screen.findByRole('img', { name: '企业微信福利官二维码' })
    fireEvent.error(image)
    expect(await screen.findByText('二维码图片加载失败')).toBeTruthy()
    expect(screen.queryByRole('img', { name: '企业微信福利官二维码' })).toBeNull()
  })
})

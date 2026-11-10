import { afterEach, describe, expect, it, vi } from 'vitest'
import QRCode from 'qrcode'
import { createBuddyPoster, renderBuddyQrPng } from './buddyQrPoster'

const png = 'data:image/png;base64,cXJpbWFnZQ=='

afterEach(() => vi.restoreAllMocks())

describe('buddy QR image and poster encoding', () => {
  it('uses a real QR encoder configured with a four-module quiet zone', async () => {
    const toDataURL = vi.spyOn(QRCode, 'toDataURL').mockImplementation((() => Promise.resolve(png)) as typeof QRCode.toDataURL)
    expect(await renderBuddyQrPng('https://card.example.org/buddy/invite/scan?token=xyz')).toBe(png)
    expect(toDataURL).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      width: 512,
      margin: 4,
      type: 'image/png',
    }))
  })

  it('creates a matrix from the complete URL (not the user ID)', () => {
    const url = 'https://card.example.org/buddy/invite/scan?token=trusted-opaque-url'
    const qr = QRCode.create(url, { errorCorrectionLevel: 'M' })
    expect(qr.modules.size).toBeGreaterThan(20)
    expect(qr.modules.data.some(value => value === 1)).toBe(true)
    expect(qr.modules.data.some(value => value === 0)).toBe(true)
  })

  it('uses the exact QR PNG visible on the invite page and exports base64 PNG to Native', async () => {
    let requestedSrc: string | undefined
    class MockImage {
      onload?: () => void
      onerror?: () => void
      set src(value: string) {
        requestedSrc = value
        queueMicrotask(() => this.onload?.())
      }
    }
    vi.stubGlobal('Image', MockImage)
    const context = {
      fillStyle: '',
      textAlign: '',
      textBaseline: '',
      font: '',
      fillRect: vi.fn(),
      fillText: vi.fn(),
      drawImage: vi.fn(),
    }
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(context as unknown as CanvasRenderingContext2D)
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/png;base64,cG9zdGVyLWJ5dGVz')

    const poster = await createBuddyPoster(png, { demo: true })
    expect(requestedSrc).toBe(png)
    expect(context.drawImage).toHaveBeenCalledWith(expect.any(MockImage), 160, 335, 640, 640)
    expect(context.fillText).toHaveBeenCalledWith('极地种子 · 洗头搭子', 480, 175, 870)
    expect(context.fillText).toHaveBeenCalledWith('请在卡博士 App 内使用「极地种子扫一扫」', 480, 1045, 870)
    expect(context.fillText.mock.calls.some(([text]) => String(text).includes('诗得丽'))).toBe(false)
    expect(context.fillText).toHaveBeenCalledWith(expect.stringContaining('演示二维码'), 480, 1166, 870)
    expect(poster).toEqual({
      imageType: 'base64',
      imageData: 'cG9zdGVyLWJ5dGVz',
      fileName: 'buddy-invite-poster.png',
    })
    expect(toDataURL).toHaveBeenCalledWith('image/png')
    getContext.mockRestore()
    vi.unstubAllGlobals()
  })

  it('fails closed for malformed QR source, canvas unavailable and export failures', async () => {
    await expect(createBuddyPoster('not-a-png-url', { demo: false })).rejects.toThrow('格式')
    class MockImage {
      onload?: () => void
      set src(_value: string) { queueMicrotask(() => this.onload?.()) }
    }
    vi.stubGlobal('Image', MockImage)
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    await expect(createBuddyPoster(png, { demo: false })).rejects.toThrow('绘制')
    getContext.mockRestore()
    vi.unstubAllGlobals()
  })
})

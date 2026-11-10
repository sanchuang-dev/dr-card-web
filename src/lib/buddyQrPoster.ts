import type { InvitePosterPayload } from '../app/adapters/buddyShare'

const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/

/** 成熟 QR 编码器。二维码内容仅使用已校验、来自服务端或隔离演示的数据。 */
export async function renderBuddyQrPng(url: string): Promise<string> {
  // 仅邀请二维码页面需要编码器；不让全站首次加载背上 QR 库。
  const { default: QRCode } = await import('qrcode')
  const image = await QRCode.toDataURL(url, {
    type: 'image/png',
    width: 512,
    margin: 4, // ISO 推荐静区 4 模块；勿用品牌纹饰覆盖。
    errorCorrectionLevel: 'M',
    color: { dark: '#123b3d', light: '#ffffff' },
  })
  if (!PNG_DATA_URL.test(image)) throw new Error('无法生成二维码图片')
  return image
}

function loadDataUrlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('二维码图片载入失败'))
    image.src = src
  })
}

function drawCentered(
  ctx: CanvasRenderingContext2D,
  value: string,
  y: number,
  font: string,
  color: string,
) {
  ctx.fillStyle = color
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(value, 480, y, 870)
}

/**
 * 以显示在 H5 的同一张 PNG QR 原图合成海报，不重新编码其他 payload。
 * 不使用外部头像/网络图片，避免 canvas 污染及未经许可写入其他用户资料。
 */
export async function createBuddyPoster(
  qrImageDataUrl: string,
  options: { demo: boolean },
): Promise<InvitePosterPayload> {
  if (!PNG_DATA_URL.test(qrImageDataUrl)) throw new Error('二维码图片格式不正确')
  const qr = await loadDataUrlImage(qrImageDataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = 960
  canvas.height = 1280
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前环境无法绘制海报')

  ctx.fillStyle = '#e7f2ef'
  ctx.fillRect(0, 0, 960, 1280)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(60, 60, 840, 1160)

  drawCentered(ctx, '极地种子 · 洗头搭子', 175, 'bold 46px sans-serif', '#174749')
  drawCentered(ctx, '快来成为我的洗头搭子吧～', 253, '34px sans-serif', '#345d5c')

  // 白底 + 静区全部在同一张 QR 原图内；勿在二维码上添加水印。
  ctx.drawImage(qr, 160, 335, 640, 640)

  drawCentered(ctx, '请在卡博士 App 内使用「极地种子扫一扫」', 1045, '29px sans-serif', '#345d5c')
  drawCentered(ctx, '扫码后确认，才能成为洗头搭子', 1100, '24px sans-serif', '#758a86')
  if (options.demo) {
    drawCentered(ctx, '演示二维码 · 无法建立真实关系', 1166, 'bold 26px sans-serif', '#ba5d35')
  }

  const png = canvas.toDataURL('image/png')
  const encoded = PNG_DATA_URL.exec(png)
  if (!encoded) throw new Error('海报导出失败')

  return {
    imageType: 'base64',
    imageData: encoded[1],
    fileName: 'buddy-invite-poster.png',
  }
}

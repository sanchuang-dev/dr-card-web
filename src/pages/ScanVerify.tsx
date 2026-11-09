import { useEffect, useState } from 'react'
import { ScanLine } from 'lucide-react'
import HostCloseButton from '../components/mobile/HostCloseButton'
import {
  getNativeBridgeDiagnostics,
  NativeBridgeError,
  scanCode,
} from '../services/nativeBridge'

export default function ScanVerify() {
  const [supported, setSupported] = useState(
    () => getNativeBridgeDiagnostics().capabilities.scanCode,
  )
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (supported) return

    const refreshSupport = () => {
      setSupported(getNativeBridgeDiagnostics().capabilities.scanCode)
    }

    const intervalId = window.setInterval(refreshSupport, 500)
    window.addEventListener('focus', refreshSupport)
    window.addEventListener('pageshow', refreshSupport)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshSupport)
      window.removeEventListener('pageshow', refreshSupport)
    }
  }, [supported])

  const handleScan = async () => {
    if (!supported || scanning) return

    setScanning(true)
    setError(null)

    try {
      const result = await scanCode({ scanType: 'qr' })

      if (
        result.isDevice === true ||
        (typeof result.consumeUse === 'string' && result.consumeUse.length > 0)
      ) {
        setError('已识别设备二维码，请按 App 设备页面提示操作')
      } else if (result.isDevice === false) {
        // H5 仓库和已读后台合同没有定义可验证的卡券二维码格式；不把任意非设备码当核销码。
        setError('暂不支持此卡券核销码，未发起核销')
      } else {
        // use=17 的 Native 回调只有 text / scanType；缺少业务类型时不伪造核销成功。
        setError('当前扫码结果无法验证为卡券核销码，未发起核销')
      }
    } catch (error) {
      if (error instanceof NativeBridgeError) {
        if (error.code === 'native-cancelled') {
          setError('已取消扫码')
        } else if (error.code === 'native-permission-denied') {
          setError('请允许相机权限后重试')
        } else {
          setError('扫码失败，请重试')
        }
      } else {
        setError('扫码失败，请重试')
      }
    } finally {
      setScanning(false)
    }
  }

  const statusCopy = !supported
    ? '当前 App 版本暂不支持扫码'
    : scanning
      ? '正在调用系统扫码…'
      : error ?? '将卡券二维码对准扫描框，点击开始扫码'

  return (
    <div className="relative min-h-full bg-black text-white">
      <HostCloseButton tone="inverse" className="absolute left-2 top-2 z-30" />
      <main className="relative flex flex-col items-center px-5">
        <div
          className="absolute left-0 right-0 top-1/2 h-72 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.12)_0%,transparent_70%)]"
          aria-hidden
        />

        <div
          className="relative z-10 mt-6 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm"
          role="status"
          aria-live="polite"
        >
          <ScanLine className="h-4 w-4" />
          <span>{statusCopy}</span>
        </div>

        <button
          type="button"
          onClick={handleScan}
          disabled={!supported || scanning}
          aria-label={supported ? '开始扫码核销' : '当前 App 版本暂不支持扫码'}
          data-native-scan-supported={supported ? 'true' : 'false'}
          className="relative z-10 mx-auto mt-8 aspect-square w-[260px] max-w-[75vw] disabled:cursor-default disabled:opacity-60"
        >
          <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-2xl border-l-4 border-t-4 border-white/90" aria-hidden />
          <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-2xl border-r-4 border-t-4 border-white/90" aria-hidden />
          <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-2xl border-b-4 border-l-4 border-white/90" aria-hidden />
          <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-2xl border-b-4 border-r-4 border-white/90" aria-hidden />
          <span className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 rounded bg-white/80 shadow-[0_0_12px_2px_rgba(255,255,255,0.6)]" aria-hidden />
        </button>

        <div className="relative z-10 mt-10 text-center">
          <p className="text-lg font-semibold">请将二维码对准扫描框</p>
          <p className="mt-1 text-sm text-white/60">
            {supported ? '扫码后先校验二维码类型；未识别的码不会执行核销' : '请升级到支持扫码能力的 App 版本'}
          </p>
        </div>
      </main>
    </div>
  )
}

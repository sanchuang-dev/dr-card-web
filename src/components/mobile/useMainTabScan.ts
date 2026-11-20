import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getNativeBridgeDiagnostics,
  getNativeHost,
  NativeBridgeError,
  scanCode,
} from '../../services/nativeBridge'
import { parseBuddyInviteCode } from '../../services/buddyRelations'

export type MainTabScanFeedback = {
  message: string
  status: 'warning' | 'danger'
}

const BRIDGE_DISCOVERY_INTERVAL_MS = 500
const BRIDGE_DISCOVERY_MAX_ATTEMPTS = 20

/**
 * Shared implementation for the main bottom-tab scanner and the card-use scan entry.
 * Native continues to own device QR flows; only trusted buddy invite QR codes navigate in H5.
 */
export function useMainTabScan({ enabled = true }: { enabled?: boolean } = {}) {
  const navigate = useNavigate()
  const [scanSupported, setScanSupported] = useState(
    () => getNativeBridgeDiagnostics().capabilities.scanCode,
  )
  const [scanPending, setScanPending] = useState(false)
  const [scanFeedback, setScanFeedback] = useState<MainTabScanFeedback | null>(null)
  const scanInFlight = useRef(false)

  useEffect(() => {
    if (!enabled || scanSupported) return

    let attempts = 0
    let intervalId: number | undefined

    const refreshSupport = () => {
      const supported = getNativeBridgeDiagnostics().capabilities.scanCode
      if (supported) setScanSupported(true)
      return supported
    }

    const pollSupport = () => {
      attempts += 1
      if (refreshSupport() || attempts >= BRIDGE_DISCOVERY_MAX_ATTEMPTS) {
        if (intervalId !== undefined) {
          window.clearInterval(intervalId)
          intervalId = undefined
        }
      }
    }

    intervalId = window.setInterval(pollSupport, BRIDGE_DISCOVERY_INTERVAL_MS)
    window.addEventListener('focus', refreshSupport)
    window.addEventListener('pageshow', refreshSupport)

    return () => {
      if (intervalId !== undefined) window.clearInterval(intervalId)
      window.removeEventListener('focus', refreshSupport)
      window.removeEventListener('pageshow', refreshSupport)
    }
  }, [enabled, scanSupported])

  useEffect(() => {
    if (!scanFeedback) return
    const timer = window.setTimeout(() => setScanFeedback(null), 2200)
    return () => window.clearTimeout(timer)
  }, [scanFeedback])

  const handleScan = useCallback(async () => {
    if (!enabled || !getNativeBridgeDiagnostics().capabilities.scanCode || scanInFlight.current) return

    scanInFlight.current = true
    setScanPending(true)
    setScanFeedback(null)

    try {
      const host = getNativeHost()
      const result = await scanCode({ scanType: 'qr' })

      // Current Android provides the verified scan-dispatch contract. Do not infer iOS support.
      if (host !== 'android') {
        setScanFeedback({
          message: '当前 App 尚未提供可验证的扫码分流能力',
          status: 'warning',
        })
        return
      }

      // Native owns device QR flows, including vending callbacks without consumeUse.
      if (
        result.isDevice === true ||
        (typeof result.consumeUse === 'string' && result.consumeUse.length > 0)
      ) {
        return
      }
      if (result.isDevice !== false) return

      try {
        parseBuddyInviteCode(
          result.code,
          import.meta.env.VITE_BUDDY_PUBLIC_ORIGIN ?? '',
        )
      } catch {
        setScanFeedback({ message: '暂不支持此二维码', status: 'warning' })
        return
      }

      navigate('/buddy/accept', {
        state: {
          buddyScan: {
            source: 'native-buddy-recognition',
            raw: result.code,
          },
        },
      })
    } catch (error) {
      if (error instanceof NativeBridgeError) {
        if (error.code === 'native-cancelled') return
        if (error.code === 'native-permission-denied') {
          setScanFeedback({ message: '请允许相机权限后重试', status: 'danger' })
          return
        }
        if (
          error.code === 'bridge-disabled' ||
          error.code === 'bridge-unsupported' ||
          error.code === 'capability-unsupported'
        ) {
          setScanFeedback({ message: '当前 App 版本暂不支持扫码', status: 'warning' })
          return
        }
      }
      setScanFeedback({ message: '扫码失败，请重试', status: 'danger' })
    } finally {
      scanInFlight.current = false
      setScanPending(false)
    }
  }, [enabled, navigate])

  return { scanSupported, scanPending, scanFeedback, handleScan }
}

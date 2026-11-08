import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseBuddyInviteCode } from '../services/buddyRelations'

/**
 * #107 H5-only test entry. It can create the same internal navigation state that a future
 * dedicated Native QR recognition handoff will supply, without changing the actual Bridge.
 * This module is only imported from the non-production debug route.
 */
export default function BuddyQrProbe() {
  const navigate = useNavigate()
  const [raw, setRaw] = useState('')
  const [error, setError] = useState<string | null>(null)
  const origin = import.meta.env.VITE_BUDDY_PUBLIC_ORIGIN

  const preview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (!origin?.trim()) {
      setError('当前构建未配置官方二维码域名 VITE_BUDDY_PUBLIC_ORIGIN')
      return
    }
    try {
      parseBuddyInviteCode(raw, origin)
      navigate('/buddy/accept', {
        state: { buddyScan: { source: 'native-buddy-recognition', raw } },
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '二维码内容无效')
    }
  }

  return (
    <main className="min-h-dvh bg-background px-4 py-8 text-text-primary">
      <div className="mx-auto max-w-xl rounded-container border border-border bg-surface p-5">
        <h1 className="text-xl font-semibold">搭子二维码 H5 验收</h1>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          手动粘贴真实扫码返回的完整 HTTPS URL，验证 UUID 查询、邀请人资料与确认页。
          本入口不调用 Native，也不会代替真实扫码联调或创建搭子关系。
        </p>
        <p className="mt-2 break-all text-xs text-text-tertiary">
          官方域名：{origin || '未配置'}
        </p>
        <form onSubmit={preview} className="mt-5">
          <label className="block text-sm font-medium" htmlFor="buddy-qr-input">
            扫码结果 URL
          </label>
          <textarea
            id="buddy-qr-input"
            value={raw}
            onChange={event => setRaw(event.target.value)}
            rows={4}
            className="mt-2 w-full rounded-control border border-border bg-surface px-3 py-2 font-mono text-xs text-text-primary"
            placeholder="https://.../buddy/invite/scan?code=..."
          />
          {error && <p role="alert" className="mt-2 text-sm text-danger-text">{error}</p>}
          <button type="submit"
            className="mt-4 rounded-button bg-reward-strong px-4 py-2.5 text-sm font-semibold text-white">
            查询并打开邀请确认页
          </button>
        </form>
      </div>
    </main>
  )
}

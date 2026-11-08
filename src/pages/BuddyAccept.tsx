import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Loader2, RefreshCw, UserRoundCheck, X } from 'lucide-react'
import { runtimePolicy } from '../app/config/runtime'
import PromptOverlay from '../components/mobile/PromptOverlay'
import { Button } from '../components/ui'
import { useFixtureDebug, useFixtureNavigate, useFixtureQueryControls } from '../app/fixtures/useFixture'
import {
  acceptBuddyQr,
  MOCK_BUDDY_SCAN_URL,
  previewBuddyQr,
  readBuddyScanNavigation,
  type BuddyPreview,
} from '../services/buddyRelations'
import DearseedColumn from './DearseedColumn'

type ViewState =
  | { kind: 'loading' }
  | { kind: 'missing' }
  | { kind: 'ready'; preview: BuddyPreview }
  | { kind: 'failed'; message: string }
  | { kind: 'demo-complete' }

/**
 * #107: consumes ONLY an in-App, route-state QR recognition result; never the public
 * /buddy/invite/scan URL. #110 Native must preserve existing device/card redemption.
 * API/test/prod may preview the actual UUID owner, but QR relation writes remain blocked until #105.
 */
export default function BuddyAccept() {
  const location = useLocation()
  const fixtureNavigate = useFixtureNavigate()
  const { get, patch } = useFixtureQueryControls()
  const debug = useFixtureDebug()
  const dismissed = get('state') === 'dismissed'
  const fixtureMode = runtimePolicy.dataMode === 'mock'
  const recognizedRaw = readBuddyScanNavigation(location.state)
  const raw = recognizedRaw ?? (fixtureMode ? MOCK_BUDDY_SCAN_URL : null)
  const [view, setView] = useState<ViewState>({ kind: raw ? 'loading' : 'missing' })
  const [retry, setRetry] = useState(0)
  const [sending, setSending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  useEffect(() => {
    if (dismissed) return
    setActionError(null)
    setView(raw ? { kind: 'loading' } : { kind: 'missing' })
    if (!raw) return
    let active = true
    void previewBuddyQr(raw).then(preview => {
      if (active) setView({ kind: 'ready', preview })
    }).catch(error => {
      if (active) setView({ kind: 'failed', message: error instanceof Error ? error.message : '邀请查询失败' })
    })
    return () => { active = false }
  }, [raw, retry, dismissed])

  const dismiss = () => {
    if (sending) return
    patch({ state: 'dismissed' })
  }

  const confirm = async () => {
    if (view.kind !== 'ready' || view.preview.relationship !== 'available' || !raw || sending) return
    setSending(true)
    setActionError(null)
    try {
      const result = await acceptBuddyQr(raw)
      if (!alive.current) return
      if (result.demo) {
        setView({ kind: 'demo-complete' })
      } else {
        // No local fixture mutation. Buddy list independently reloads from the backend.
        fixtureNavigate('/buddy', { debug: debug ? '1' : null }, { replace: true })
      }
    } catch (error) {
      if (alive.current) setActionError(error instanceof Error ? error.message : '确认失败，请稍后重试')
    } finally {
      if (alive.current) setSending(false)
    }
  }

  if (dismissed) return <DearseedColumn />

  const preview = view.kind === 'ready' ? view.preview : null
  const relationship = preview?.relationship
  const already = relationship === 'already-buddies'
  const title = view.kind === 'missing' ? '等待诗得丽扫码结果'
    : view.kind === 'loading' ? '正在查询邀请…'
      : view.kind === 'failed' ? '邀请查询失败'
        : view.kind === 'demo-complete' ? '演示确认已完成'
          : already ? '你们已经是搭子啦'
            : relationship === 'self' ? '不能邀请自己'
              : relationship === 'unavailable' ? '这张邀请暂不可用'
                : `${preview?.inviter.nickname ?? '对方'}邀请你成为洗头搭子`
  const description = view.kind === 'missing'
    ? '扫码识别协议尚未接通，请在卡博士 App 内使用诗得丽扫一扫'
    : view.kind === 'failed' ? view.message
      : view.kind === 'demo-complete' ? '这只是 H5 演示，不会创建或保存真实搭子关系'
        : already ? '你们已建立搭子关系，无需重复绑定'
          : relationship === 'self' ? '自己的二维码无法用于成为搭子'
            : relationship === 'unavailable' ? '请确认二维码仍可使用'
              : preview?.demo ? '演示用户，仅验证确认交互，不会绑定真实账号'
                : preview?.confirmationAvailable === false
                  ? '已识别真实邀请人；后台尚未开放二维码确认，暂不能建立搭子关系'
                  : '确认后你们将成为洗头搭子'

  return (
    <>
      <DearseedColumn />
      <PromptOverlay
        open
        label="接受洗头搭子邀请"
        onDismiss={dismiss}
        className="border border-border-subtle bg-surface px-6 pb-6 pt-6 text-center shadow-modal"
      >
        <button
          type="button" aria-label="关闭搭子邀请" disabled={sending}
          onClick={dismiss}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary active:bg-surface-subtle disabled:opacity-60"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        {preview?.inviter.avatarUrl ? (
          <img src={preview.inviter.avatarUrl} alt="" aria-hidden
            className="mx-auto h-20 w-20 rounded-full object-cover ring-4 ring-buddy-surface" />
        ) : (
          <span aria-hidden className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-buddy-surface text-buddy-accent">
            {view.kind === 'loading' ? <Loader2 className="h-8 w-8 animate-spin" /> : <UserRoundCheck className="h-9 w-9" />}
          </span>
        )}
        <h2 className="mt-4 text-lg font-semibold leading-7 text-text-primary">{title}</h2>
        <p role="status" className="mt-2 text-sm leading-6 text-text-secondary">{description}</p>
        {preview && <p className="mt-2 text-xs text-text-secondary">成为搭子后，当前版本暂不支持解除关系</p>}
        {actionError && <p role="alert" className="mt-2 text-sm text-danger-text">{actionError}</p>}
        {view.kind === 'ready' && relationship === 'available' && (
          <Button size="large" leadingIcon={UserRoundCheck} loading={sending}
            disabled={sending || preview?.confirmationAvailable === false} className="mt-5 w-full rounded-full" onClick={() => void confirm()}>
            {preview?.demo ? '演示确认（不真实绑定）' : '确认成为搭子'}
          </Button>
        )}
        {already && (
          <Button size="large" className="mt-5 w-full rounded-full"
            onClick={() => fixtureNavigate('/buddy', { debug: debug ? '1' : null })}>
            查看我的搭子
          </Button>
        )}
        {view.kind === 'failed' && (
          <Button size="large" leadingIcon={RefreshCw} className="mt-5 w-full rounded-full"
            onClick={() => setRetry(v => v + 1)}>重新查询</Button>
        )}
        <Button variant="ghost" disabled={sending} className="mt-2 w-full rounded-full" onClick={dismiss}>
          {view.kind === 'demo-complete' ? '关闭演示' : '取消'}
        </Button>
      </PromptOverlay>
    </>
  )
}

import { useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Ticket, XCircle } from 'lucide-react'
import DebugPanel from '../components/mobile/DebugPanel'
import { isAppError } from '../services/http'
import { runtimePolicy } from '../app/config/runtime'
import { redeemCardCode, type RedemptionReceipt } from '../services/redeemCode'
import PageContainer from '../components/mobile/PageContainer'
import ProjectSelectScreen from './exchange/ProjectSelectScreen'
import { useFixtureState } from '../app/fixtures/useFixture'
import { findRouteByPathname } from '../app/router/routes'
import {
  REDEEM_CODE_RULE,
  REDEEM_FEEDBACK,
  REDEEM_SAMPLE_CODES,
  resolveRedeemOutcome,
  type RedeemOutcome,
} from '../app/fixtures'

/**
 * 兑换卡券（#68 输入与失败态 / #69 兑换成功）
 * -------------------------------------------------------------
 * 视觉与交互取自 reference/兑换卡券.html：ticket 前缀图标、56 高输入框、聚焦描边、
 * 清除按钮仅在有输入时出现、48 高圆角主按钮、居中 toast（成功绿 / 失败红）。
 * 兑换码至少 10 位，不修改用户输入字符；API 模式走后台正式核兑接口。
 * 只有 preview/dev Mock 模式使用固定演示码，API/test/prod 以后台发券回执为准。
 */
export default function Redeem() {
  const navigate = useNavigate()
  const route = findRouteByPathname('/redeem')
  const { state } = useFixtureState(route)

  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [outcome, setOutcome] = useState<RedeemOutcome | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<RedemptionReceipt | null>(null)
  const [pendingCode, setPendingCode] = useState<string | null>(null)
  const submissionLock = useRef(false)
  // A full-screen in-page step must consume BrowserRouter POP/back without
  // pushing an artificial history entry (UX-E). Submission stays protected.
  const blocker = useBlocker(pendingCode !== null)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (!submissionLock.current && !submitting) {
      setPendingCode(null)
      setErrorMessage(null)
    }
    blocker.reset()
  }, [blocker, submitting])
  const timers = useRef<number[]>([])

  const trimmed = code
  const feedback = errorMessage ? { ok: false, text: errorMessage } : outcome ? REDEEM_FEEDBACK[outcome] : null
  const done = outcome === 'success'

  /** `?state=` 直达：回填该分支的演示码并落到对应反馈，便于逐节点截图 */
  useEffect(() => {
    const key = state?.key as RedeemOutcome | undefined
    if (!key || !(key in REDEEM_SAMPLE_CODES)) return
    setCode(REDEEM_SAMPLE_CODES[key])
    setReceipt(null)
    setPendingCode(null)
    setOutcome(key)
    setErrorMessage(null)
    setSubmitting(false)
  }, [state?.key])

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), [])

  const track = (fn: () => void, delay: number) => {
    timers.current.push(window.setTimeout(fn, delay))
  }

  const clear = () => {
    setPendingCode(null)
    setReceipt(null)
    setCode('')
    setOutcome(null)
    setErrorMessage(null)
  }

  const openProjectSelector = () => {
    if (code.length < REDEEM_CODE_RULE.minLength || submitting) return
    // Freeze exactly what the user entered. Searching must not alter the code.
    setPendingCode(code)
    setErrorMessage(null)
    setOutcome(null)
  }

  const submit = async (projectId: number) => {
    if (!pendingCode || pendingCode.length < REDEEM_CODE_RULE.minLength ||
        submitting || submissionLock.current) return
    const originalCode = pendingCode
    submissionLock.current = true
    setOutcome(null)
    setReceipt(null)
    setErrorMessage(null)
    setSubmitting(true)
    if (runtimePolicy.dataMode === 'mock') {
      /** Legacy preview fixture is explicitly mock-only; no real issue occurs here. */
      track(() => {
        const next = resolveRedeemOutcome(originalCode)
        if (next === 'success') {
          setOutcome('success')
          setPendingCode(null)
        } else {
          setErrorMessage(REDEEM_FEEDBACK[next].text)
        }
        setSubmitting(false)
        submissionLock.current = false
      }, 700)
      return
    }
    try {
      const nextReceipt = await redeemCardCode(originalCode, projectId)
      setReceipt(nextReceipt)
      setPendingCode(null)
      setOutcome('success')
    } catch (error) {
      if (isAppError(error) && error.kind === 'contract') {
        setErrorMessage('兑换结果暂时无法确认，请稍后重试')
      } else if (isAppError(error) && (error.kind === 'network' || error.kind === 'timeout')) {
        setErrorMessage('网络异常，兑换结果可能尚未确认，请先到卡包查看')
      } else {
        setErrorMessage(error instanceof Error ? error.message : '兑换失败，请稍后重试')
      }
    } finally {
      setSubmitting(false)
      submissionLock.current = false
    }
  }

  if (done) {
    return (
      <PageContainer className="flex min-h-full flex-col pb-6" inset>
        <div className="flex flex-col items-center gap-3 px-5 pb-4 pt-14 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-bg" aria-hidden>
            <CheckCircle2 className="h-8 w-8 text-success" />
          </span>
          <h1 className="text-lg font-semibold text-text-primary">兑换成功</h1>
          <p className="max-w-[260px] text-sm leading-6 text-text-secondary">{REDEEM_FEEDBACK.success.text}</p>
          {receipt && <p className="max-w-[260px] text-sm font-medium text-text-primary">已提交卡券兑换，可前往卡包查看</p>}
        </div>

        <section className="mx-4 mt-5 flex items-center gap-3 rounded-container bg-surface p-3 shadow-sm">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-surface-selected text-text-brand"
            aria-hidden
          >
            <Ticket className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-text-tertiary">兑换码</p>
            <p className="mt-0.5 truncate text-base font-semibold tracking-[0.08em] text-text-primary">{trimmed}</p>

          </div>
        </section>

        <div className="mt-auto flex flex-col items-center gap-2 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-5">
          <button
            type="button"
            onClick={() => navigate('/card')}
            className="h-12 w-full rounded-full bg-primary text-base font-medium text-text-inverse active:bg-primary-pressed"
          >
            查看我的卡包
          </button>
          <button type="button" onClick={clear} className="h-9 text-sm font-medium text-text-secondary">
            再兑换一张
          </button>
        </div>

        <DebugPanel route={route} />
      </PageContainer>
    )
  }

  return (
    <PageContainer className="pb-24">
      <div className="mt-2 flex h-14 items-center gap-2 rounded-container border-2 border-transparent bg-surface px-4 focus-within:border-border-focused">
        <Ticket className="h-5 w-5 flex-none text-text-tertiary" aria-hidden />
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          value={code}
          onChange={(event) => {
            setCode(event.target.value)
            setOutcome(null)
            setErrorMessage(null)
          }}
          placeholder="请输入兑换码"
          aria-label="兑换码"
          className="min-w-0 flex-1 bg-transparent text-base tracking-[0.08em] text-text-primary outline-none placeholder:tracking-normal placeholder:text-text-placeholder"
        />
        {code && (
          <button type="button" aria-label="清空" onClick={clear} className="flex-none text-text-tertiary">
            <XCircle className="h-5 w-5" />
          </button>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-text-tertiary">{REDEEM_CODE_RULE.hint}</p>

      <button
        type="button"
        disabled={trimmed.length < REDEEM_CODE_RULE.minLength || submitting}
        onClick={openProjectSelector}
        className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-base font-medium text-text-inverse active:bg-primary-pressed disabled:bg-disabled disabled:text-text-disabled"
      >
        选择适用片区
      </button>

      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed left-1/2 top-1/2 z-50 flex w-fit -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-control px-5 py-3 text-sm text-text-inverse shadow-floating ${
            feedback.ok ? 'bg-success' : 'bg-danger'
          }`}
        >
          {feedback.ok ? <CheckCircle2 className="h-[18px] w-[18px]" /> : <AlertCircle className="h-[18px] w-[18px]" />}
          {feedback.text}
        </div>
      )}

      {pendingCode !== null && (
        <ProjectSelectScreen
          mode="code"
          code={pendingCode}
          submitting={submitting}
          submitError={errorMessage}
          onClose={() => {
            if (submitting) return
            setPendingCode(null)
            setErrorMessage(null)
          }}
          onConfirm={(projectId) => { void submit(projectId) }}
        />
      )}

      <DebugPanel route={route} />
    </PageContainer>
  )
}

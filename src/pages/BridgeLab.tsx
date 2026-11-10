import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bug,
  Eye,
  EyeOff,
  Play,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  Terminal,
  Trash2,
} from 'lucide-react'
import { runtimePolicy } from '../app/config/runtime'
import {
  getNativeBridgeCapabilityCatalog,
  getNativeBridgeDiagnostics,
  invokeRegisteredNativeCapabilityForDebug,
  subscribeNativeBridgeTransportDebugEvents,
  type NativeCapabilityName,
} from '../services/nativeBridge'
import {
  isSensitiveBridgeName,
  redactBridgeValue,
  resetIOSRawProbeChannel,
  runAndroidRawProbe,
  runIOSRawProbe,
  type AndroidArgumentMode,
  type IOSPayloadMode,
  type IOSReceiveMode,
} from '../bridge/bridgeLabProbe'

type LabPlatform = 'iOS' | 'android' | 'web'
type BridgeLabCallbackWindow = Window & {
  nativeBridgeCallback?: (callbackId: string, payload: unknown) => void
  androidBridgeCallback?: (callbackId: string, payload: unknown) => void
  testFunc?: (params: unknown) => string
}
type LogLevel = 'call' | 'result' | 'callback' | 'error' | 'timeout'

type LabLog = {
  id: string
  time: string
  level: LogLevel
  title: string
  displayValue?: unknown
  rawValue?: unknown
  redacted?: boolean
  durationMs?: number
}

const ANDROID_RAW_PRESETS = [
  {
    label: 'showToast',
    objectName: 'androidBridge',
    methodName: 'showToast',
    argumentMode: 'string' as const,
    argumentText: 'H5 调用原生 Toast',
  },
  {
    label: 'getLoginToken',
    objectName: 'androidBridge',
    methodName: 'getLoginToken',
    argumentMode: 'none' as const,
    argumentText: '',
  },
  {
    label: 'submitOrder',
    objectName: 'androidBridge',
    methodName: 'submitOrder',
    argumentMode: 'string' as const,
    argumentText: '{"orderId":1001,"money":99}',
  },
]

const IOS_RAW_PRESETS = [
  {
    label: 'getAuthorizationInfo',
    handlerName: 'getAuthorizationInfo',
    payloadMode: 'empty-object' as const,
    payloadText: '{}',
    receiveMode: 'global-callback' as const,
    callbackName: 'onToken',
    timeoutMs: '5000',
  },
]

const CAPABILITY_INPUT_PRESETS: Partial<Record<NativeCapabilityName, string>> = {
  scanCode: '{"scanType":"all"}',
  takePhoto: '{"crop":true,"maxWidth":1080,"maxHeight":1080,"quality":0.8}',
  chooseImage:
    '{"crop":true,"maxWidth":1080,"maxHeight":1080,"quality":0.8,"count":1}',
  copyText: '{"text":"Bridge Lab copy test"}',
  showRewardAd: '{"scene":"h5CheckinResign"}',
  openApp: '{"action":"detect","inviteCode":"","fallbackUrl":""}',
}

function getLabPlatform(): LabPlatform {
  if (typeof window === 'undefined') return 'web'
  const osType = new URLSearchParams(window.location.search).get('osType')?.trim().toLowerCase()
  if (osType === 'ios') return 'iOS'
  if (osType === 'android') return 'android'
  return 'web'
}

function formatValue(value: unknown): string {
  if (value === undefined) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function errorValue(error: unknown): unknown {
  if (error instanceof Error) {
    const cause = 'cause' in error ? (error as { cause?: unknown }).cause : undefined
    return {
      name: error.name,
      message: error.message,
      ...('code' in error ? { code: (error as { code?: unknown }).code } : {}),
      ...(cause instanceof Error
        ? { cause: { name: cause.name, message: cause.message, ...('code' in cause ? { code: (cause as { code?: unknown }).code } : {}) } }
        : cause !== undefined ? { cause } : {}),
    }
  }
  return error
}

function summarizeNativeArguments(args: readonly unknown[]) {
  return args.map((argument) => {
    if (typeof argument !== 'string') {
      return { type: argument === null ? 'null' : Array.isArray(argument) ? 'array' : typeof argument }
    }
    try {
      const parsed: unknown = JSON.parse(argument)
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>
        return {
          type: 'JSON string',
          keys: Object.keys(record),
          ...(typeof record.callbackId === 'string' ? { callbackId: record.callbackId } : {}),
          ...(typeof record.scanType === 'string' ? { scanType: record.scanType } : {}),
        }
      }
    } catch {
      // Plain strings are represented by length only; their contents may be sensitive.
    }
    return { type: 'string', length: argument.length }
  })
}

function getNativePayloadType(payload: unknown): string {
  if (typeof payload === 'string') {
    try {
      JSON.parse(payload)
      return 'JSON string'
    } catch {
      return 'string'
    }
  }
  if (payload === null) return 'null'
  if (Array.isArray(payload)) return 'array'
  return typeof payload
}

function redactNativeCallbackPayload(
  payload: unknown,
  methodName: string | undefined,
  forceSensitive: boolean,
) {
  if (methodName !== 'scanCode') return redactBridgeValue(payload, forceSensitive)

  let normalized = payload
  if (typeof normalized === 'string') {
    try {
      normalized = JSON.parse(normalized)
    } catch {
      return { value: '[REDACTED]', redacted: true }
    }
  }
  const redaction = redactBridgeValue(normalized)
  if (redaction.value === null || typeof redaction.value !== 'object' || Array.isArray(redaction.value)) {
    return { value: '[REDACTED]', redacted: true }
  }

  const record = redaction.value as Record<string, unknown>
  if (typeof record.code === 'string' && record.code.length > 0) {
    record.code = '[REDACTED]'
    redaction.redacted = true
  }
  const data = record.data
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    const dataRecord = data as Record<string, unknown>
    if (typeof dataRecord.text === 'string') {
      dataRecord.text = '[REDACTED]'
      redaction.redacted = true
    }
  }
  return redaction
}

function inputClassName() {
  return 'h-10 w-full rounded-control border border-border bg-surface px-3 text-sm text-text-primary outline-none transition focus:border-reward-strong'
}

function textareaClassName() {
  return 'min-h-24 w-full resize-y rounded-control border border-border bg-surface px-3 py-2.5 font-mono text-xs leading-5 text-text-primary outline-none transition focus:border-reward-strong'
}

export default function BridgeLab() {
  const labPlatform = useMemo(getLabPlatform, [])
  const [catalog, setCatalog] = useState(() => getNativeBridgeCapabilityCatalog())
  const [diagnostics, setDiagnostics] = useState(() => getNativeBridgeDiagnostics())
  const platformCatalog = useMemo(
    () =>
      labPlatform === 'web'
        ? []
        : catalog.filter((item) =>
            item.platforms.includes(labPlatform === 'iOS' ? 'ios' : 'android'),
          ),
    [catalog, labPlatform],
  )
  const [selectedCapability, setSelectedCapability] = useState<NativeCapabilityName>(
    platformCatalog[0]?.name ?? 'getLoginToken',
  )
  const [capabilityInput, setCapabilityInput] = useState('')

  const [androidObject, setAndroidObject] = useState('androidBridge')
  const [androidMethod, setAndroidMethod] = useState('')
  const [androidMode, setAndroidMode] = useState<AndroidArgumentMode>('none')
  const [androidArgs, setAndroidArgs] = useState('')

  const [iosHandler, setIosHandler] = useState('')
  const [iosPayloadMode, setIosPayloadMode] = useState<IOSPayloadMode>('json')
  const [iosPayload, setIosPayload] = useState('{}')
  const [iosReceiveMode, setIosReceiveMode] = useState<IOSReceiveMode>('global-callback')
  const [iosCallback, setIosCallback] = useState('')
  const [iosTimeout, setIosTimeout] = useState('5000')

  const [logs, setLogs] = useState<LabLog[]>([])
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set())
  const sequence = useRef(0)

  useEffect(() => {
    if (labPlatform === 'web') return

    const hostWindow = window as BridgeLabCallbackWindow
    const previousTestFunc = hostWindow.testFunc
    const testFunc = (params: unknown) => {
      sequence.current += 1
      const redaction = redactBridgeValue(params)
      const id = `${Date.now()}-${sequence.current}`

      const callbackLog: LabLog = {
        id,
        time: new Date().toLocaleTimeString(),
        level: 'callback',
        title: 'window.testFunc(params)',
        displayValue: redaction.value,
        rawValue: params,
        redacted: redaction.redacted,
      }

      setLogs((current) => [callbackLog, ...current].slice(0, 50))

      return 'h5 处理完成'
    }

    hostWindow.testFunc = testFunc
    return () => {
      if (hostWindow.testFunc !== testFunc) return
      if (previousTestFunc) hostWindow.testFunc = previousTestFunc
      else delete hostWindow.testFunc
    }
  }, [labPlatform])

  const currentCapability = useMemo(
    () => platformCatalog.find((item) => item.name === selectedCapability),
    [platformCatalog, selectedCapability],
  )

  const refreshBridgeState = () => {
    const nextCatalog = getNativeBridgeCapabilityCatalog()
    setCatalog(nextCatalog)
    setDiagnostics(getNativeBridgeDiagnostics())

    if (labPlatform === 'web') return
    const nativePlatform = labPlatform === 'iOS' ? 'ios' : 'android'
    const nextPlatformCatalog = nextCatalog.filter((item) => item.platforms.includes(nativePlatform))
    if (
      !nextPlatformCatalog.some((item) => item.name === selectedCapability) &&
      nextPlatformCatalog[0]
    ) {
      setSelectedCapability(nextPlatformCatalog[0].name)
    }
  }

  const appendLog = useCallback((
    level: LogLevel,
    title: string,
    options: {
      value?: unknown
      forceSensitive?: boolean
      redaction?: { value: unknown; redacted: boolean }
      durationMs?: number
    } = {},
  ) => {
    sequence.current += 1
    const id = `${Date.now()}-${sequence.current}`
    const redaction =
      options.redaction ??
      (options.value === undefined
        ? { value: undefined, redacted: false }
        : redactBridgeValue(options.value, options.forceSensitive))

    setLogs((current) =>
      [
        {
          id,
          time: new Date().toLocaleTimeString(),
          level,
          title,
          displayValue: redaction.value,
          rawValue: options.value,
          redacted: redaction.redacted,
          durationMs: options.durationMs,
        },
        ...current,
      ].slice(0, 50),
    )
  }, [])

  useEffect(() => {
    if (!runtimePolicy.bridgeLabEnabled) return

    return subscribeNativeBridgeTransportDebugEvents((event) => {
      if (event.type === 'request') {
        appendLog('call', `Native invoke · ${event.objectName}.${event.methodName}`, {
          value: {
            callbackId: event.callbackId,
            callbackEndpoints: event.callbackNames.map((name) => `window.${name}`),
            timeoutMs: event.timeoutMs,
            args: summarizeNativeArguments(event.args),
          },
        })
        return
      }

      if (event.type === 'callback') {
        const capability = event.methodName
          ? platformCatalog.find((item) => item.name === event.methodName)
          : undefined
        const endpoint = event.callbackName ? `window.${event.callbackName}` : 'method return'
        const stage = !event.pendingMatched
          ? 'unmatched callbackId'
          : event.terminal === false
            ? 'intermediate'
            : event.terminal === true
              ? 'terminal'
              : 'stage unknown'
        const payloadRedaction = redactNativeCallbackPayload(
          event.payload,
          event.methodName,
          !event.pendingMatched || capability?.sensitiveResult === true,
        )
        const details = {
          callbackId: event.callbackId,
          endpoint,
          source: event.source,
          pendingMatched: event.pendingMatched,
          ...(event.callbackCount === undefined ? {} : { callbackCount: event.callbackCount }),
          ...(event.terminal === undefined ? {} : { terminal: event.terminal }),
          ...(event.classificationError ? { classificationError: event.classificationError } : {}),
          payloadType: getNativePayloadType(event.payload),
        }
        appendLog(
          'callback',
          `Native callback · ${endpoint} · ${stage}${event.callbackCount === undefined ? '' : ` · #${event.callbackCount}`}`,
          {
            value: { ...details, payload: event.payload },
            redaction: {
              value: { ...details, payload: payloadRedaction.value },
              redacted: payloadRedaction.redacted,
            },
          },
        )
        return
      }

      appendLog('timeout', `Native callback timeout · ${event.objectName}.${event.methodName}`, {
        value: { callbackId: event.callbackId, timeoutMs: event.timeoutMs },
      })
    })
  }, [appendLog, platformCatalog])

  const runRegisteredCapability = async () => {
    if (!currentCapability) return

    let input: unknown = undefined
    if (capabilityInput.trim()) {
      try {
        input = JSON.parse(capabilityInput)
      } catch (error) {
        appendLog('error', `${currentCapability.name} input JSON 无效`, {
          value: errorValue(error),
        })
        return
      }
    }

    appendLog('call', `H5 requested · capability · ${currentCapability.name}`)
    const startedAt = performance.now()
    try {
      const result = await invokeRegisteredNativeCapabilityForDebug(
        currentCapability.name,
        input,
      )
      appendLog('result', `capability · ${currentCapability.name}`, {
        value: result,
        forceSensitive: currentCapability.sensitiveResult,
        durationMs: Math.round(performance.now() - startedAt),
      })
    } catch (error) {
      appendLog('error', `capability · ${currentCapability.name}`, {
        value: errorValue(error),
        durationMs: Math.round(performance.now() - startedAt),
      })
    } finally {
      refreshBridgeState()
    }
  }

  const runAndroid = async () => {
    appendLog('call', `Android Raw · ${androidObject || '?'}.${androidMethod || '?'}`)
    const startedAt = performance.now()
    try {
      const result = await runAndroidRawProbe({
        objectName: androidObject,
        methodName: androidMethod,
        argumentMode: androidMode,
        argumentText: androidArgs,
      })
      appendLog('result', `Android Raw · ${androidObject}.${androidMethod}`, {
        value: result,
        forceSensitive:
          isSensitiveBridgeName(androidMethod) || isSensitiveBridgeName(androidObject),
        durationMs: Math.round(performance.now() - startedAt),
      })
    } catch (error) {
      appendLog('error', 'Android Raw Probe', {
        value: errorValue(error),
        durationMs: Math.round(performance.now() - startedAt),
      })
    }
  }

  const resetIOSChannel = () => {
    try {
      const result = resetIOSRawProbeChannel(iosCallback)
      appendLog('result', 'iOS callback channel reset', {
        value: {
          ...result,
          note: result.reset
            ? 'Only reset after host recovery or after confirming the stale callback can no longer arrive.'
            : 'No persisted callback channel existed for this callback name.',
        },
      })
    } catch (error) {
      appendLog('error', 'iOS callback channel reset', { value: errorValue(error) })
    }
  }

  const runIOS = async () => {
    const timeoutMs = Number(iosTimeout)
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      appendLog('error', 'iOS Raw Probe', {
        value: { message: 'timeout 必须是正数毫秒值。' },
      })
      return
    }

    appendLog('call', `iOS Raw · ${iosHandler || '?'}`)
    const startedAt = performance.now()
    try {
      const result = await runIOSRawProbe({
        handlerName: iosHandler,
        payloadMode: iosPayloadMode,
        payloadText: iosPayload,
        receiveMode: iosReceiveMode,
        callbackName: iosReceiveMode === 'global-callback' ? iosCallback : undefined,
        timeoutMs,
      })
      appendLog(
        iosReceiveMode === 'global-callback' ? 'callback' : 'result',
        `iOS Raw · ${iosHandler}`,
        {
          value: result,
          forceSensitive:
            isSensitiveBridgeName(iosHandler) || isSensitiveBridgeName(iosCallback),
          durationMs: Math.round(performance.now() - startedAt),
        },
      )
    } catch (error) {
      appendLog('error', 'iOS Raw Probe', {
        value: errorValue(error),
        durationMs: Math.round(performance.now() - startedAt),
      })
    }
  }

  const toggleRaw = (id: string) => {
    setRevealed((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!runtimePolicy.bridgeLabEnabled) {
    return (
      <main className="min-h-dvh bg-background px-4 py-8 text-text-primary">
        <div className="mx-auto max-w-xl rounded-container border border-border bg-surface p-5">
          <ShieldAlert className="h-5 w-5 text-text-secondary" />
          <h1 className="mt-3 text-lg font-semibold">Bridge Lab 不可用</h1>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            当前运行环境禁止 Raw Probe。Bridge Lab 不在 production runtime 注册。
          </p>
        </div>
      </main>
    )
  }

  return (
    <main
      data-bridge-lab
      data-lab-platform={labPlatform}
      className="min-h-dvh bg-background px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-text-primary"
    >
      <div className="mx-auto w-full max-w-4xl">
        <header className="rounded-container border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-surface-selected text-text-brand">
              <Bug className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">Bridge Lab</h1>
                <span className="rounded-pill bg-surface-subtle px-2.5 py-1 text-[11px] font-medium text-text-secondary">
                  {runtimePolicy.appEnvironment}/{runtimePolicy.bridgeMode}
                </span>
                <span className="rounded-pill bg-surface-subtle px-2.5 py-1 text-[11px] font-medium text-text-secondary">
                  osType: {labPlatform}
                </span>
                <span className="rounded-pill bg-surface-subtle px-2.5 py-1 text-[11px] font-medium text-text-secondary">
                  detected: {diagnostics.host}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-6 text-text-secondary">
                平台按 URL osType 选择；正式 capability 走生产 Bridge Runtime；Raw Probe 用于接住并验证 Native 当前协议。
              </p>
              <p className="mt-1 text-xs text-text-tertiary">
                {runtimePolicy.build.sourceBranch}@{runtimePolicy.build.sha === 'local' ? 'local' : runtimePolicy.build.sha.slice(0, 8)}
              </p>
            </div>
            <button
              type="button"
              aria-label="刷新 Bridge 状态"
              onClick={refreshBridgeState}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-text-secondary active:bg-surface-selected"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </header>

        <section className="mt-4 rounded-container border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-text-secondary" aria-hidden />
            <h2 className="text-sm font-semibold">Registered capabilities · {labPlatform}</h2>
          </div>

          {platformCatalog.length > 0 ? (
            <>
              <div data-capability-list className="mt-3 grid gap-2 sm:grid-cols-2">
                {platformCatalog.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      setSelectedCapability(item.name)
                      setCapabilityInput(CAPABILITY_INPUT_PRESETS[item.name] ?? '')
                    }}
                    data-capability-name={item.name}
                    className={[
                      'rounded-control border p-3 text-left transition',
                      selectedCapability === item.name
                        ? 'border-reward-strong bg-surface-selected'
                        : 'border-border bg-surface',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-xs font-semibold text-text-primary">{item.name}</code>
                      <span
                        className={[
                          'rounded-pill px-2 py-0.5 text-[10px] font-medium',
                          item.supported
                            ? 'bg-success-bg text-success-text'
                            : 'bg-surface-subtle text-text-tertiary',
                        ].join(' ')}
                      >
                        {item.supported ? 'supported' : 'unavailable in current host'}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-5 text-text-secondary">{item.description}</p>
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-control bg-surface-subtle p-3">
                <label className="text-xs font-medium text-text-secondary" htmlFor="capability-input">
                  input JSON
                </label>
                <p className="mb-2 mt-1 text-[11px] leading-4 text-text-tertiary">
                  异步 capability 的 callbackId 由 H5 Runtime 自动生成并注入；日志会记录实际调用、回调入口、次数与阶段。扫码正文默认脱敏。
                </p>
                <textarea
                  id="capability-input"
                  value={capabilityInput}
                  onChange={(event) => setCapabilityInput(event.target.value)}
                  placeholder={'留空 = undefined；字符串请输入 JSON 字符串，例如 "hello"'}
                  className={textareaClassName()}
                />
                <button
                  type="button"
                  onClick={runRegisteredCapability}
                  disabled={!currentCapability?.supported}
                  className="mt-2 inline-flex h-10 items-center gap-2 rounded-button bg-reward-strong px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Play className="h-4 w-4" aria-hidden />
                  调用 {currentCapability?.name ?? 'capability'}
                </button>
              </div>
            </>
          ) : (
            <p className="mt-3 rounded-control bg-surface-subtle px-3 py-2.5 text-xs leading-5 text-text-secondary">
              当前 osType 没有已确认并注册到 production runtime 的 capability。历史联调协议仍可在下方 Raw Probe 预设中验证。
            </p>
          )}
        </section>

        {labPlatform === 'android' && (
          <section className="mt-4 rounded-container border border-border bg-surface p-4" data-android-raw-probe>
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-text-secondary" aria-hidden />
              <h2 className="text-sm font-semibold">Android Raw Probe</h2>
            </div>
            <p className="mt-1 text-xs leading-5 text-text-tertiary">
              每次调用重新读取 injected object，并保留 receiver。预设来自已跑过的 bridge 联调页，只负责回填参数，不会自动注册 production capability。
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Android 历史联调预设">
              <span className="text-xs text-text-tertiary">bridge presets:</span>
              {ANDROID_RAW_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setAndroidObject(preset.objectName)
                    setAndroidMethod(preset.methodName)
                    setAndroidMode(preset.argumentMode)
                    setAndroidArgs(preset.argumentText)
                  }}
                  aria-label={`Android preset ${preset.label}`}
                  className="h-8 rounded-button border border-border bg-surface-subtle px-3 font-mono text-xs active:bg-surface-selected"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-text-secondary">
                object
                <input
                  aria-label="Android object"
                  value={androidObject}
                  onChange={(event) => setAndroidObject(event.target.value)}
                  className={inputClassName()}
                />
              </label>
              <label className="text-xs font-medium text-text-secondary">
                method
                <input
                  aria-label="Android method"
                  value={androidMethod}
                  onChange={(event) => setAndroidMethod(event.target.value)}
                  placeholder="methodName"
                  className={inputClassName()}
                />
              </label>
              <label className="text-xs font-medium text-text-secondary">
                参数模式
                <select
                  aria-label="Android 参数模式"
                  value={androidMode}
                  onChange={(event) => setAndroidMode(event.target.value as AndroidArgumentMode)}
                  className={inputClassName()}
                >
                  <option value="none">无参数</option>
                  <option value="string">单个 string</option>
                  <option value="json-value">单个 JSON value</option>
                  <option value="json-args">JSON array → 多参数</option>
                </select>
              </label>
            </div>
            {androidMode !== 'none' && (
              <textarea
                aria-label="Android 参数"
                value={androidArgs}
                onChange={(event) => setAndroidArgs(event.target.value)}
                placeholder={androidMode === 'json-args' ? '["foo", 1]' : '{"key":"value"}'}
                className={`mt-3 ${textareaClassName()}`}
              />
            )}
            <button
              type="button"
              onClick={runAndroid}
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-button border border-border bg-surface px-4 text-sm font-semibold active:bg-surface-selected"
            >
              <Play className="h-4 w-4" aria-hidden />
              Run Android Probe
            </button>
          </section>
        )}

        {labPlatform === 'iOS' && (
          <section className="mt-4 rounded-container border border-border bg-surface p-4" data-ios-raw-probe>
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-text-secondary" aria-hidden />
              <h2 className="text-sm font-semibold">iOS Raw Probe</h2>
            </div>
            <p className="mt-1 text-xs leading-5 text-text-tertiary">
              使用 WKWebView messageHandler.postMessage，并按 Native 现有回调名临时挂载 H5 global callback。
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="iOS 历史联调预设">
              <span className="text-xs text-text-tertiary">bridge presets:</span>
              {IOS_RAW_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setIosHandler(preset.handlerName)
                    setIosPayloadMode(preset.payloadMode)
                    setIosPayload(preset.payloadText)
                    setIosReceiveMode(preset.receiveMode)
                    setIosCallback(preset.callbackName)
                    setIosTimeout(preset.timeoutMs)
                  }}
                  aria-label={`iOS preset ${preset.label}`}
                  className="h-8 rounded-button border border-border bg-surface-subtle px-3 font-mono text-xs active:bg-surface-selected"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-text-secondary">
                message handler
                <input
                  aria-label="iOS message handler"
                  value={iosHandler}
                  onChange={(event) => setIosHandler(event.target.value)}
                  placeholder="handlerName"
                  className={inputClassName()}
                />
              </label>
              <label className="text-xs font-medium text-text-secondary">
                payload
                <select
                  aria-label="iOS payload 模式"
                  value={iosPayloadMode}
                  onChange={(event) => setIosPayloadMode(event.target.value as IOSPayloadMode)}
                  className={inputClassName()}
                >
                  <option value="empty-object">{'{}'}</option>
                  <option value="string">string</option>
                  <option value="json">JSON</option>
                </select>
              </label>
              <label className="text-xs font-medium text-text-secondary">
                返回方式
                <select
                  aria-label="iOS 返回方式"
                  value={iosReceiveMode}
                  onChange={(event) => setIosReceiveMode(event.target.value as IOSReceiveMode)}
                  className={inputClassName()}
                >
                  <option value="global-callback">H5 global callback</option>
                  <option value="none">仅 postMessage</option>
                </select>
              </label>
              {iosReceiveMode === 'global-callback' && (
                <label className="text-xs font-medium text-text-secondary">
                  callback
                  <input
                    aria-label="iOS callback"
                    value={iosCallback}
                    onChange={(event) => setIosCallback(event.target.value)}
                    placeholder="callbackName"
                    className={inputClassName()}
                  />
                </label>
              )}
              <label className="text-xs font-medium text-text-secondary">
                timeout ms
                <input
                  aria-label="iOS timeout"
                  inputMode="numeric"
                  value={iosTimeout}
                  onChange={(event) => setIosTimeout(event.target.value)}
                  className={inputClassName()}
                />
              </label>
            </div>
            {iosPayloadMode !== 'empty-object' && (
              <textarea
                aria-label="iOS payload"
                value={iosPayload}
                onChange={(event) => setIosPayload(event.target.value)}
                className={`mt-3 ${textareaClassName()}`}
              />
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={runIOS}
                className="inline-flex h-10 items-center gap-2 rounded-button border border-border bg-surface px-4 text-sm font-semibold active:bg-surface-selected"
              >
                <Play className="h-4 w-4" aria-hidden />
                Run iOS Probe
              </button>
              {iosReceiveMode === 'global-callback' && (
                <button
                  type="button"
                  onClick={resetIOSChannel}
                  title="仅在宿主恢复或确认旧 callback 不会再到达后使用"
                  className="inline-flex h-10 items-center gap-2 rounded-button border border-border bg-surface-subtle px-4 text-sm font-medium text-text-secondary active:bg-surface-selected"
                >
                  Reset callback channel
                </button>
              )}
            </div>
          </section>
        )}

        {labPlatform === 'web' && (
          <section className="mt-4 rounded-container border border-border bg-surface p-4" data-web-platform-hint>
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-text-secondary" aria-hidden />
              <h2 className="text-sm font-semibold">Raw Probe</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-text-secondary">
              当前没有指定 Native 联调平台。请使用 <code>?osType=android</code> 或 <code>?osType=iOS</code>；平台选择只由该参数决定，不根据 UA 自动切换。
            </p>
          </section>
        )}

        {labPlatform !== 'web' && (
          <section
            className="mt-4 rounded-container border border-border bg-surface p-4"
            data-h5-callback-endpoints
          >
            <div>
              <h2 className="text-sm font-semibold">Native → H5 callback endpoints</h2>
              <p className="mt-1 text-xs leading-5 text-text-tertiary">
                异步能力统一目标为 nativeBridgeCallback；Android 当前已验证的 androidBridgeCallback
                作为兼容入口接入同一个 callbackId pending channel。实际到达的入口与 callbackId 会自动写入 Lab logs。
              </p>
            </div>
            <div className="mt-3 space-y-2 rounded-control bg-surface-subtle p-3 text-xs leading-5 text-text-secondary">
              <div data-callback-endpoint="nativeBridgeCallback" className="flex flex-wrap items-center justify-between gap-2">
                <code>window.nativeBridgeCallback(callbackId, payload)</code>
                <span className="text-[10px] font-medium text-text-tertiary">统一目标 · 首次异步调用时挂载</span>
              </div>
              {labPlatform === 'android' && (
                <div data-callback-endpoint="androidBridgeCallback" className="flex flex-wrap items-center justify-between gap-2">
                  <code>window.androidBridgeCallback(callbackId, payload)</code>
                  <span className="text-[10px] font-medium text-text-tertiary">Android 当前兼容入口</span>
                </div>
              )}
              <div data-callback-endpoint="testFunc" className="flex flex-wrap items-center justify-between gap-2">
                <code>window.testFunc(params)</code>
                <span className="text-[10px] font-medium text-text-tertiary">历史联调探针 → "h5 处理完成"</span>
              </div>
            </div>
          </section>
        )}

        <section className="mt-4 overflow-hidden rounded-container border border-border bg-surface">
          <div className="flex h-12 items-center justify-between border-b border-border px-4">
            <div>
              <span className="text-sm font-semibold">Lab logs</span>
              <span className="ml-2 text-xs text-text-tertiary">最多 50 条 · 默认脱敏</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setLogs([])
                setRevealed(new Set())
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              清空
            </button>
          </div>

          <div data-bridge-lab-logs className="max-h-[52vh] min-h-44 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="flex min-h-44 items-center justify-center px-6 text-center text-sm text-text-tertiary">
                从 capability runner 或 Raw Probe 发起一次调用。
              </div>
            ) : (
              <div className="divide-y divide-border">
                {logs.map((item) => {
                  const showingRaw = revealed.has(item.id)
                  const value = showingRaw ? item.rawValue : item.displayValue
                  return (
                    <article key={item.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-tertiary">
                        <span>{item.time}</span>
                        <span className="font-semibold uppercase">{item.level}</span>
                        {item.durationMs != null && <span>{item.durationMs} ms</span>}
                      </div>
                      <p className="mt-1 text-sm font-medium">{item.title}</p>
                      {value !== undefined && (
                        <pre className="mt-1.5 whitespace-pre-wrap break-words rounded-control bg-surface-subtle p-2 font-mono text-xs leading-5 text-text-secondary">
                          {formatValue(value)}
                        </pre>
                      )}
                      {item.redacted && item.rawValue !== undefined && (
                        <button
                          type="button"
                          onClick={() => toggleRaw(item.id)}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-text-brand"
                        >
                          {showingRaw ? (
                            <EyeOff className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <Eye className="h-3.5 w-3.5" aria-hidden />
                          )}
                          {showingRaw ? '恢复脱敏' : '显式显示原始结果'}
                        </button>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <div className="mt-4 flex items-start gap-2 rounded-control border border-border bg-surface-subtle p-3 text-xs leading-5 text-text-secondary">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Raw Probe 是联调工具，不是协议登记器。真机探测成功只能证明当前 Native 宿主上该调用存在；H5 负责兼容并接入已确认协议，不要求 Native 为 Lab 改造现有协议。
          </p>
        </div>
      </div>
    </main>
  )
}

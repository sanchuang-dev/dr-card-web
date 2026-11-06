export type NativeTransportUnsupportedCode = 'bridge-unsupported' | 'capability-unsupported'

export type NativeTransportResolution<TResult> =
  | {
      supported: false
      code: NativeTransportUnsupportedCode
      message: string
    }
  | {
      supported: true
      invoke: () => TResult | PromiseLike<TResult>
    }

export type IOSMessageHandler = {
  postMessage: (payload: unknown) => void
}

export type NativeTransportWindow = Window & {
  androidBridge?: Record<string, unknown>
  iosBridge?: Record<string, unknown>
  nativeBridgeCallback?: (callbackId: string, payload: unknown) => void
  androidBridgeCallback?: (callbackId: string, payload: unknown) => void
  webkit?: {
    messageHandlers?: Record<string, IOSMessageHandler | undefined>
  }
}

export type NativeTransportErrorCode =
  | 'serialization-failed'
  | 'payload-invalid'
  | 'native-cancelled'
  | 'native-permission-denied'
  | 'native-failed'
  | 'callback-timeout'
  | 'callback-failed'
  | 'callback-concurrency-unsupported'
  | 'callback-correlation-conflict'
  | 'callback-channel-unsafe'
  | 'post-message-failed'

export class NativeTransportError extends Error {
  readonly name = 'NativeTransportError'

  constructor(
    readonly code: NativeTransportErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
  }
}

export type NativeTransportInvocationOptions = {
  timeoutMs?: number
}

/** Shared timeout for the unified Android/iOS injected-object callbackId protocol. */
export const INJECTED_CALLBACK_TIMEOUT_MS = 120_000

export type NativeArgumentSerializer<TInput> = (input: TInput) => readonly unknown[]
export type NativeResultParser<TResult> = (payload: unknown) => TResult

export function identityResultParser<TResult = unknown>(payload: unknown): TResult {
  return payload as TResult
}

export function serializeJsonValue(value: unknown): string {
  try {
    const serialized = JSON.stringify(value)
    if (typeof serialized !== 'string') {
      throw new TypeError('JSON.stringify did not produce a string payload.')
    }
    return serialized
  } catch (error) {
    if (error instanceof NativeTransportError) throw error
    throw new NativeTransportError(
      'serialization-failed',
      'Native transport could not serialize the payload as JSON.',
      error,
    )
  }
}

export function parseJsonStringPayload<TResult = unknown>(payload: unknown): TResult {
  if (typeof payload !== 'string') {
    throw new NativeTransportError(
      'payload-invalid',
      'Native transport expected a JSON string result.',
    )
  }

  try {
    return JSON.parse(payload) as TResult
  } catch (error) {
    throw new NativeTransportError(
      'payload-invalid',
      'Native transport received a malformed JSON string result.',
      error,
    )
  }
}

export function parseJsonPayload<TResult = unknown>(payload: unknown): TResult {
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as TResult
    } catch (error) {
      throw new NativeTransportError(
        'payload-invalid',
        'Native transport received a malformed JSON string result.',
        error,
      )
    }
  }

  if (payload !== null && typeof payload === 'object') {
    return payload as TResult
  }

  throw new NativeTransportError(
    'payload-invalid',
    'Native transport expected a JSON string or object result.',
  )
}

function resolveHostObject(
  hostWindow: NativeTransportWindow | undefined,
  objectName: string,
): Record<string, unknown> | undefined {
  if (!hostWindow) return undefined

  const candidate = (hostWindow as unknown as Record<string, unknown>)[objectName]
  if (candidate === null || (typeof candidate !== 'object' && typeof candidate !== 'function')) {
    return undefined
  }

  return candidate as Record<string, unknown>
}

export interface InjectedObjectTransportConfig<TInput, TResult> {
  objectName: string
  methodName: string
  serializeArgs: NativeArgumentSerializer<TInput>
  parseResult?: NativeResultParser<TResult>
}

export function createInjectedObjectTransport<TInput, TResult>(
  config: InjectedObjectTransportConfig<TInput, TResult>,
) {
  const parseResult = config.parseResult ?? identityResultParser<TResult>

  return {
    resolve(
      hostWindow: NativeTransportWindow | undefined,
      input: TInput,
    ): NativeTransportResolution<TResult> {
      const bridge = resolveHostObject(hostWindow, config.objectName)
      if (!bridge) {
        return {
          supported: false,
          code: 'bridge-unsupported',
          message: 'window.' + config.objectName + ' is not available in the current host.',
        }
      }

      const method = bridge[config.methodName]
      if (typeof method !== 'function') {
        return {
          supported: false,
          code: 'capability-unsupported',
          message:
            config.objectName +
            '.' +
            config.methodName +
            ' is not available in the current host.',
        }
      }

      return {
        supported: true,
        invoke: () => {
          let args: readonly unknown[]
          try {
            args = config.serializeArgs(input)
          } catch (error) {
            if (error instanceof NativeTransportError) throw error
            throw new NativeTransportError(
              'serialization-failed',
              'Injected-object transport could not serialize method arguments.',
              error,
            )
          }

          const rawResult = method.call(bridge, ...args)
          if (
            rawResult !== null &&
            (typeof rawResult === 'object' || typeof rawResult === 'function') &&
            typeof (rawResult as PromiseLike<unknown>).then === 'function'
          ) {
            return Promise.resolve(rawResult).then((payload) => parseResult(payload))
          }

          return parseResult(rawResult)
        },
      }
    },
  }
}

export type InjectedCallbackName =
  | 'nativeBridgeCallback'
  | 'androidBridgeCallback'

export type NativeBridgeTransportDebugEvent =
  | {
      type: 'request'
      objectName: string
      methodName: string
      callbackId: string
      callbackNames: readonly InjectedCallbackName[]
      timeoutMs: number
      args: readonly unknown[]
    }
  | {
      type: 'callback'
      objectName?: string
      methodName?: string
      callbackId: string
      callbackName: InjectedCallbackName | null
      source: 'callback' | 'method-return'
      callbackCount?: number
      pendingMatched: boolean
      terminal?: boolean
      classificationError?: string
      payload: unknown
    }
  | {
      type: 'timeout'
      objectName: string
      methodName: string
      callbackId: string
      timeoutMs: number
    }

type NativeBridgeTransportDebugListener = (event: NativeBridgeTransportDebugEvent) => void
const nativeBridgeTransportDebugListeners = new Set<NativeBridgeTransportDebugListener>()

/** Passive Bridge Lab observer. Events are delivered only to active debug listeners. */
export function subscribeNativeBridgeTransportDebugEvents(
  listener: NativeBridgeTransportDebugListener,
): () => void {
  nativeBridgeTransportDebugListeners.add(listener)
  return () => nativeBridgeTransportDebugListeners.delete(listener)
}

function emitNativeBridgeTransportDebugEvent(event: NativeBridgeTransportDebugEvent): void {
  if (nativeBridgeTransportDebugListeners.size === 0) return
  for (const listener of nativeBridgeTransportDebugListeners) {
    try {
      listener(event)
    } catch {
      // Diagnostics must never interfere with Native callback delivery or Promise settlement.
    }
  }
}

export interface CallbackInjectedObjectTransportConfig<TInput, TResult>
  extends Omit<InjectedObjectTransportConfig<TInput, TResult>, 'serializeArgs'> {
  serializeArgs: (input: TInput, callbackId: string) => readonly unknown[]
  /**
   * Unified protocol target is window.nativeBridgeCallback.
   * callbackAliases exists only for confirmed host compatibility (currently Android).
   */
  callbackName?: InjectedCallbackName
  callbackAliases?: readonly InjectedCallbackName[]
  timeoutMs?: number
  /**
   * Optional capability-specific multi-stage callback gate.
   *
   * The default remains one callback = one settled invocation. Capabilities with a confirmed
   * intermediate callback may return false here to keep the callbackId pending until a later
   * terminal payload arrives.
   */
  isTerminalPayload?: (payload: unknown, callbackCount: number) => boolean
}

type InjectedCallbackPending = {
  handle: (payload: unknown, callbackName: InjectedCallbackName) => void
}

type InjectedCallbackDispatcher = (callbackId: string, payload: unknown) => void

type InjectedCallbackChannel = {
  pending: Map<string, InjectedCallbackPending>
  dispatchers: Map<InjectedCallbackName, InjectedCallbackDispatcher>
  fallbacks: Map<InjectedCallbackName, InjectedCallbackDispatcher>
}

const injectedCallbackChannels = new WeakMap<
  NativeTransportWindow,
  Map<InjectedCallbackName, InjectedCallbackChannel>
>()
let injectedCallbackSequence = 0

function nextInjectedCallbackId(methodName: string): string {
  injectedCallbackSequence += 1
  return `${methodName}-${Date.now().toString(36)}-${injectedCallbackSequence.toString(36)}`
}

function installInjectedCallbackEndpoint(
  hostWindow: NativeTransportWindow,
  channels: Map<InjectedCallbackName, InjectedCallbackChannel>,
  channel: InjectedCallbackChannel,
  callbackName: InjectedCallbackName,
) {
  let dispatcher = channel.dispatchers.get(callbackName)
  if (!dispatcher) {
    dispatcher = (callbackId, payload) => {
      const request = channel.pending.get(callbackId)
      if (request) {
        request.handle(payload, callbackName)
        return
      }
      emitNativeBridgeTransportDebugEvent({
        type: 'callback',
        callbackId,
        callbackName,
        source: 'callback',
        pendingMatched: false,
        payload,
      })
      channel.fallbacks.get(callbackName)?.call(hostWindow, callbackId, payload)
    }
    channel.dispatchers.set(callbackName, dispatcher)
  }

  const current = hostWindow[callbackName]
  if (typeof current === 'function' && current !== dispatcher) {
    channel.fallbacks.set(callbackName, current)
  }

  hostWindow[callbackName] = dispatcher
  channels.set(callbackName, channel)
}

function getInjectedCallbackChannel(
  hostWindow: NativeTransportWindow,
  callbackName: InjectedCallbackName,
  callbackAliases: readonly InjectedCallbackName[] = [],
): InjectedCallbackChannel {
  let channels = injectedCallbackChannels.get(hostWindow)
  if (!channels) {
    channels = new Map()
    injectedCallbackChannels.set(hostWindow, channels)
  }

  const names = [...new Set([callbackName, ...callbackAliases])]
  let channel = names.map((name) => channels?.get(name)).find(Boolean)
  if (!channel) {
    channel = {
      pending: new Map(),
      dispatchers: new Map(),
      fallbacks: new Map(),
    }
  }

  for (const name of names) {
    installInjectedCallbackEndpoint(hostWindow, channels, channel, name)
  }

  return channel
}

export function createCallbackInjectedObjectTransport<TInput, TResult>(
  config: CallbackInjectedObjectTransportConfig<TInput, TResult>,
) {
  const parseResult = config.parseResult ?? identityResultParser<TResult>

  return {
    resolve(
      hostWindow: NativeTransportWindow | undefined,
      input: TInput,
    ): NativeTransportResolution<TResult> {
      const bridge = resolveHostObject(hostWindow, config.objectName)
      if (!bridge) {
        return {
          supported: false,
          code: 'bridge-unsupported',
          message: 'window.' + config.objectName + ' is not available in the current host.',
        }
      }
      const method = bridge[config.methodName]
      if (typeof method !== 'function') {
        return {
          supported: false,
          code: 'capability-unsupported',
          message: config.objectName + '.' + config.methodName + ' is not available in the current host.',
        }
      }

      return {
        supported: true,
        invoke: () => {
          if (!hostWindow) {
            throw new NativeTransportError(
              'callback-channel-unsafe',
              'Native callback channel is unavailable.',
            )
          }

          const callbackName = config.callbackName ?? 'nativeBridgeCallback'
          const callbackNames = [...new Set([callbackName, ...(config.callbackAliases ?? [])])]
          const channel = getInjectedCallbackChannel(
            hostWindow,
            callbackName,
            config.callbackAliases,
          )
          const callbackId = nextInjectedCallbackId(config.methodName)
          const timeoutMs = config.timeoutMs ?? INJECTED_CALLBACK_TIMEOUT_MS

          if (channel.pending.has(callbackId)) {
            throw new NativeTransportError(
              'callback-correlation-conflict',
              `Native callback id "${callbackId}" is already pending.`,
            )
          }

          return new Promise<TResult>((resolve, reject) => {
            let settled = false
            let callbackCount = 0

            const cleanup = () => {
              channel.pending.delete(callbackId)
              window.clearTimeout(timer)
            }
            const finish = (work: () => void) => {
              if (settled) return
              settled = true
              cleanup()
              work()
            }
            const handlePayload = (
              payload: unknown,
              source: 'callback' | 'method-return',
              endpoint: InjectedCallbackName | null,
            ) => {
              callbackCount += 1

              let isTerminal = true
              try {
                isTerminal = config.isTerminalPayload?.(payload, callbackCount) ?? true
              } catch (error) {
                emitNativeBridgeTransportDebugEvent({
                  type: 'callback',
                  objectName: config.objectName,
                  methodName: config.methodName,
                  callbackId,
                  callbackName: endpoint,
                  source,
                  callbackCount,
                  pendingMatched: true,
                  classificationError: error instanceof Error ? error.message : String(error),
                  payload,
                })
                finish(() =>
                  reject(
                    error instanceof NativeTransportError
                      ? error
                      : new NativeTransportError(
                          'payload-invalid',
                          `Native ${config.methodName} callback stage classifier failed.`,
                          error,
                        ),
                  ),
                )
                return
              }

              emitNativeBridgeTransportDebugEvent({
                type: 'callback',
                objectName: config.objectName,
                methodName: config.methodName,
                callbackId,
                callbackName: endpoint,
                source,
                callbackCount,
                pendingMatched: true,
                terminal: isTerminal,
                payload,
              })

              if (!isTerminal) return

              finish(() => {
                try {
                  resolve(parseResult(payload))
                } catch (error) {
                  reject(error)
                }
              })
            }

            channel.pending.set(callbackId, {
              handle: (payload, endpoint) => handlePayload(payload, 'callback', endpoint),
            })
            const timer = window.setTimeout(() => {
              emitNativeBridgeTransportDebugEvent({
                type: 'timeout',
                objectName: config.objectName,
                methodName: config.methodName,
                callbackId,
                timeoutMs,
              })
              finish(() =>
                reject(
                  new NativeTransportError(
                    'callback-timeout',
                    `Native ${config.methodName} callback timed out.`,
                  ),
                ),
              )
            }, timeoutMs)

            try {
              const args = config.serializeArgs(input, callbackId)
              emitNativeBridgeTransportDebugEvent({
                type: 'request',
                objectName: config.objectName,
                methodName: config.methodName,
                callbackId,
                callbackNames,
                timeoutMs,
                args,
              })
              const rawResult = method.call(bridge, ...args)
              if (rawResult !== undefined) handlePayload(rawResult, 'method-return', null)
            } catch (error) {
              finish(() =>
                reject(
                  error instanceof NativeTransportError
                    ? error
                    : new NativeTransportError(
                        'serialization-failed',
                        'Injected-object transport could not invoke the native method.',
                        error,
                      ),
                ),
              )
            }
          })
        },
      }
    },
  }
}

/**
 * Backward-compatible export for H026 callers. New cross-platform object bridges should use
 * createInjectedObjectTransport; Android and iOS now share the same injected-object mechanics.
 */
export type AndroidInjectedObjectTransportConfig<TInput, TResult> =
  InjectedObjectTransportConfig<TInput, TResult>
export const createAndroidInjectedObjectTransport = createInjectedObjectTransport

type IOSCallbackSuccess = {
  ok: true
  payload: unknown
}

type IOSCallbackFailure = {
  ok: false
  error?: unknown
}

export type IOSCallbackOutcome = IOSCallbackSuccess | IOSCallbackFailure

export type IOSRequestIdCallbackOutcome = IOSCallbackOutcome & {
  requestId: string
}

type IOSMessageHandlerTransportBase<TResult> = {
  handlerName: string
  timeoutMs?: number
  parseResult?: NativeResultParser<TResult>
}

export type IOSRequestIdTransportConfig<TInput, TResult> =
  IOSMessageHandlerTransportBase<TResult> & {
    correlation: 'request-id'
    serializeRequest: (context: { requestId: string; input: TInput }) => unknown
    parseCallback: (payload: unknown) => IOSRequestIdCallbackOutcome
  }

export type IOSSingleFlightTransportConfig<TInput, TResult> =
  IOSMessageHandlerTransportBase<TResult> & {
    correlation: 'single-flight'
    /**
     * Required host-protocol guarantee: after a request settles successfully or with Native failure,
     * Native will not emit a second callback for that invocation. Without request ids, a duplicate
     * callback cannot be distinguished from the callback for the next request.
     */
    callbackCardinality: 'at-most-one'
    serializeRequest: (context: { input: TInput }) => unknown
    parseCallback: (payload: unknown) => IOSCallbackOutcome
  }

export type IOSMessageHandlerTransportConfig<TInput, TResult> =
  | IOSRequestIdTransportConfig<TInput, TResult>
  | IOSSingleFlightTransportConfig<TInput, TResult>

type PendingCallback<TResult> = {
  resolve: (value: TResult) => void
  reject: (reason: unknown) => void
  timeoutId: ReturnType<typeof setTimeout>
}

const DEFAULT_CALLBACK_TIMEOUT_MS = 5_000
let requestSequence = 0

function defaultRequestIdFactory(): string {
  requestSequence += 1
  return 'h5-' + Date.now().toString(36) + '-' + requestSequence.toString(36)
}

function ensurePositiveTimeout(timeoutMs: number): void {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new NativeTransportError(
      'callback-timeout',
      'iOS callback transport requires a positive finite timeout.',
    )
  }
}

export function createIOSMessageHandlerTransport<TInput, TResult>(
  config: IOSMessageHandlerTransportConfig<TInput, TResult>,
) {
  const parseResult = config.parseResult ?? identityResultParser<TResult>
  const pending = new Map<string, PendingCallback<TResult>>()
  let singleFlightRequestId: string | undefined
  let singleFlightChannelUnsafe = false

  function cleanup(requestId: string): PendingCallback<TResult> | undefined {
    const entry = pending.get(requestId)
    if (!entry) return undefined

    clearTimeout(entry.timeoutId)
    pending.delete(requestId)
    if (singleFlightRequestId === requestId) singleFlightRequestId = undefined
    return entry
  }

  function rejectRequest(
    requestId: string,
    code: NativeTransportErrorCode,
    message: string,
    cause?: unknown,
  ): boolean {
    const entry = cleanup(requestId)
    if (!entry) return false

    entry.reject(new NativeTransportError(code, message, cause))
    return true
  }

  function resolveRequest(requestId: string, payload: unknown): boolean {
    const entry = cleanup(requestId)
    if (!entry) return false

    try {
      entry.resolve(parseResult(payload))
    } catch (error) {
      entry.reject(
        error instanceof NativeTransportError
          ? error
          : new NativeTransportError(
              'payload-invalid',
              'iOS callback transport could not parse the callback result.',
              error,
            ),
      )
    }

    return true
  }

  function invoke(
    handler: IOSMessageHandler,
    input: TInput,
    options: NativeTransportInvocationOptions,
  ): Promise<TResult> {
    const timeoutMs = options.timeoutMs ?? config.timeoutMs ?? DEFAULT_CALLBACK_TIMEOUT_MS

    try {
      ensurePositiveTimeout(timeoutMs)
    } catch (error) {
      return Promise.reject(error)
    }

    if (config.correlation === 'single-flight') {
      if (singleFlightChannelUnsafe) {
        return Promise.reject(
          new NativeTransportError(
            'callback-channel-unsafe',
            'This iOS single-flight callback channel timed out without a correlated callback and must be explicitly reset after host recovery before it can be reused.',
          ),
        )
      }

      if (singleFlightRequestId) {
        return Promise.reject(
          new NativeTransportError(
            'callback-concurrency-unsupported',
            'This iOS host protocol cannot safely correlate concurrent callbacks.',
          ),
        )
      }
    }

    // Request ids are runtime-owned. Do not allow capability-specific factories to reuse an id
    // after timeout, where a stale Native callback could otherwise settle a newer request.
    const requestId = defaultRequestIdFactory()

    if (pending.has(requestId)) {
      return Promise.reject(
        new NativeTransportError(
          'callback-correlation-conflict',
          'The iOS callback request id is already pending and cannot be reused.',
        ),
      )
    }

    let payload: unknown
    try {
      payload =
        config.correlation === 'request-id'
          ? config.serializeRequest({ requestId, input })
          : config.serializeRequest({ input })
    } catch (error) {
      return Promise.reject(
        error instanceof NativeTransportError
          ? error
          : new NativeTransportError(
              'serialization-failed',
              'iOS message-handler transport could not serialize the request.',
              error,
            ),
      )
    }

    return new Promise<TResult>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const entry = pending.get(requestId)
        if (!entry) return

        pending.delete(requestId)
        if (singleFlightRequestId === requestId) {
          singleFlightRequestId = undefined
          if (config.correlation === 'single-flight') singleFlightChannelUnsafe = true
        }
        entry.reject(
          new NativeTransportError(
            'callback-timeout',
            'iOS callback transport timed out before Native completed the request.',
          ),
        )
      }, timeoutMs)

      pending.set(requestId, { resolve, reject, timeoutId })
      if (config.correlation === 'single-flight') singleFlightRequestId = requestId

      try {
        handler.postMessage.call(handler, payload)
      } catch (error) {
        rejectRequest(
          requestId,
          'post-message-failed',
          'iOS messageHandler.postMessage threw during invocation.',
          error,
        )
      }
    })
  }

  return {
    resolve(
      hostWindow: NativeTransportWindow | undefined,
      input: TInput,
      options: NativeTransportInvocationOptions = {},
    ): NativeTransportResolution<TResult> {
      const messageHandlers = hostWindow?.webkit?.messageHandlers
      if (!messageHandlers) {
        return {
          supported: false,
          code: 'bridge-unsupported',
          message: 'window.webkit.messageHandlers is not available in the current host.',
        }
      }

      const handler = messageHandlers[config.handlerName]
      if (!handler || typeof handler.postMessage !== 'function') {
        return {
          supported: false,
          code: 'capability-unsupported',
          message:
            'webkit.messageHandlers.' +
            config.handlerName +
            ' is not available in the current host.',
        }
      }

      return {
        supported: true,
        invoke: () => invoke(handler, input, options),
      }
    },

    handleCallback(payload: unknown): boolean {
      let outcome: IOSCallbackOutcome
      let requestId: string | undefined

      try {
        if (config.correlation === 'request-id') {
          const parsed = config.parseCallback(payload)
          requestId = parsed.requestId
          outcome = parsed
        } else {
          outcome = config.parseCallback(payload)
          requestId = singleFlightRequestId
        }
      } catch {
        return false
      }

      if (!requestId) return false

      if (outcome.ok) {
        return resolveRequest(requestId, outcome.payload)
      }

      return rejectRequest(
        requestId,
        'callback-failed',
        'iOS callback reported a Native-side failure.',
        outcome.error,
      )
    },

    pendingCount(): number {
      return pending.size
    },

    /**
     * A single-flight protocol cannot distinguish a stale callback from the next request after a
     * timeout. Reuse therefore stays fail-closed until the host has been recovered/recreated or the
     * caller otherwise knows that the stale callback can no longer arrive.
     */
    resetSingleFlightAfterHostRecovery(): void {
      if (config.correlation !== 'single-flight') return

      if (singleFlightRequestId || pending.size > 0) {
        throw new NativeTransportError(
          'callback-concurrency-unsupported',
          'Cannot reset a single-flight callback channel while a request is still pending.',
        )
      }

      singleFlightChannelUnsafe = false
    },
  }
}

import {
  createCallbackInjectedObjectTransport,
  parseJsonPayload,
  NativeTransportError,
  serializeJsonValue,
  type NativeTransportWindow,
} from '../../nativeBridgeTransport'
import { defineCapability, resolveDualInjectedCapability } from '../core'
import { parseConfirmedNativeResult } from '../protocol'
import type {
  NativeScanCodeInput,
  NativeScanCodeResult,
} from '../types'

function validateInput(input: NativeScanCodeInput): NativeScanCodeInput {
  if (
    input === null ||
    typeof input !== 'object' ||
    !['qr', 'bar', 'all'].includes((input as { scanType?: unknown }).scanType as string)
  ) {
    throw new NativeTransportError(
      'payload-invalid',
      'Native scanCode() input requires scanType to be qr, bar, or all.',
    )
  }

  return input
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

/**
 * Normalize Android's current callback envelope while retaining the H5 adapter's
 * legacy one-shot { code: string } result shape. This parser does not imply that
 * iOS currently exposes a Native scanCode implementation.
 */
function parseResult(payload: unknown): NativeScanCodeResult {
  let parsed: unknown
  try {
    parsed = parseConfirmedNativeResult(payload)
  } catch (error) {
    if (error instanceof NativeTransportError && error.code !== 'payload-invalid') throw error
    parsed = parseJsonPayload(payload)
  }

  const envelope = asRecord(parsed)
  if (!envelope) {
    throw new NativeTransportError(
      'payload-invalid',
      'Native scanCode() result must be a JSON object.',
    )
  }

  const data = asRecord(envelope.data)
  const nativeCode = envelope.code
  if (typeof nativeCode === 'number' && nativeCode !== 0) {
    const errorCode =
      nativeCode === 1
        ? 'native-cancelled'
        : nativeCode === 2 || nativeCode === 3
          ? 'native-permission-denied'
          : 'native-failed'
    const message = typeof envelope.message === 'string' && envelope.message
      ? envelope.message
      : 'Native scanCode reported failure.'
    throw new NativeTransportError(errorCode, message)
  }

  const code = typeof nativeCode === 'string' && nativeCode.length > 0
    ? nativeCode
    : data?.text
  if (typeof code !== 'string' || code.length === 0) {
    throw new NativeTransportError(
      'payload-invalid',
      'Native scanCode() result must contain a non-empty QR text.',
    )
  }

  const scanType = data?.scanType
  return {
    code,
    ...(scanType === 'qr' || scanType === 'bar' || scanType === 'all' ? { scanType } : {}),
    ...(typeof data?.isDevice === 'boolean' ? { isDevice: data.isDevice } : {}),
    ...(typeof data?.consumeUse === 'string' ? { consumeUse: data.consumeUse } : {}),
  }
}

const androidTransport = createCallbackInjectedObjectTransport<
  NativeScanCodeInput,
  NativeScanCodeResult
>({
  objectName: 'androidBridge',
  methodName: 'scanCode',
  callbackName: 'nativeBridgeCallback',
  callbackAliases: ['androidBridgeCallback'],
  serializeArgs: (input, callbackId) => [serializeJsonValue({ ...validateInput(input), callbackId })],
  // Android feat/1109 returns one callback per H5 scan invocation. Native device
  // screens remain Native-owned after their start callback; no second H5 callback is awaited.
  parseResult,
})

const iosTransport = createCallbackInjectedObjectTransport<
  NativeScanCodeInput,
  NativeScanCodeResult
>({
  objectName: 'iosBridge',
  methodName: 'scanCode',
  callbackName: 'nativeBridgeCallback',
  serializeArgs: (input, callbackId) => [serializeJsonValue({ ...validateInput(input), callbackId })],
  // Preserve the H5 adapter's existing one-shot parsing; never infer Android metadata on iOS.
  parseResult,
})

function resolveTransport(hostWindow: NativeTransportWindow | undefined) {
  return resolveDualInjectedCapability<NativeScanCodeInput, NativeScanCodeResult>(
    hostWindow,
    'scanCode',
    { scanType: 'all' },
    (input) => androidTransport.resolve(hostWindow!, input),
    (input) => iosTransport.resolve(hostWindow!, input),
  )
}

export const scanCodeCapability = defineCapability<
  'scanCode',
  NativeScanCodeInput,
  NativeScanCodeResult
>({
  name: 'scanCode',
  platforms: ['android', 'ios'],
  description:
    'Scan a QR code, barcode, or either through the injected-object adapter where the host exposes scanCode.',
  sensitiveResult: true,
  resolve: resolveTransport,
})

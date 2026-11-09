import { parseBuddyInviteCode } from './buddyRelations'
import type { NativeHost, NativeScanCodeResult } from './nativeBridge'

export type NativeScanDestination =
  | { kind: 'buddy'; raw: string }
  | { kind: 'unsupported'; reason: 'origin-not-configured' | 'unknown-code' }
  | { kind: 'device'; code: string; nativeTransactionComplete: boolean }

/**
 * Resolve the H5 destination only after the Native adapter has delivered its business result.
 * The Native isDevice flag separates recognition-only QR codes from device-owned transactions;
 * URL validation then prevents unrelated non-device QR codes from entering the buddy flow.
 */
export function resolveNativeScanDestination(
  result: NativeScanCodeResult,
  host: NativeHost,
  trustedOrigin?: string,
): NativeScanDestination {
  if (result.isDevice !== false) {
    return {
      kind: 'device',
      code: result.code,
      nativeTransactionComplete: host === 'android',
    }
  }

  if (!trustedOrigin?.trim()) {
    return { kind: 'unsupported', reason: 'origin-not-configured' }
  }

  try {
    parseBuddyInviteCode(result.code, trustedOrigin)
    return { kind: 'buddy', raw: result.code }
  } catch {
    return { kind: 'unsupported', reason: 'unknown-code' }
  }
}

export function getNativeScanUnsupportedMessage(
  reason: Extract<NativeScanDestination, { kind: 'unsupported' }>['reason'],
): string {
  return reason === 'origin-not-configured'
    ? '当前 App 未配置搭子二维码域名，暂无法识别邀请'
    : '暂不支持此二维码，请扫描设备码或洗头搭子邀请二维码'
}

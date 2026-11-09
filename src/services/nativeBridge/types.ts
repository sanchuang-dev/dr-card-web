export type NativeHost = 'android' | 'ios' | 'browser'
export type NativeCapabilityPlatform = Exclude<NativeHost, 'browser'>

export type NativeBridgeErrorCode =
  | 'bridge-disabled'
  | 'bridge-unsupported'
  | 'capability-unsupported'
  | 'native-cancelled'
  | 'native-permission-denied'
  | 'native-failed'
  | 'invocation-failed'
  | 'invocation-timeout'

export type NativeInvocationOptions = {
  timeoutMs?: number
}

export interface NativeLoginToken {
  token: string
  /**
   * Optional for backwards compatibility with older hosts that only returned token.
   * Callers that need signed Card API requests must validate presence before use.
   */
  salt?: string
}

export type NativeScanType = 'qr' | 'bar' | 'all'

export interface NativeScanCodeInput {
  scanType: NativeScanType
}

export interface NativeScanCodeResult {
  /** Raw text decoded by the Native scanner. */
  code: string
  /** Native classification: false is a recognition-only QR; true enters the device transaction. */
  isDevice?: boolean
  scanType?: NativeScanType
}

export interface NativeTakePhotoInput {
  crop: boolean
  maxWidth: number
  maxHeight: number
  quality: number
}

export interface NativeChooseImageInput extends NativeTakePhotoInput {
  count: number
}

export interface NativeImageResult {
  mimeType: string
  imageBase64: string
}

export type NativeSavedImageType = 'base64' | 'url'

export interface NativeSaveImageToAlbumInput {
  imageType: NativeSavedImageType
  imageData: string
  fileName: string
}

export interface NativeCopyTextInput {
  text: string
}

export interface NativeSuccessResult {
  success: boolean
}

export type NativeRewardAdStatus = 'completed' | 'closed' | 'failed' | 'no_fill'

export interface NativeRewardAdInput {
  scene: 'h5CheckinResign'
}

export interface NativeRewardAdResult {
  status: NativeRewardAdStatus
}

export type NativeOpenAppAction = 'open' | 'store' | 'detect'

export interface NativeOpenAppInput {
  action: NativeOpenAppAction
  inviteCode: string
  fallbackUrl: string
}

export interface NativeOpenAppResult {
  success: boolean
  installed: boolean
}

export type NativeFailurePayloadCode = 'cancel' | 'permission_denied' | 'fail'

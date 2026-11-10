import { useState } from 'react'

import { Skeleton } from '../../components/ui'
import { fetchWelfareOfficerConfig } from '../../services/welfareOfficer'
import { useRemoteData } from '../profile/useProfileFeed'

/**
 * The "企微客服" entry shares the real enterprise-WeChat QR configured for
 * /service/welfare-officer. Never substitute a decorative QR in API mode.
 */
export default function ServiceChatWecomQr() {
  const { remote, reload } = useRemoteData(fetchWelfareOfficerConfig)
  const [failedUrl, setFailedUrl] = useState<string | null>(null)

  if (remote.state === 'loading') {
    return (
      <div role="status" aria-label="正在加载企业微信二维码" className="flex flex-col items-center gap-3">
        <Skeleton className="h-[176px] w-[176px] rounded-xl" />
        <Skeleton className="h-3 w-40" />
      </div>
    )
  }

  if (remote.state === 'error') {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 text-sm text-text-secondary">
        <p>企业微信二维码加载失败</p>
        <button type="button" onClick={reload} className="min-h-11 rounded-pill px-4 font-medium text-text-brand">
          重试
        </button>
      </div>
    )
  }

  const { qrcodeUrl, qrcodeUnavailable, subtitle } = remote.data
  const imageFailed = qrcodeUrl !== undefined && qrcodeUrl === failedUrl

  if (!qrcodeUrl || imageFailed) {
    return (
      <div role="status" className="flex flex-col items-center gap-3 text-sm text-text-secondary">
        <p>{imageFailed ? '二维码图片加载失败' : qrcodeUnavailable ? '二维码图片地址不可用' : '暂未配置企业微信二维码'}</p>
        {(imageFailed || qrcodeUnavailable) && (
          <button type="button" onClick={() => { setFailedUrl(null); reload() }}
            className="min-h-11 rounded-pill px-4 font-medium text-text-brand">
            重试
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="rounded-xl bg-white p-3 shadow-sm">
        <img
          src={qrcodeUrl}
          alt="企业微信福利官二维码"
          className="h-[176px] w-[176px] object-contain"
          onError={() => setFailedUrl(qrcodeUrl)}
        />
      </div>
      {subtitle && <p className="mt-3 text-sm font-medium text-text-primary">{subtitle}</p>}
      <p className="mt-2 text-xs text-text-tertiary">使用微信扫码，联系企业微信福利官</p>
    </div>
  )
}

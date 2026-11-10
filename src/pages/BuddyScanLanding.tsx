import { ScanLine } from 'lucide-react'
import buddyScanMascot from '../assets/brand/buddy/buddy-scan-guide-mascot.webp'

/**
 * #102 洗头搭子唯一二维码的外部扫码落地页。
 *
 * 微信/系统相机仅显示引导，不展示邀请人信息，也不执行任何绑定动作。
 * 不检测安装态、不尝试唤起 App 或跳转未知商店地址。
 * 扫码入口仍按已确认的 Native / H5 合同处理，页面只负责说明。
 */
export default function BuddyScanLanding() {
  return (
    <main
      className="flex min-h-dvh flex-col items-center px-6 pb-[calc(28px+env(safe-area-inset-bottom))] pt-[calc(30px+env(safe-area-inset-top))] text-center text-text-primary"
      style={{
        background:
          'radial-gradient(ellipse 72% 30% at 50% 24%, rgba(255,219,164,.36), transparent 100%), linear-gradient(180deg, #fffcf6 0%, #fff8ee 100%)',
      }}
      aria-label="洗头搭子扫码使用提示"
    >
      <div className="w-full max-w-[420px]">
        <p className="m-0 text-[11px] font-bold tracking-[0.3em] text-text-secondary">
          KABOS · SCAN GUIDE
        </p>

        <img
          src={buddyScanMascot}
          alt="小博士举着卡博士 App 手机并指向屏幕"
          className="mx-auto mt-4 block h-auto w-full max-w-[392px] select-none"
          draggable={false}
          decoding="async"
          width={1176}
          height={776}
        />

        <p className="mx-auto mt-1 w-fit rounded-full border border-[#ffe6cc] bg-[#fff1e3] px-4 py-1.5 text-[11px] text-text-secondary">
          洗头搭子 · 扫码指引
        </p>

        <h1 className="mt-6 text-[25px] font-bold leading-[1.4] tracking-tight text-[#30241d]">
          认识新搭子，
          <span className="block text-[#eb6a34]">请在 App 内扫码</span>
        </h1>

        <p className="mx-auto mt-3 max-w-[315px] text-sm leading-[1.9] text-text-secondary">
          洗头搭子二维码需要使用卡博士 App 中的「诗得丽扫一扫」识别，微信或系统相机无法直接绑定搭子。
        </p>

        <div
          className="mx-auto mt-7 flex w-full max-w-[326px] items-center gap-3 rounded-[19px] border border-[#ffe6cb] bg-[#fdf0df] px-4 py-4 text-left"
          role="note"
          aria-label="扫码操作指引"
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#f5743e] text-white"
            aria-hidden="true"
          >
            <ScanLine className="h-6 w-6" />
          </span>
          <div>
            <strong className="block text-[14px] font-semibold leading-[1.6] text-[#30241d]">
              打开卡博士 App → 底部「扫码」
            </strong>
            <span className="mt-1 block text-xs text-text-secondary">
              微信扫一扫 / 系统相机暂不支持
            </span>
          </div>
        </div>
      </div>

      <footer className="mt-auto pt-9 text-xs leading-[1.7] text-text-secondary">
        尚未安装？请通过官方渠道获取卡博士 App。
        <div className="mx-auto mt-4 h-[3px] w-[30px] rounded-full bg-[#f7cfad]" aria-hidden="true" />
      </footer>
    </main>
  )
}

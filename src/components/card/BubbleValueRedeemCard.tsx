import { useId } from 'react'

export interface BubbleValueRedeemCardProps {
  value?: number | string
  className?: string
  onRedeem?: () => void
}

/**
 * 我的泡泡值兑换卡（洗护体验券专区顶部横条）
 * -------------------------------------------------------------
 * 视觉来源：用户 2026-09-29 提供的 bubble-value-card.svg / BubbleValueRedeemCard.tsx。
 * 保留原 SVG 余额、礼物和色系；兑换引导按钮按 2026-10-10 用户反馈使用更柔和的暖金配色。
 * CTA 仅滚动到下方体验券列表，不直接提交兑换。
 * 仅为渐变 / 滤镜 DOM id 加实例前缀，避免同页多实例 id 冲突。
 */
const FONT_FAMILY = 'PingFang SC, Microsoft YaHei, Noto Sans CJK SC, sans-serif'

export default function BubbleValueRedeemCard({ value = 0, className, onRedeem }: BubbleValueRedeemCardProps) {
  const displayValue = typeof value === 'number' ? value.toLocaleString('en-US') : value
  const instanceId = useId()
  const ids = {
    bg: `${instanceId}-bg`,
    buttonBg: `${instanceId}-button-bg`,
    giftTop: `${instanceId}-gift-top`,
    giftBody: `${instanceId}-gift-body`,
    halo: `${instanceId}-halo`,
    shadow: `${instanceId}-shadow`,
    buttonShadow: `${instanceId}-button-shadow`,
  }

  return (
    <svg
      className={className}
      viewBox="0 0 978 251"
      width="100%"
      role={onRedeem ? 'group' : 'img'}
      aria-label={`我的泡泡值 ${displayValue}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={ids.bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFDF8" />
          <stop offset="1" stopColor="#FFF5E5" />
        </linearGradient>
        <linearGradient id={ids.buttonBg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF9EE" />
          <stop offset="0.55" stopColor="#FFF0D9" />
          <stop offset="1" stopColor="#FFE1B9" />
        </linearGradient>
        <linearGradient id={ids.giftTop} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE3A7" />
          <stop offset="1" stopColor="#FFD27C" />
        </linearGradient>
        <linearGradient id={ids.giftBody} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF0C8" />
          <stop offset="1" stopColor="#FFC560" />
        </linearGradient>
        <radialGradient id={ids.halo} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#FFEFCF" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FFF4DD" stopOpacity="0" />
        </radialGradient>
        <filter id={ids.shadow} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="5" stdDeviation="8" floodColor="#EFB75F" floodOpacity="0.18" />
        </filter>
        <filter id={ids.buttonShadow} x="-20%" y="-45%" width="140%" height="190%">
          <feDropShadow dx="0" dy="5" stdDeviation="7" floodColor="#C67B37" floodOpacity="0.18" />
        </filter>
      </defs>

      <rect x="15" y="28" width="948" height="205" rx="26" fill={`url(#${ids.bg})`} stroke="#F1D49F" strokeWidth="1.5" />

      <text x="57" y="82" fill="#79563C" fontSize="28" fontFamily={FONT_FAMILY} fontWeight="500">
        我的泡泡值
      </text>

      <text y="153" fontFamily={FONT_FAMILY}>
        <tspan x="57" fill="#EF4B00" fontSize="66" fontWeight="700">
          {displayValue}
        </tspan>
        <tspan dx="18" fill="#8E4A18" fontSize="34" fontWeight="650">
          泡泡值
        </tspan>
      </text>

      <text x="57" y="202" fill="#9B866F" fontSize="26" fontFamily={FONT_FAMILY} fontWeight="400">
        兑换洗护体验券，享受更多权益
      </text>

      <path d="M468 123c7-2 12-7 14-14 2 7 7 12 14 14-7 2-12 7-14 14-2-7-7-12-14-14Z" fill="#FFC94B" />
      <path d="M675 76c7-2 12-7 14-14 2 7 7 12 14 14-7 2-12 7-14 14-2-7-7-12-14-14Z" fill="#FFC94B" />

      <circle cx="588" cy="121" r="74" fill={`url(#${ids.halo})`} />
      <g transform="translate(532 75) rotate(7 56 55)" filter={`url(#${ids.shadow})`}>
        <rect x="11" y="42" width="91" height="76" rx="8" fill={`url(#${ids.giftBody})`} />
        <rect x="4" y="34" width="105" height="25" rx="7" fill={`url(#${ids.giftTop})`} />
        <rect x="50" y="34" width="15" height="84" fill="#F9A52A" />
        <rect x="4" y="43" width="105" height="9" rx="4.5" fill="#FFF2D1" opacity="0.8" />
        <path d="M55 33c-14-20-29-22-34-12-4 9 6 16 34 19" fill="none" stroke="#F39B22" strokeWidth="8" strokeLinecap="round" />
        <path d="M60 33c14-20 29-22 34-12 4 9-6 16-34 19" fill="none" stroke="#F39B22" strokeWidth="8" strokeLinecap="round" />
      </g>

      <g
        className="group"
        onClick={onRedeem}
        style={{ cursor: onRedeem ? 'pointer' : 'default' }}
        role={onRedeem ? 'button' : undefined}
        aria-label={onRedeem ? '立即兑换' : undefined}
        tabIndex={onRedeem ? 0 : undefined}
        onKeyDown={(event) => {
          if (!onRedeem || (event.key !== 'Enter' && event.key !== ' ')) return
          event.preventDefault()
          onRedeem()
        }}
      >
        {/* 放大可触摸区域，但不挤压插画或余额文案。 */}
        <rect x="670" y="72" width="285" height="128" rx="48" fill="transparent" data-redeem-hit-area />
        <rect
          x="686" y="91" width="254" height="90" rx="45"
          fill={`url(#${ids.buttonBg})`}
          stroke="#F1BC80" strokeWidth="2"
          filter={`url(#${ids.buttonShadow})`}
        />
        <text x="714" y="148" fill="#B54C13" fontSize="32" fontFamily={FONT_FAMILY} fontWeight="700">
          立即兑换
        </text>
        <circle cx="898" cy="136" r="24" fill="#EA6D2C" />
        <path d="m892 128 8 8-8 8" fill="none" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        <rect
          x="683" y="88" width="260" height="96" rx="48"
          fill="none" stroke="#B54C13" strokeWidth="3"
          className="pointer-events-none opacity-0 group-focus-visible:opacity-100"
        />
      </g>
    </svg>
  )
}

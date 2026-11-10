import emptyIllustration from '../../assets/brand/empty/empty-illustration.webp'

export interface EmptyStateIllustrationProps {
  label?: string
  className?: string
  /** 整页空状态使用 md（168px）；卡片、小区域使用 sm（128px）。 */
  size?: 'sm' | 'md'
}

const IMAGE_SIZE_CLASS: Record<NonNullable<EmptyStateIllustrationProps['size']>, string> = {
  sm: 'h-32 w-32',
  md: 'h-[168px] w-[168px]',
}

/**
 * 品牌空状态插画，只负责视觉，不负责业务状态、文案或操作。
 * 默认 md：整页空状态 168px；sm：卡片及小区域 128px。
 * 调用方保留 className 布局能力；不修改原素材及无障碍语义。
 */
export default function EmptyStateIllustration({
  label,
  className = '',
  size = 'md',
}: EmptyStateIllustrationProps) {
  return (
    <span data-empty-state-illustration className={`flex items-center justify-center ${className}`}>
      <img
        src={emptyIllustration}
        alt={label ?? ''}
        aria-hidden={label ? undefined : true}
        role={label ? 'img' : undefined}
        draggable={false}
        className={`${IMAGE_SIZE_CLASS[size]} select-none object-contain`}
      />
    </span>
  )
}

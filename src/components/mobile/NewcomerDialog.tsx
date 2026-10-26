import PromptOverlay from './PromptOverlay'
import { Button } from '../ui'

export interface NewcomerDialogProps {
  open: boolean
  title: string
  description: string
  points: number | string
  onComplete: () => void
  onDismiss: () => void
}

/** Displays the new-user bubble-points reward returned by the login API. */
export default function NewcomerDialog({ open, title, description, points, onComplete, onDismiss }: NewcomerDialogProps) {
  return (
    <PromptOverlay open={open} label="新人泡泡值赠送提示" onDismiss={onDismiss}>
      <div className="bg-[var(--color-surface-overlay-warm)] px-5 pb-5 pt-6 text-center">
        <span className="mx-auto inline-flex rounded-pill bg-reward-subtle px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-reward-text">新人福利</span>
        <h2 className="mt-3 text-xl font-bold leading-7 text-text-primary">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-text-secondary">{description}</p>
        <div className="mx-auto mt-5 flex min-h-24 w-full flex-col items-center justify-center rounded-container border border-reward/30 bg-reward-subtle px-4 py-3">
          <span className="text-xs font-medium text-reward-text">赠送泡泡值</span>
          <span className="mt-1 text-3xl font-extrabold tabular-nums text-reward-text">{points}</span>
        </div>
      </div>
      <div className="bg-surface px-5 pb-5 pt-4">
        <Button size="large" className="w-full rounded-pill" onClick={onComplete}>我知道了</Button>
      </div>
    </PromptOverlay>
  )
}

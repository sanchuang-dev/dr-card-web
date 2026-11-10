import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import BubbleValueRedeemCard from './BubbleValueRedeemCard'

describe('BubbleValueRedeemCard', () => {
  it('keeps SVG definition ids unique across component instances', () => {
    const { container } = render(
      <>
        <BubbleValueRedeemCard value={1280} />
        <BubbleValueRedeemCard value={2560} />
      </>,
    )

    const ids = Array.from(container.querySelectorAll('defs [id]')).map((node) => node.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps the enlarged SVG touch region interactive without changing the CTA action', () => {
    const onRedeem = vi.fn()
    const { container } = render(<BubbleValueRedeemCard value={110} onRedeem={onRedeem} />)

    const touchArea = container.querySelector('[data-redeem-hit-area]')
    expect(touchArea?.getAttribute('height')).toBe('128')
    expect(screen.getByRole('button', { name: '立即兑换' })).toBeTruthy()
    fireEvent.click(touchArea!)
    expect(onRedeem).toHaveBeenCalledTimes(1)
  })

  it('has no interactive CTA when redemption navigation is unavailable', () => {
    render(<BubbleValueRedeemCard value={110} />)
    expect(screen.queryByRole('button', { name: '立即兑换' })).toBeNull()
  })

  it('exposes the redeem CTA to keyboard users', () => {
    const onRedeem = vi.fn()
    render(<BubbleValueRedeemCard value={1280} onRedeem={onRedeem} />)

    const action = screen.getByRole('button', { name: '立即兑换' })
    fireEvent.keyDown(action, { key: 'Enter' })
    fireEvent.keyDown(action, { key: ' ' })

    expect(onRedeem).toHaveBeenCalledTimes(2)
  })
})

import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { VERIFY_FEEDBACK, VERIFY_VOUCHER_FIXTURE } from '../app/fixtures'
import ConfirmVerify from './ConfirmVerify'

describe('ConfirmVerify Native scan result boundary', () => {
  it('does not treat a legacy Native scan callback as completed card redemption', () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/card/verify/confirm',
            state: {
              nativeScanCode: 'REAL-SCAN-CODE',
              nativeVerifyResult: 'done',
            },
          },
        ]}
      >
        <Routes>
          <Route path="/card/verify/confirm" element={<ConfirmVerify />} />
          <Route path="/card" element={<div>real-card-route</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('即将核销此券')).toBeTruthy()
    expect(screen.getByText(VERIFY_VOUCHER_FIXTURE.store)).toBeTruthy()
    expect(screen.queryByRole('button', { name: '返回卡包' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '确认核销' }))
    expect(screen.getByText(VERIFY_FEEDBACK.done.title)).toBeTruthy()
  })
})

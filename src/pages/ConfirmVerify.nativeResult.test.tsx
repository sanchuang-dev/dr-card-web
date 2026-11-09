import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
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
    expect(screen.queryByText(VERIFY_FEEDBACK.done.title)).toBeNull()
    expect(screen.getByText('真实核销服务尚未接入，此页面暂不能执行核销')).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: '真实核销暂未接入' }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })
})

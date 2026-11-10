import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  detectInstalledApp: vi.fn(),
  openInstalledApp: vi.fn(),
  openNativeAppStore: vi.fn(),
}))

vi.mock('../app/adapters/appOpen', () => ({
  detectInstalledApp: mocks.detectInstalledApp,
  openInstalledApp: mocks.openInstalledApp,
  openNativeAppStore: mocks.openNativeAppStore,
}))

import BuddyScanLanding from './BuddyScanLanding'

describe('BuddyScanLanding #102 public external QR guidance', () => {
  it('shows the approved mascot and explains that binding is App-only, without external actions', () => {
    render(<BuddyScanLanding />)

    expect(screen.getByRole('main', { name: '洗头搭子扫码使用提示' })).toBeTruthy()
    expect(screen.getByRole('img', { name: /小博士举着卡博士 App/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /认识新搭子.*请在 App 内扫码/ })).toBeTruthy()
    expect(screen.getByText(/微信或系统相机无法直接绑定搭子/)).toBeTruthy()
    expect(screen.getByText(/尚未安装？请通过官方渠道获取卡博士 App/)).toBeTruthy()
    expect(screen.getByRole('note', { name: '扫码操作指引' })).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('does not detect installed state, open App or store, or start any invitation transaction', () => {
    mocks.detectInstalledApp.mockReset()
    mocks.openInstalledApp.mockReset()
    mocks.openNativeAppStore.mockReset()

    render(<BuddyScanLanding />)

    expect(mocks.detectInstalledApp).not.toHaveBeenCalled()
    expect(mocks.openInstalledApp).not.toHaveBeenCalled()
    expect(mocks.openNativeAppStore).not.toHaveBeenCalled()
  })
})

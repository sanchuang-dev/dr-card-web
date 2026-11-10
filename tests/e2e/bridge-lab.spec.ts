import { expect, test } from '@playwright/test'

test.describe('H027 Bridge Lab', () => {
  test('scopes registered capabilities and Raw Probe by osType=android', async ({ page }) => {
    await page.goto('/__debug/bridge-lab?osType=android', { waitUntil: 'domcontentloaded' })

    await expect(page.locator('[data-bridge-lab]')).toBeVisible()
    await expect(page.locator('[data-bridge-lab]')).toHaveAttribute('data-lab-platform', 'android')
    await expect(page.locator('[data-capability-name="getLoginToken"]')).toBeVisible()
    await expect(page.locator('[data-capability-name="closeWebView"]')).toBeVisible()
    await expect(page.locator('[data-capability-name="scanCode"]')).toBeVisible()
    await expect(page.locator('[data-capability-name="openApp"]')).toBeVisible()
    await expect(page.locator('[data-android-raw-probe]')).toBeVisible()
    await expect(page.locator('[data-ios-raw-probe]')).toHaveCount(0)

    await page.getByLabel('Android method').fill('missingMethod')
    await page.getByRole('button', { name: 'Run Android Probe' }).click()

    await expect(page.locator('[data-bridge-lab-logs]')).toContainText(
      'window.androidBridge is not available in the current host.',
    )
  })

  test('registered async capability uses callbackId and the unified nativeBridgeCallback target', async ({ page }) => {
    await page.addInitScript(() => {
      const host = window as unknown as {
        androidBridge?: {
          copyText(payload: unknown): void
        }
        nativeBridgeCallback?: (callbackId: string, payload: unknown) => void
      }
      host.androidBridge = {
        copyText(payload) {
          const request = JSON.parse(payload as string) as {
            text: string
            callbackId: string
          }
          setTimeout(() => {
            host.nativeBridgeCallback?.(request.callbackId, {
              code: 0,
              message: 'ok',
              data: {},
            })
          }, 0)
        },
      }
    })

    await page.goto('/__debug/bridge-lab?osType=android', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-callback-endpoint="nativeBridgeCallback"]')).toBeVisible()
    await expect(page.locator('[data-callback-endpoint="androidBridgeCallback"]')).toBeVisible()

    await page.locator('[data-capability-name="copyText"]').click()
    await page.getByLabel('input JSON').fill('{"text":"bridge-e2e"}')
    await page.getByRole('button', { name: '调用 copyText' }).click()

    const logs = page.locator('[data-bridge-lab-logs]')
    await expect(logs).toContainText('capability · copyText')
    await expect(logs).toContainText('"success": true')
  })

  test('shows the single Android scan callback and redacts QR text by default', async ({ page }) => {
    await page.addInitScript(() => {
      const host = window as unknown as {
        androidBridge?: { scanCode(payload: unknown): void }
        androidBridgeCallback?: (callbackId: string, payload: unknown) => void
      }
      host.androidBridge = {
        scanCode(payload) {
          const request = JSON.parse(payload as string) as { callbackId: string }
          setTimeout(() => {
            host.androidBridgeCallback?.(request.callbackId, {
              code: 0,
              message: 'ok',
              data: {
                text: 'e2e-buddy-qr-private',
                scanType: 'qr',
                isDevice: false,
              },
            })
          }, 0)
        },
      }
    })

    await page.goto('/__debug/bridge-lab?osType=android', { waitUntil: 'domcontentloaded' })
    await page.locator('[data-capability-name="scanCode"]').click()
    await page.getByRole('button', { name: '调用 scanCode' }).click()

    const logs = page.locator('[data-bridge-lab-logs]')
    await expect(logs).toContainText('Native invoke · androidBridge.scanCode')
    await expect(logs).toContainText('androidBridgeCallback')
    await expect(logs).toContainText('terminal')
    await expect(logs).toContainText('[REDACTED]')
    await expect(logs).toContainText('"isDevice": false')
    await expect(logs).not.toContainText('e2e-buddy-qr-private')
  })

  test('Native can still call the legacy window.testFunc endpoint', async ({ page }) => {
    await page.goto('/__debug/bridge-lab?osType=android', { waitUntil: 'domcontentloaded' })

    await expect(page.locator('[data-h5-callback-endpoints]')).toBeVisible()
    await expect(page.locator('[data-callback-endpoint="nativeBridgeCallback"]')).toBeVisible()
    await page.waitForFunction(() => {
      const host = window as unknown as { testFunc?: unknown }
      return typeof host.testFunc === 'function'
    })

    const result = await page.evaluate(() => {
      const host = window as unknown as {
        testFunc?: (params: unknown) => string
      }
      return host.testFunc?.({ from: 'android-native', value: 7 })
    })

    expect(result).toBe('h5 处理完成')
    await expect(page.locator('[data-bridge-lab-logs]')).toContainText('window.testFunc(params)')
    await expect(page.locator('[data-bridge-lab-logs]')).toContainText('android-native')
  })

  test('Android bridge preset preserves receiver and masks a token result by default', async ({ page }) => {
    await page.addInitScript(() => {
      const bridge = {
        marker: 'real-receiver',
        getLoginToken() {
          return this.marker === 'real-receiver'
            ? '{"token":"e2e-secret-token"}'
            : '{"token":"wrong-receiver"}'
        },
      }
      ;(window as unknown as { androidBridge: typeof bridge }).androidBridge = bridge
    })

    await page.goto('/__debug/bridge-lab?osType=android', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Android preset getLoginToken' }).click()
    await page.getByRole('button', { name: 'Run Android Probe' }).click()

    const logs = page.locator('[data-bridge-lab-logs]')
    await expect(logs).toContainText('[REDACTED]')
    await expect(logs).not.toContainText('e2e-secret-token')

    await page.getByRole('button', { name: '显式显示原始结果' }).click()
    await expect(logs).toContainText('e2e-secret-token')
    await expect(logs).not.toContainText('wrong-receiver')
  })

  test('iOS uses registered iosBridge.getLoginToken while keeping the old callback protocol as Raw Probe', async ({ page }) => {
    await page.addInitScript(() => {
      const host = window as unknown as {
        iosBridge?: {
          getLoginToken(): string
        }
        webkit?: {
          messageHandlers?: Record<string, { postMessage(payload: unknown): void }>
        }
        onToken?: (payload: unknown) => void
      }
      host.iosBridge = {
        getLoginToken() {
          return '{"token":"ios-registered-secret"}'
        },
      }
      host.webkit = {
        messageHandlers: {
          getAuthorizationInfo: {
            postMessage(payload) {
              setTimeout(() => host.onToken?.({ token: 'ios-legacy-secret', echo: payload }), 0)
            },
          },
        },
      }
    })

    await page.goto('/__debug/bridge-lab?osType=ios', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-bridge-lab]')).toHaveAttribute('data-lab-platform', 'iOS')
    await expect(page.locator('[data-ios-raw-probe]')).toBeVisible()
    await expect(page.locator('[data-android-raw-probe]')).toHaveCount(0)
    await expect(page.locator('[data-capability-name="getLoginToken"]')).toBeVisible()
    await expect(page.locator('[data-capability-name="getAuthorizationInfo"]')).toHaveCount(0)
    await expect(page.locator('[data-capability-name="closeWebView"]')).toBeVisible()
    await expect(page.locator('[data-capability-name="scanCode"]')).toBeVisible()
    await expect(page.locator('[data-capability-name="openApp"]')).toBeVisible()

    const registered = page.locator('[data-capability-name="getLoginToken"]')
    await registered.click()
    await expect(page.getByRole('button', { name: '调用 getLoginToken' })).toBeEnabled()
    await page.getByRole('button', { name: '调用 getLoginToken' }).click()

    const logs = page.locator('[data-bridge-lab-logs]')
    await expect(logs).toContainText('capability · getLoginToken')
    await expect(logs).toContainText('[REDACTED]')
    await expect(logs).not.toContainText('ios-registered-secret')

    await page.getByRole('button', { name: 'iOS preset getAuthorizationInfo' }).click()
    await page.getByRole('button', { name: 'Run iOS Probe' }).click()

    await expect(logs).toContainText('iOS Raw · getAuthorizationInfo')
    await expect(logs).not.toContainText('ios-legacy-secret')
  })

  test('web mode does not expose either platform Raw Probe', async ({ page }) => {
    await page.goto('/__debug/bridge-lab', { waitUntil: 'domcontentloaded' })

    await expect(page.locator('[data-bridge-lab]')).toHaveAttribute('data-lab-platform', 'web')
    await expect(page.locator('[data-android-raw-probe]')).toHaveCount(0)
    await expect(page.locator('[data-ios-raw-probe]')).toHaveCount(0)
    await expect(page.locator('[data-web-platform-hint]')).toContainText('?osType=android')
    await expect(page.locator('[data-web-platform-hint]')).toContainText('?osType=iOS')
  })
})

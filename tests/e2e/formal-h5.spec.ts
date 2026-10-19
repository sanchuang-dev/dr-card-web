import { expect, test, type Page } from '@playwright/test'
import { ACTIVE_FORMAL_H5_ROUTES } from '../../src/app/router/routeScope'

const staticFormalRoutes = ACTIVE_FORMAL_H5_ROUTES
  .filter((route) => !route.path.includes(':'))
  .map((route) => ({ path: route.path, title: route.title }))
  .sort((a, b) => a.path.localeCompare(b.path))

const activeFormalTabRoutes = ACTIVE_FORMAL_H5_ROUTES
  .filter((route) => route.tab)
  .map((route) => ({ path: route.path, titleBar: route.titleBar ?? 'back' }))
  .sort((a, b) => a.path.localeCompare(b.path))

function routeUrl(path: string) {
  return path === '/' ? '/?newcomer=off' : path
}

function collectRuntimeErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  return errors
}

async function waitForRouteReadiness(page: Page) {
  const routeFrame = page.locator('[data-h5-route-active="true"]')
  await expect(routeFrame).toBeVisible()
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  // H016/H020 route transitions can temporarily translate the active frame by 8px. Measuring
  // scrollWidth during that 130–150ms window creates a false horizontal-overflow failure.
  await expect
    .poll(
      () =>
        routeFrame.evaluate((node) =>
          node.getAnimations().every((animation) => animation.playState === 'finished'),
        ),
      { message: 'route transition did not settle before route health checks', timeout: 2_000 },
    )
    .toBe(true)
  await expect
    .poll(
      () =>
        page.locator('img:visible').evaluateAll((nodes) =>
          nodes.every((node) => (node as HTMLImageElement).complete),
        ),
      { message: 'visible images did not settle before route health checks', timeout: 5_000 },
    )
    .toBe(true)
}

async function expectHealthyFormalRoute(page: Page) {
  await waitForRouteReadiness(page)

  const overflow = await page.locator('[data-page-scroll]').evaluate((node) => {
    const element = node as HTMLElement
    return {
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }
  })
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)

  const brokenImages = await page.locator('img:visible').evaluateAll((nodes) =>
    nodes.flatMap((node) => {
      const image = node as HTMLImageElement
      if (!image.currentSrc && !image.src) return []
      return image.complete && image.naturalWidth === 0
        ? [image.currentSrc || image.src]
        : []
    }),
  )
  expect(brokenImages, `broken visible image(s): ${brokenImages.join(', ')}`).toEqual([])
}

test.describe('@formal-h5 active route smoke', () => {
  for (const route of staticFormalRoutes) {
    test(`${route.path} · ${route.title}`, async ({ page }) => {
      const runtimeErrors = collectRuntimeErrors(page)

      await page.goto(routeUrl(route.path), { waitUntil: 'domcontentloaded' })
      await expectHealthyFormalRoute(page)

      expect(runtimeErrors, runtimeErrors.join('\n')).toEqual([])
    })
  }
})

test('@formal-h5 chat long OSS URLs stay inside narrow WebView bubbles', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await page.goto('/service/chat', { waitUntil: 'domcontentloaded' })
  const longUrl = 'https://hexxueyantest.oss-cn-guangzhou.aliyuncs.com/storage/20261008/' + 'a'.repeat(90)
  await page.getByRole('textbox', { name: '输入你的问题' }).fill(longUrl)
  await page.getByRole('textbox', { name: '输入你的问题' }).press('Enter')
  await expect(page.locator('[data-chat-role="user"]')).toContainText(longUrl)
  await expectHealthyFormalRoute(page)
  const overflowBubbles = await page.locator('[data-chat-bubble]').evaluateAll((nodes) =>
    nodes.filter((node) => node.scrollWidth > node.clientWidth + 1).length,
  )
  expect(overflowBubbles).toBe(0)
})

test('@formal-h5 first-level tab uses CSS fade without root snapshot', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)

  await page.goto('/?newcomer=off', { waitUntil: 'domcontentloaded' })
  await expectHealthyFormalRoute(page)

  const rootTransitionName = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('view-transition-name').trim(),
  )
  expect(rootTransitionName).toBe('none')

  await page.getByRole('button', { name: '泡泡' }).click()
  await expect(page).toHaveURL(/\/points$/)
  const routeFrame = page.locator('[data-h5-route-active="true"]')
  await expect(routeFrame).toHaveAttribute('data-h5-route-transition', 'tab')
  await expectHealthyFormalRoute(page)

  expect(runtimeErrors, runtimeErrors.join('\n')).toEqual([])
})

test('@formal-h5 @business profile notification navigation remains inside formal H5', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)

  await page.goto('/profile', { waitUntil: 'domcontentloaded' })
  await expectHealthyFormalRoute(page)

  await page.getByRole('button', { name: '通知' }).click()
  await expect(page).toHaveURL(/\/notifications$/)
  await expectHealthyFormalRoute(page)

  await page.goBack()
  await expect(page).toHaveURL(/\/profile$/)
  await expectHealthyFormalRoute(page)

  expect(runtimeErrors, runtimeErrors.join('\n')).toEqual([])
})


test('@formal-h5 H021 removes simulated status bar but keeps App-standard title bar', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)

  for (const path of ['/?newcomer=off', '/notifications']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await expectHealthyFormalRoute(page)
    await expect(page.locator('[data-mobile-status-bar]')).toHaveCount(0)

    const titleBar = page.locator('[data-title-bar]')
    await expect(titleBar).toHaveCount(1)
    const height = await titleBar.evaluate((node) => node.getBoundingClientRect().height)
    expect(Math.round(height)).toBe(44)
  }

  expect(runtimeErrors, runtimeErrors.join('\n')).toEqual([])
})

test('@formal-h5 H021 title-bar actions remain available', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)

  await page.goto('/notifications', { waitUntil: 'domcontentloaded' })
  await expectHealthyFormalRoute(page)
  await expect(page.getByRole('button', { name: /一键已读|全部已读/ })).toBeVisible()

  await page.goto('/service/chat', { waitUntil: 'domcontentloaded' })
  await expectHealthyFormalRoute(page)
  // The real human action stays in the chat; the QR is a distinct titlebar action.
  const humanEntry = page.locator('[data-chat-human-entry]')
  await expect(humanEntry).toBeVisible()
  await expect(humanEntry).toBeEnabled()
  await humanEntry.click()
  await expect(page.locator('[data-human-stage]')).toHaveAttribute('data-human-stage', 'queuing')
  await expect(page.locator('[data-chat-human-sheet]')).toHaveCount(0)
  await page.getByRole('button', { name: '福利官二维码' }).click()
  await expect(page.locator('[data-chat-human-sheet]')).toBeVisible()
  await page.getByRole('button', { name: '取消' }).click()
  await expect(page.locator('[data-chat-human-sheet]')).toHaveCount(0)

  expect(runtimeErrors, runtimeErrors.join('\n')).toEqual([])
})


test('@formal-h5 H021 active formal H5 fills a wide WebView', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)

  await page.setViewportSize({ width: 900, height: 800 })
  await page.goto('/?newcomer=off', { waitUntil: 'domcontentloaded' })
  await expectHealthyFormalRoute(page)

  const widths = await page.evaluate(() => {
    const scroll = document.querySelector('[data-page-scroll]') as HTMLElement | null
    const container = document.querySelector('[data-page-container]') as HTMLElement | null
    const nav = document.querySelector('nav[aria-label="主导航"]') as HTMLElement | null
    const titleBar = document.querySelector('[data-title-bar] > div') as HTMLElement | null
    if (!scroll || !container || !nav || !titleBar) throw new Error('H021 wide-layout evidence nodes missing')
    return {
      scroll: scroll.getBoundingClientRect().width,
      container: container.getBoundingClientRect().width,
      nav: nav.getBoundingClientRect().width,
      titleBar: titleBar.getBoundingClientRect().width,
    }
  })

  expect(Math.abs(widths.container - widths.scroll)).toBeLessThanOrEqual(1)
  expect(Math.abs(widths.nav - widths.scroll)).toBeLessThanOrEqual(1)
  expect(Math.abs(widths.titleBar - widths.scroll)).toBeLessThanOrEqual(1)
  expect(widths.container).toBeGreaterThan(480)
  expect(widths.titleBar).toBeGreaterThan(480)

  expect(runtimeErrors, runtimeErrors.join('\n')).toEqual([])
})

test('@formal-h5 H082 older WebView keeps title and TabBar outside the scroller', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)

  await page.setViewportSize({ width: 375, height: 568 })
  await page.goto('/?newcomer=off', { waitUntil: 'domcontentloaded' })
  await expectHealthyFormalRoute(page)

  const scroll = page.locator('[data-page-scroll]')
  const shell = scroll.locator('..')
  // The first height class is the Chromium 88 fallback; the supports variant
  // lets newer WebViews use the dynamic viewport without losing that fallback.
  await expect(shell).toHaveClass(/\bh-screen\b/)
  await expect(shell).toHaveClass(/supports-\[height:100dvh\]:h-dvh/)

  const positions = () => page.evaluate(() => {
    const title = document.querySelector('[data-title-bar]')
    const nav = document.querySelector('nav[aria-label="主导航"]')
    if (!title || !nav) throw new Error('H082 app shell controls not found')
    return {
      titleTop: title.getBoundingClientRect().top,
      navTop: nav.getBoundingClientRect().top,
      documentScroll: window.scrollY,
    }
  })

  await expect.poll(() => scroll.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true)
  const before = await positions()
  await scroll.evaluate((node) => { node.scrollTop = node.scrollHeight })
  expect(await scroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(0)
  const after = await positions()

  expect(after.documentScroll).toBe(0)
  expect(Math.abs(after.titleTop - before.titleTop)).toBeLessThanOrEqual(1)
  expect(Math.abs(after.navTop - before.navTop)).toBeLessThanOrEqual(1)
  expect(runtimeErrors, runtimeErrors.join('\n')).toEqual([])
})

test('@formal-h5 H021 App title bar stays reachable while content scrolls', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)

  await page.goto('/dearseed?picker=off', { waitUntil: 'domcontentloaded' })
  await expectHealthyFormalRoute(page)
  await page.getByRole('button', { name: '品牌文化' }).click()
  await expect(page).toHaveURL(/\/brand-culture$/)
  await expectHealthyFormalRoute(page)

  const titleBar = page.locator('[data-title-bar="back"]')
  const back = titleBar.getByRole('button', { name: '返回' })
  await expect(titleBar).toBeVisible()
  await expect(back).toBeVisible()
  const before = await titleBar.boundingBox()
  await expect(page.locator('[data-rich-text-placeholder="/brand-culture"]')).toBeVisible()
  const richText = page.locator('[data-rich-text-content]')
  await expect(richText).toBeVisible()
  await expect(richText).toContainText('极地种子品牌故事')

  await expect(titleBar).toBeVisible()
  const after = await titleBar.boundingBox()
  expect(before).not.toBeNull()
  expect(after).not.toBeNull()
  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(1)

  await back.click()
  await expect(page).toHaveURL(/\/dearseed\?picker=off$/)
  await expectHealthyFormalRoute(page)

  expect(runtimeErrors, runtimeErrors.join('\n')).toEqual([])
})


test('@formal-h5 H021 first-level tabs use close while child pages use back', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)

  for (const route of activeFormalTabRoutes) {
    await page.goto(routeUrl(route.path), { waitUntil: 'domcontentloaded' })
    await expectHealthyFormalRoute(page)

    if (route.titleBar === 'hidden') {
      const close = page.locator('[data-host-close]')
      await expect(close).toHaveCount(1)
      await expect(close).toHaveAttribute('data-host-close-supported', 'false')
      continue
    }

    const titleBar = page.locator('[data-title-bar="close"]')
    await expect(titleBar).toHaveCount(1)
    const close = titleBar.locator('[data-host-close]')
    await expect(close).toHaveCount(1)
    await expect(close).toHaveAttribute('data-host-close-supported', 'false')
  }

  await page.goto('/settings', { waitUntil: 'domcontentloaded' })
  await expectHealthyFormalRoute(page)
  await expect(page.locator('[data-title-bar="back"]')).toHaveCount(1)
  await expect(page.locator('[data-title-bar="back"]').getByRole('button', { name: '返回' })).toBeVisible()

  expect(runtimeErrors, runtimeErrors.join('\n')).toEqual([])
})


test('@formal-h5 H022 legal multi-URL entries reuse one implementation', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)

  await page.goto('/membership', { waitUntil: 'domcontentloaded' })
  await expectHealthyFormalRoute(page)
  const canonical = await page.locator('[data-page-container]').innerText()

  await page.goto('/dearseed/membership', { waitUntil: 'domcontentloaded' })
  await expectHealthyFormalRoute(page)
  const alias = await page.locator('[data-page-container]').innerText()

  expect(alias).toBe(canonical)
  expect(runtimeErrors, runtimeErrors.join('\n')).toEqual([])
})

test('@formal-h5 H022 shared claim-success implementation keeps route variants deterministic', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)

  await page.goto('/claim/success?picker=off', { waitUntil: 'domcontentloaded' })
  await expectHealthyFormalRoute(page)
  await expect(page.getByRole('dialog', { name: '领取成功' })).toBeVisible()

  await page.goto('/onboarding/success?picker=off', { waitUntil: 'domcontentloaded' })
  await expectHealthyFormalRoute(page)
  await expect(page.getByRole('dialog', { name: '填写完成后领取成功' })).toBeVisible()

  expect(runtimeErrors, runtimeErrors.join('\n')).toEqual([])
})

test('@formal-h5 H022 prototype states stay on one route implementation', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)

  await page.goto('/card/share?coupon=91001', { waitUntil: 'domcontentloaded' })
  await expectHealthyFormalRoute(page)
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe('/card/share?coupon=91001')
  await expect(page.getByRole('button', { name: '确认选择' })).toBeDisabled()

  // Historic success URL must not imply a transfer without coupon ID or API.
  await page.goto('/card/share?state=success', { waitUntil: 'domcontentloaded' })
  await expectHealthyFormalRoute(page)
  await expect(page.getByText('未选择待转赠卡券，请从卡包点击「转赠」进入')).toBeVisible()
  await expect(page.getByText('分享成功', { exact: true })).toHaveCount(0)

  await page.goto('/service/chat/human?state=queuing', { waitUntil: 'domcontentloaded' })
  await expectHealthyFormalRoute(page)
  await expect(page.locator('[data-queue-state]')).toHaveAttribute('data-queue-state', 'queuing')

  await page.goto('/service/chat/human?state=connected', { waitUntil: 'domcontentloaded' })
  await expectHealthyFormalRoute(page)
  await expect(page.locator('[data-queue-state]')).toHaveAttribute('data-queue-state', 'connected')

  expect(runtimeErrors, runtimeErrors.join('\n')).toEqual([])
})

test('@formal-h5 H023 shared SearchField stays consistent across formal H5 consumers', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)

  await page.goto('/card/share?coupon=91001', { waitUntil: 'domcontentloaded' })
  await expectHealthyFormalRoute(page)
  const cardShareField = page.locator('[data-search-field="subtle"][data-search-field-size="regular"] input')
  await expect(cardShareField).toHaveCount(1)
  await cardShareField.fill('小美')
  await page.getByRole('button', { name: '清除搜索' }).click()
  await expect(cardShareField).toHaveValue('')

  await page.goto('/buddy/invite/phone', { waitUntil: 'domcontentloaded' })
  await expectHealthyFormalRoute(page)
  const phoneSearch = page.locator('[data-search-field="pill"]')
  const phoneField = phoneSearch.locator('input[type="tel"]')
  await expect(phoneField).toHaveCount(1)
  await expect(phoneField).toHaveAttribute('aria-label', '输入完整手机号搜索搭子')
  await expect(phoneSearch).toHaveCSS('padding-left', '16px')
  await expect(phoneSearch).toHaveCSS('padding-right', '16px')

  expect(runtimeErrors, runtimeErrors.join('\n')).toEqual([])
})

test('@formal-h5 H023 shared empty-state visual is stable across data pages', async ({ page }) => {
  const runtimeErrors = collectRuntimeErrors(page)

  for (const path of ['/address?state=empty', '/orders?state=empty', '/points/detail?state=empty']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await expectHealthyFormalRoute(page)
    const visual = page.locator('[data-empty-state-illustration]')
    await expect(visual).toHaveCount(1)
    const image = visual.locator('img')
    await expect(image).toHaveCount(1)
    const box = await image.boundingBox()
    expect(box).not.toBeNull()
    // Full-page brand empty states share the 168px standard illustration size.
    expect(Math.round(box?.width ?? 0)).toBe(168)
    expect(Math.round(box?.height ?? 0)).toBe(168)
  }

  expect(runtimeErrors, runtimeErrors.join('\n')).toEqual([])
})

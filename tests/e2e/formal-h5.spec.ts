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
  await expect(page.locator('[data-chat-wecom-entry]')).toBeVisible()

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

  await page.goto('/card/share', { waitUntil: 'domcontentloaded' })
  await expectHealthyFormalRoute(page)
  await expect(page).toHaveURL(/\/card\/share$/)

  await page.goto('/card/share?state=success', { waitUntil: 'domcontentloaded' })
  await expectHealthyFormalRoute(page)
  await expect(page).toHaveURL(/\/card\/share\?state=success$/)
  await expect(page.getByText('分享成功', { exact: true })).toBeVisible()

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

  await page.goto('/card/share', { waitUntil: 'domcontentloaded' })
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
    expect(Math.round(box?.width ?? 0)).toBe(112)
    expect(Math.round(box?.height ?? 0)).toBe(112)
  }

  expect(runtimeErrors, runtimeErrors.join('\n')).toEqual([])
})

test('@formal-h5 OSS index redirect enters the target without mounting Home', async ({ page }) => {
  await page.addInitScript(() => {
    const observed = window as Window & { __homeEverRendered?: boolean; __entryHistoryLength?: number }
    observed.__homeEverRendered = false
    observed.__entryHistoryLength = history.length
    const observer = new MutationObserver(() => {
      if (document.querySelector('[data-dearseed-avatar]')) observed.__homeEverRendered = true
    })
    observer.observe(document, { childList: true, subtree: true })
  })

  await page.goto('/index.html?redirect=%2Fservice%2Fchat%2Fhuman', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/service\/chat\/human$/)
  await expect(page.locator('[data-h5-route-active="true"]')).toBeVisible()
  await expect(page.locator('[data-dearseed-avatar]')).toHaveCount(0)
  expect(await page.evaluate(() => (window as Window & { __homeEverRendered?: boolean }).__homeEverRendered)).toBe(false)
  expect(await page.evaluate(() => history.length)).toBe(
    await page.evaluate(() => (window as Window & { __entryHistoryLength?: number }).__entryHistoryLength),
  )
})

test('@formal-h5 explicit OSS index without redirect remains on its entry document', async ({ page }) => {
  await page.goto('/index.html', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/index\.html$/)
  await expect(page.locator('[data-dearseed-avatar]')).toBeVisible()
  await expect(page.locator('[data-title-bar]')).toContainText('极地种子品牌专栏')
})

test('@formal-h5 invalid OSS redirect does not leave the app', async ({ page }) => {
  await page.goto('/index.html?redirect=https%3A%2F%2Fevil.example', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/index\.html\?redirect=/)
  await expect(page.locator('[data-dearseed-avatar]')).toBeVisible()
})

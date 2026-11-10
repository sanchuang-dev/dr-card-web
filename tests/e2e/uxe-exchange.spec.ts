import { expect, test } from '@playwright/test'

test('@formal-h5 UX-E exchange tabs and full-screen project selection remain within one URL', async ({ page }) => {
  await page.goto('/exchange', { waitUntil: 'domcontentloaded' })
  const urlBefore = new URL(page.url())
  expect(urlBefore.pathname).toBe('/exchange')
  expect(urlBefore.search).toBe('')
  // #124: tabs come from backend category data; no historical hardcoded 洗发体验 category.
  const tab = page.getByRole('tab', { name: 'Mock·通用体验包' })
  await expect(tab).toBeVisible()
  await tab.click()
  await expect(tab).toHaveAttribute('aria-selected', 'true')
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe('/exchange')

  const list = page.getByRole('region', { name: '洗护体验券列表' })
  const firstCoupon = list.locator('button').first()
  await expect(firstCoupon).toBeVisible()
  await firstCoupon.click()
  const selector = page.getByRole('dialog', { name: '选择适用片区' })
  await expect(selector).toBeVisible()
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe('/exchange')
  const chosen = selector.getByRole('radio', { name: /Mock·深圳南山科技园/ })
  await expect(chosen).toBeVisible()
  await chosen.click()
  await expect(selector.getByRole('region', { name: '已选片区' })).toContainText('深圳南山科技园')

  // Server search is unrelated to the chosen item: the selection must persist.
  await selector.getByRole('searchbox', { name: '搜索片区或项目名称' }).fill('天河')
  await expect(selector.getByRole('radio', { name: /Mock·广州天河体育西/ })).toBeVisible()
  await expect(selector.getByRole('region', { name: '已选片区' })).toContainText('深圳南山科技园')
  // The stable preview fixture has 128 points while the coupon costs 200:
  // preserve genuine insufficiency instead of mutating the fixture to force success.
  await expect(selector.getByText('泡泡值不足，暂时无法兑换')).toBeVisible()
  await expect(selector.getByRole('button', { name: '确认兑换' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(selector).toHaveCount(0)
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe('/exchange')
})

test('@formal-h5 UX-E legacy result query must not show fake success', async ({ page }) => {
  await page.goto('/exchange/result?product=1&overlay=redeem', { waitUntil: 'domcontentloaded' })
  await expect(page).toHaveURL(/\/exchange$/)
  await expect(page.getByRole('dialog', { name: '模拟兑换结果' })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: '全部' })).toBeVisible()
})

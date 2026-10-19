import { expect, test } from '@playwright/test'

test('@formal-h5 card ticket fits Chromium 88-compatible narrow flex sizing', async ({ page }) => {
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 700 })
    await page.goto('/card', { waitUntil: 'domcontentloaded' })
    const title = page.getByText('Mock 新人体验活动')
    await expect(title).toBeVisible()
    const ticket = title.locator('xpath=ancestor::article')
    // Change the heading and inspect its geometry in ONE locator evaluation.
    // Playwright locators are lazy; querying by the old text after replacing it would time out.
    const layout = await ticket.evaluate(node => {
      const article = node as HTMLElement
      const pane = article.querySelector('h3')?.parentElement?.parentElement as HTMLElement | null
      const titleElement = article.querySelector('h3') as HTMLElement | null
      const buttons = Array.from(article.querySelectorAll('button')) as HTMLButtonElement[]
      if (!pane || !titleElement || buttons.length !== 2) throw new Error('ticket layout nodes missing')
      titleElement.textContent = '天津生物工程职业技术学院洗护体验与公益合作活动'.repeat(2)
      const bounds = article.getBoundingClientRect()
      const right = pane.getBoundingClientRect()
      const titleBounds = titleElement.getBoundingClientRect()
      return {
        articleRight: bounds.right,
        contentRight: right.right,
        articleWidth: bounds.width,
        titleHeight: titleBounds.height,
        contentScrollWidth: pane.scrollWidth,
        contentClientWidth: pane.clientWidth,
        buttonRights: buttons.map(button => button.getBoundingClientRect().right),
      }
    })
    expect(layout.articleWidth).toBeLessThanOrEqual(width)
    expect(layout.contentRight).toBeLessThanOrEqual(layout.articleRight + 1)
    expect(layout.contentScrollWidth).toBeLessThanOrEqual(layout.contentClientWidth + 1)
    for (const right of layout.buttonRights) {
      expect(right).toBeLessThanOrEqual(layout.articleRight + 1)
    }
    expect(layout.titleHeight).toBeLessThanOrEqual(45)
  }
})

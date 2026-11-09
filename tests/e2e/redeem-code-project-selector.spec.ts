import { expect, test } from '@playwright/test'

test('@formal-h5 code redemption opens full-screen project selector without calling issue first', async ({ page }) => {
  await page.goto('/redeem', { waitUntil: 'domcontentloaded' })
  const input = page.getByRole('textbox', { name: '兑换码' })
  await expect(input).toBeVisible()
  await input.fill('Abc- 123456')
  await page.getByRole('button', { name: '选择适用片区' }).click()

  const dialog = page.getByRole('dialog', { name: '选择适用片区' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('region', { name: '待核兑兑换码' })).toContainText('Abc- 123456')
  await expect(dialog.getByText('泡泡值余额')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: '请选择适用片区' })).toBeDisabled()
  const project = dialog.getByRole('radio', { name: /Mock·深圳南山科技园/ })
  await expect(project).toBeVisible()
  await project.click()
  await expect(dialog.getByRole('region', { name: '已选片区' })).toContainText('深圳南山科技园')
  await dialog.getByRole('searchbox', { name: '搜索片区或项目名称' }).fill('天河')
  await expect(dialog.getByRole('radio', { name: /Mock·广州天河体育西/ })).toBeVisible()
  await expect(dialog.getByRole('region', { name: '已选片区' })).toContainText('深圳南山科技园')
  await expect(dialog.getByRole('button', { name: '确认兑换' })).toBeEnabled()

  // Close before requesting a side-effect. The original code and URL remain unchanged.
  await dialog.getByRole('button', { name: '返回兑换码' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(input).toHaveValue('Abc- 123456')
  expect(new URL(page.url()).pathname).toBe('/redeem')
})

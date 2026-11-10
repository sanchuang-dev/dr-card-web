// T009 卡包、核销、转赠与兑换码 375×812 验收截图（含交互链路记录）
// 用法: BASE_URL=http://localhost:5173 node scripts/capture-t009.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const outDir = join(root, 'docs/workbench/evidence/screenshots')
mkdirSync(outDir, { recursive: true })

const base = process.env.BASE_URL ?? 'http://127.0.0.1:5173'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 })

const problems = []
const known = []
/** React Router v6 的 v7 future flag 警告与本任务无关，且每次导航都会重复，单列计数不混进问题清单 */
const isKnownNoise = (text) => text.includes('React Router Future Flag Warning')
page.on('console', (msg) => {
  if (msg.type() !== 'error' && msg.type() !== 'warning') return
  const text = msg.text()
  if (isKnownNoise(text)) known.push(text)
  else problems.push(`[${msg.type()}] ${text}`)
})
page.on('pageerror', (error) => problems.push(`[pageerror] ${error.message}`))

const shot = async (name) => {
  await page.waitForTimeout(250)
  await page.screenshot({ path: join(outDir, `t009-${name}.png`), fullPage: false })
  console.log(`captured t009-${name}`)
}

const go = async (path) => {
  await page.goto(base + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(200)
}

const assert = (ok, message) => {
  if (!ok) problems.push(`[assert] ${message}`)
}

/**
 * 页面内容作用域。shell（TitleBar/BottomNav）自带 h1 与 aria-label="返回" 的控件，
 * 直接用全局 role 定位会撞 Playwright strict mode，因此页面内交互统一走 main。
 */
const main = () => page.getByRole('main')

// —— #54 / #62 / #63 / #64 卡包四态 ——
await go('/card')
await shot('54-wallet-default')
for (const [state, name] of [
  ['available', '62-wallet-available'],
  ['used', '63-wallet-used'],
  ['expired', '64-wallet-expired'],
]) {
  await go(`/card?state=${state}`)
  await shot(name)
}

// —— #62 使用方式选择弹层 ——
await go('/card?overlay=use')
await shot('62-overlay-use')

// —— 调试面板：仅 ?debug=1 出现；胶囊来自 routes.ts 登记的 states/overlays，切换只改 URL ——
await go('/card')
const panelWithoutFlag = await main().locator('[data-debug-panel]').count()
console.log(`  正常页面（无 debug=1）调试面板数量: ${panelWithoutFlag}`)
assert(panelWithoutFlag === 0, `未带 debug=1 时仍渲染调试面板: ${panelWithoutFlag}`)

await go('/card?debug=1')
const panelVisible = await main().locator('[data-debug-panel-body]').isVisible()
console.log(`  带 debug=1 后调试面板展开: ${panelVisible}`)
assert(panelVisible, '带 debug=1 后未渲染调试面板')
await shot('debug-panel-wallet')

const stateChips = await main().locator('[data-debug-state]').count()
const overlayChips = await main().locator('[data-debug-overlay]').count()
console.log(`  调试面板 /card：状态胶囊 ${stateChips} 个（含「默认」）、弹层胶囊 ${overlayChips} 个（含「关闭」）`)
assert(stateChips === 4, `卡包状态胶囊数量异常: ${stateChips}`)
assert(overlayChips === 2, `卡包弹层胶囊数量异常: ${overlayChips}`)

await main().locator('[data-debug-state="expired"]').click()
await page.waitForURL(/state=expired/)
const expiredUrl = page.url()
console.log(`  调试面板切到 expired 后 URL: ${expiredUrl.replace(base, '')}`)
assert(/debug=1/.test(expiredUrl), `切换状态后丢失 debug=1: ${expiredUrl}`)
const expiredTab = await main().getByRole('tab', { selected: true }).innerText()
console.log(`  调试面板切到 expired 后选中 Tab: ${expiredTab.replace(/\s+/g, ' ')}`)
assert(/已过期/.test(expiredTab), `面板切换状态未同步 Tab: ${expiredTab}`)
await shot('debug-panel-wallet-expired')

await main().locator('[data-debug-state="default"]').click()
await page.waitForURL((url) => !/state=/.test(url.search))
const defaultUrl = page.url()
console.log(`  调试面板回到默认后 URL: ${defaultUrl.replace(base, '')}`)
assert(/debug=1/.test(defaultUrl), `回到默认态后丢失 debug=1: ${defaultUrl}`)

await main().locator('[data-debug-overlay="use"]').click()
await page.waitForURL(/overlay=use/)
const sheetVisible = await page.getByRole('dialog', { name: '使用体验券' }).isVisible()
console.log(`  调试面板打开「使用方式选择」弹层: ${sheetVisible}`)
assert(sheetVisible, '面板切换弹层后未渲染使用方式选择弹层')
assert(/debug=1/.test(page.url()), `切换弹层后丢失 debug=1: ${page.url()}`)
await shot('debug-panel-wallet-overlay')

// —— #65 分享：默认选中第一位 → 搜索过滤 → 改选 → 下一步 → #66 成功 ——
await go('/card?state=available')
await main().getByRole('button', { name: '转赠' }).first().click()
await page.waitForURL(/\/card\/share/)
await shot('65-share-select')

const sectionHeader = await main().getByRole('heading', { name: '搭子列表' }).count()
console.log(`  #65 分组标题「搭子列表」: ${sectionHeader}`)
assert(sectionHeader === 1, `#65 分组标题未按原型渲染「搭子列表」: ${sectionHeader}`)

const firstSelected = await main().getByRole('option', { selected: true }).innerText()
console.log(`  #65 默认选中: ${firstSelected.replace(/\s+/g, ' ')}`)
assert(/小美/.test(firstSelected), `默认未选中首位接收人: ${firstSelected}`)

await main().getByRole('textbox', { name: '搜索好友' }).fill('室友')
await page.waitForTimeout(200)
const filtered = await main().getByRole('option').count()
console.log(`  #65 搜索「室友」命中 ${filtered} 位`)
assert(filtered === 1, `搜索过滤结果异常: ${filtered}`)
await shot('65-share-search')

await main().getByRole('option').first().click()
const picked = await main().getByRole('option', { selected: true }).innerText()
console.log(`  #65 改选为: ${picked.replace(/\s+/g, ' ')}`)
await shot('65-share-picked')

await main().getByRole('button', { name: '下一步' }).click()
await page.waitForURL(/state=success/)
await shot('66-share-success')
const shareOk = await main().getByRole('heading', { name: '分享成功' }).count()
assert(shareOk === 1, `未渲染分享成功标题，count=${shareOk}`)

// #66 原型保真：副文案与商品卡照抄 reference/分享成功.html（B-017 仅展示夹具）
const shareSub = await main().getByText('已成功分享给好友，邀请他也来一起玩吧').count()
assert(shareSub === 1, `#66 副文案未按原型渲染，count=${shareSub}`)
const productCard = main().locator('section[aria-label="分享的商品"]')
const productText = (await productCard.innerText()).replace(/\s+/g, ' ')
console.log(`  #66 商品卡: ${productText}`)
for (const field of ['洗发试用装', '2024.01.08', '已发货', '单次使用']) {
  assert(productText.includes(field), `#66 商品卡缺字段「${field}」: ${productText}`)
}

// 取消路径：成功页「返回」回到选择页
await main().getByRole('button', { name: '返回' }).click()
await page.waitForTimeout(300)
console.log(`  #66 返回后 URL: ${new URL(page.url()).pathname}${new URL(page.url()).search}`)

// —— #67 核销链路：扫码 / 密码 / 确认 / 成功 / 重复 ——
await go('/card/verify')
await shot('67-verify-scan')
await go('/card/verify/password')
await shot('67-verify-password')
await go('/card/verify/confirm')
await shot('67-verify-confirm')

await main().getByRole('button', { name: '确认核销' }).click()
await page.waitForTimeout(300)
await shot('67-verify-toast')
await page.waitForURL(/\/card\?state=used/, { timeout: 3000 })
console.log(`  #67 确认核销后跳转: ${new URL(page.url()).pathname}${new URL(page.url()).search}`)

await go('/card/verify/confirm?state=done')
await shot('67-verify-done')
await go('/card/verify/confirm?state=repeat')
await shot('67-verify-repeat')

// —— #68 兑换码：默认 / 输入 / 提交中 / 四类失败 ——
await go('/redeem')
await shot('68-redeem-default')
const submitDisabled = await main().getByRole('button', { name: '确认兑换' }).isDisabled()
console.log(`  #68 空输入时提交按钮 disabled=${submitDisabled}`)
assert(submitDisabled, '空输入时提交按钮未禁用')

await main().getByRole('textbox', { name: '兑换码' }).fill('drcard000888')
await page.waitForTimeout(150)
const typed = await main().getByRole('textbox', { name: '兑换码' }).inputValue()
console.log(`  #68 原样保留大小写: ${typed}`)
assert(typed === 'drcard000888', `输入不应自动转大写: ${typed}`)
await shot('68-redeem-typing')

await main().getByRole('button', { name: '确认兑换' }).click()
await page.waitForTimeout(200)
await shot('68-redeem-submitting')

// —— #69 成功入包 ——
await page.waitForTimeout(900)
await shot('69-redeem-success')
const okTitle = await main().getByRole('heading', { name: '兑换成功' }).count()
assert(okTitle === 1, `未渲染兑换成功标题，count=${okTitle}`)

// 失败四态（?state= 直达）
for (const [state, name] of [
  ['format', '68-redeem-error-format'],
  ['invalid', '68-redeem-error-invalid'],
  ['used', '68-redeem-error-used'],
  ['network', '68-redeem-error-network'],
]) {
  await go(`/redeem?state=${state}`)
  await shot(name)
  const feedback = await page.getByRole('status').innerText()
  console.log(`  #68 ${state} 反馈: ${feedback.replace(/\s+/g, ' ')}`)
}

// —— 调试面板：兑换码失败态同样只在 ?debug=1 下出现，切换保留 debug=1 ——
await go('/redeem')
const redeemPanelWithoutFlag = await main().locator('[data-debug-panel]').count()
assert(redeemPanelWithoutFlag === 0, `兑换码页未带 debug=1 时仍渲染调试面板: ${redeemPanelWithoutFlag}`)

await go('/redeem?debug=1')
assert(await main().locator('[data-debug-panel-body]').isVisible(), '兑换码页带 debug=1 后未渲染调试面板')
await shot('debug-panel-redeem')
await main().locator('[data-debug-state="invalid"]').click()
await page.waitForURL(/state=invalid/)
assert(/debug=1/.test(page.url()), `兑换码页切换状态后丢失 debug=1: ${page.url()}`)
const redeemFeedback = await page.getByRole('status').innerText()
console.log(`  调试面板切到 invalid 后反馈: ${redeemFeedback.replace(/\s+/g, ' ')}`)
assert(/无效|不存在/.test(redeemFeedback), `面板切换兑换失败态异常: ${redeemFeedback}`)
await shot('debug-panel-redeem-invalid')

await browser.close()

console.log(
  problems.length
    ? `\n控制台/断言问题 ${problems.length} 条:\n${problems.join('\n')}`
    : '\n控制台无 error，断言全部通过',
)
if (known.length) console.log(`已知既有 Router warning（React Router v7 future flag）${known.length} 条，与 T009 无关`)

// T013 卡二（#58 智能客服 / #71 企微二维码引导弹层 / #70 人工客服排队）375×812 验收截图与交互断言
// 用法: BASE_URL=http://127.0.0.1:5173 node scripts/capture-t013.mjs
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
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`[${msg.type()}] ${msg.text()}`)
})
page.on('pageerror', (error) => problems.push(`[pageerror] ${error.message}`))

const shot = async (name) => {
  await page.waitForTimeout(250)
  await page.screenshot({ path: join(outDir, `t013-${name}.png`), fullPage: false })
  console.log(`captured t013-${name}`)
}

const go = async (path) => {
  await page.goto(base + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(200)
}

const assertText = async (text, label) => {
  const body = await page.evaluate(() => document.body.innerText)
  if (!body.includes(text)) problems.push(`[assert] ${label} 缺少文案: ${text}`)
}

// —— 节点 #58 欢迎态：只有小诗欢迎语，不出现未确认的热门问题 ——
await go('/service/chat')
await assertText('你好，我是诗得丽 AI 客服小诗', '#58 欢迎态')
if (await page.locator('[data-chat-wecom-entry]').count()) problems.push('[assert] 已隐藏的右上企微入口仍存在')
const welcomeCount = await page.locator('[data-chat-message]').count()
console.log(`  #58 欢迎态消息数: ${welcomeCount}`)
if (welcomeCount !== 1) problems.push(`[assert] 欢迎态应只有 1 条消息，实际 ${welcomeCount}`)
await shot('58-welcome')

// —— #58 对话：输入 → 发送中 → 成功 → 小诗兜底回答 ——
await page.getByLabel('输入你的问题').fill('会员等级怎么升级？')
await page.locator('[data-chat-send]').click()
const sending = await page.locator('[data-chat-status="sending"]').count()
console.log(`  发送中气泡: ${sending}`)
if (sending !== 1) problems.push(`[assert] 点击发送后应出现 1 条发送中消息，实际 ${sending}`)
await shot('58-sending')
await page.waitForTimeout(900)
await assertText('已收到你的问题，我先为你查询', '#58 兜底回答')
const afterSend = await page.locator('[data-chat-message]').count()
console.log(`  一轮往返后消息数: ${afterSend}（预期 3）`)
if (afterSend !== 3) problems.push(`[assert] 一轮往返后应为 3 条消息，实际 ${afterSend}`)
await shot('58-conversation-live')

// —— #58 夹具态：有对话 ——
await go('/service/chat?state=conversation')
await assertText('我的洗发水体验券怎么用？', '#58 有对话夹具')
await shot('58-state-conversation')

// —— #58 发送失败 → 重试 → 成功 ——
await go('/service/chat?state=failed')
await assertText('发送失败，请检查网络后重试', '#58 失败态')
await shot('58-state-failed')
await page.locator('[data-chat-retry]').click()
await page.waitForTimeout(900)
const stillFailed = await page.locator('[data-chat-status="failed"]').count()
console.log(`  重试后失败气泡数: ${stillFailed}（预期 0）`)
if (stillFailed !== 0) problems.push(`[assert] 重试后仍存在失败消息 ${stillFailed} 条`)
await shot('58-retry-success')

// —— 关键词确定性：输入含「断网」必失败 ——
await page.getByLabel('输入你的问题').fill('我这边断网了')
await page.locator('[data-chat-send]').click()
await page.waitForTimeout(900)
const keywordFailed = await page.locator('[data-chat-status="failed"]').count()
console.log(`  含失败关键词的发送失败气泡: ${keywordFailed}（预期 1）`)
if (keywordFailed !== 1) problems.push(`[assert] 含「断网」的输入应稳定失败，实际失败 ${keywordFailed} 条`)
await shot('58-keyword-failed')

// —— 节点 #71 弹层：仅通过底部「人工」入口打开，右上企微入口隐藏 ——
await go('/service/chat')
await page.locator('[data-chat-human-entry]').click()
await page.waitForTimeout(250)
await assertText('请添加我们的企业微信福利官获取人工客服服务', '#71 弹层标题')
await assertText('取消', '#71 取消')
await shot('71-sheet-from-wecom')

// —— #71 取消 → 回到对话（原型 §10 唯一明示交互）——
await page.getByRole('button', { name: '取消' }).click()
await page.waitForTimeout(250)
const sheetGone = await page.locator('[data-chat-human-sheet]').count()
console.log(`  取消后弹层残留: ${sheetGone}（预期 0）`)
if (sheetGone !== 0) problems.push('[assert] 点击取消后弹层未关闭')
console.log(`  取消后 URL: ${new URL(page.url()).search || '(无 query)'}`)
await shot('71-after-cancel')

// —— #71 底部「人工」入口再次打开同一原企微弹层（取消后可重试）——
await page.locator('[data-chat-human-entry]').click()
await page.waitForTimeout(250)
await assertText('请添加我们的企业微信福利官获取人工客服服务', '#71 页内入口')
await shot('71-sheet-from-human-entry')

// —— #71 弹层内不得出现原型没有的业务动作（未确认规则不得实现）——
const forwardEntry = await page.getByRole('button', { name: '已添加，进入人工客服' }).count()
console.log(`  #71 未确认的前进按钮数量: ${forwardEntry}（预期 0）`)
if (forwardEntry !== 0) problems.push('[assert] #71 出现了原型没有的「已添加，进入人工客服」按钮')
const sheetButtons = await page.locator('[role="dialog"] button').allInnerTexts()
console.log(`  #71 弹层按钮: ${JSON.stringify(sheetButtons.map((t) => t.trim()).filter(Boolean))}`)
await page.getByRole('button', { name: '取消' }).click()
await page.waitForTimeout(250)

// —— #70 暂由直达路由验收（#71 → #70 的前进入口未确认，不伪造业务入口）——
await page.goto(`${base}/service/chat/human?state=queuing`)
await page.waitForTimeout(300)
await assertText('正在为您接入人工客服...', '#70 排队中')
await assertText('前面还有 2 位', '#70 前置人数')
console.log(`  #70 排队态直达 URL: ${page.url().replace(base, '')}`)
await shot('70-queuing')

// —— #70 排队中不做队列动态：等待 4 秒人数文案不变 ——
const aheadBefore = await page.locator('[data-queue-state]').innerText()
await page.waitForTimeout(4000)
const aheadAfter = await page.locator('[data-queue-state]').innerText()
if (aheadBefore !== aheadAfter) problems.push('[assert] 排队中出现了未经确认的队列动态变化')
console.log(`  排队 4 秒后文案是否不变: ${aheadBefore === aheadAfter ? '是' : '否'}`)

// —— #70 排队中输入区禁用 ——
const inputDisabled = await page.getByLabel('输入你的问题').isDisabled()
console.log(`  排队中输入区禁用: ${inputDisabled}`)
if (!inputDisabled) problems.push('[assert] 排队中输入区应为禁用态')

// —— #70 已接入：历史消息保留 + 人工开场语 ——
await go('/service/chat/human?state=connected')
await assertText('诗得丽-吴哥 为您服务', '#70 已接入')
await assertText('我是人工客服吴哥', '#70 人工开场语')
await assertText('我的洗发水体验券怎么用？', '#70 保留智能客服历史')
// 历史小诗消息头像应保持「诗」，只有坐席开场语用「哥」，避免把历史说话人改写成人工客服
const agentGlyph = await page
  .locator('[data-chat-message]', { hasText: '我是人工客服吴哥' })
  .innerText()
const botGlyphKept = await page
  .locator('[data-chat-message]', { hasText: '你好，我是诗得丽 AI 客服小诗' })
  .innerText()
console.log('#70 坐席开场语头像含「哥」:', agentGlyph.includes('哥'))
console.log('#70 历史小诗消息头像仍为「诗」:', botGlyphKept.trimStart().startsWith('诗'))
await shot('70-connected')

await page.getByLabel('输入你的问题').fill('麻烦帮我查一下核销记录')
await page.locator('[data-chat-send]').click()
await page.waitForTimeout(900)
await assertText('麻烦帮我查一下核销记录', '#70 已接入可发送')
await shot('70-connected-send')

// —— 调试面板门禁：无 debug=1 不出现，有 debug=1 出现 ——
await go('/service/chat')
const panelOff = await page.locator('[data-debug-panel]').count()
await go('/service/chat?debug=1')
const panelOn = await page.locator('[data-debug-panel]').count()
console.log(`  调试面板 无 debug=${panelOff} / debug=1 时=${panelOn}`)
if (panelOff !== 0) problems.push('[assert] 未带 debug=1 时调试面板出现了')
if (panelOn !== 1) problems.push('[assert] 带 debug=1 时调试面板未出现')
await shot('58-debug-panel')
await go('/service/chat/human?debug=1&state=queuing')
await shot('70-debug-panel')

// —— 小屏 + 键盘遮挡场景：输入区与发送按钮仍在可视区内 ——
await page.setViewportSize({ width: 320, height: 480 })
await go('/service/chat?state=conversation')
const sendBox = await page.locator('[data-chat-send]').boundingBox()
const viewport = page.viewportSize()
const visible = sendBox && sendBox.y + sendBox.height <= viewport.height + 1
console.log(`  320×480 发送按钮底边 ${sendBox ? Math.round(sendBox.y + sendBox.height) : 'n/a'} / 视口 ${viewport.height}`)
if (!visible) problems.push('[assert] 小屏下发送按钮被挤出视口')
await page.screenshot({ path: join(outDir, 't013-58-small-screen.png') })
console.log('captured t013-58-small-screen')

await browser.close()

console.log(problems.length ? `\n控制台/断言问题 ${problems.length} 条:\n${problems.join('\n')}` : '\n控制台无 error/warning，断言全部通过')

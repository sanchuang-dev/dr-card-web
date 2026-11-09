import { chromium } from '@playwright/test'

const base = process.env.BASE_URL ?? 'http://localhost:5210'
const outDir = 'docs/workbench/evidence/screenshots'

const cases = [
  ['ref-card', '/card', ['卡包', '核心洗发水体验券', '可用', '转赠']],
  ['ref-scan', '/card/verify', ['请将二维码对准扫描框', '扫码后自动核销']],
  ['ref-confirm', '/card/verify/confirm', ['即将核销此券', '泡泡洗护 · 朝阳大悦城店', '确认核销']],
  ['ref-password', '/card/verify/password', ['请输入消费密码', '确认核销']],
  ['ref-levels', '/membership/levels', ['会员等级参考', 'LV.4', '会员卡面']],
  ['ref-redeem', '/redeem', ['兑换卡券', '兑换码不少于 10 位', '确认兑换']],
  ['ref-points', '/points', ['泡泡值余额', '1,280', '泡泡任务', '泡泡值兑换']],
  ['ref-points-detail', '/points/detail', ['泡泡值明细', '全部', '收入', '消耗']],
  ['ref-settings', '/settings', ['资料设置', '消费密码', '确认修改']],
  ['ref-onboarding', '/onboarding', ['完善信息', '消费密码', '确认信息']],
  ['ref-officer', '/service/welfare-officer', ['品牌福利官', '吴哥', '人工客服', '活动咨询', '福利抽奖']],
  ['ref-chat', '/service/chat', ['智能客服', 'AI 客服 · 小诗', '你好，我是诗得丽 AI 客服小诗', '人工']],
  ['ref-chat-conversation', '/service/chat?state=conversation', ['我的洗发水体验券怎么用？', '到店出示二维码由门店扫码核销']],
  ['ref-chat-failed', '/service/chat?state=failed', ['门店周末营业到几点？', '发送失败，请检查网络后重试', '重试']],
  ['ref-chat-sheet', '/service/chat?overlay=request-human', ['请添加我们的企业微信福利官获取人工客服服务', '长按或扫描识别二维码', '取消']],
  ['ref-human-queuing', '/service/chat/human?state=queuing', ['人工客服排队', '正在为您接入人工客服...', '前面还有 2 位']],
  ['ref-human-connected', '/service/chat/human?state=connected', ['诗得丽-吴哥 为您服务', '我是人工客服吴哥', '我的洗发水体验券怎么用？']],
  ['ref-notice', '/notifications', ['通知', '一键已读', '订单核销成功']],
  ['ref-notice-detail', '/notifications/n1', ['订单核销成功', '本条为系统通知', '280 泡泡值']],
  // 首页带 ?newcomer=off 抑制 T021 的默认新人体验券弹窗，保证参考截图取到无遮挡形态
  ['ref-home', '/?newcomer=off', ['首页', '诗得丽品牌专栏', '公益板块']],
  ['ref-checkin', '/checkin', ['今日已签到', '本周期签到日历', '连续签到奖励']],
  /* T023 起 `/membership` 重定向到 /mall（需求 §6），原会员中心用例下线，证据见 ref-membership.png */
  ['ref-profile', '/profile', ['我的', 'VIP 泡泡新生', '热门兑换']],
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 375, height: 812 } })
const errors = []
let failed = 0
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

for (const [name, path, expectTexts] of cases) {
  await page.goto(base + path, { waitUntil: 'networkidle' })
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${outDir}/${name}.png` })
  const bodyText = await page.evaluate(() => document.body.innerText)
  const missing = expectTexts.filter((t) => !bodyText.includes(t))
  const imgBroken = await page.evaluate(
    () => Array.from(document.querySelectorAll('img')).filter((i) => i.naturalWidth === 0).length,
  )
  console.log(
    `${path.padEnd(28)} ${missing.length ? 'MISSING:' + missing.join(',') : 'OK'} ${imgBroken ? `brokenImg:${imgBroken}` : ''}`,
  )
  if (missing.length || imgBroken) failed++
}

console.log('console errors:', errors.length ? errors : 'NONE')
await browser.close()
process.exit(failed === 0 && errors.length === 0 ? 0 : 1)

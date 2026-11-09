# T001｜72 节点逐节点事实与验收矩阵

> 本文件是 T001「事实基线与验收矩阵」的唯一台账。
> 依据：`docs/prototype/`（01–07）、Mockplus 离线包、当前仓库代码、`AGENTS.md`、15 张任务卡。
> 评估日期：2026-08-21；owner 验收基线更新于 2026-08-24。owner 已明确确认 T001 通过，并指定当前仓库实现、路由注册表与页面状态为当前正确事实源；下文旧快照只作过程留痕，不得反向否定当前实现。
> 2026-08-27 UI 变更批次（T021–T023）的独立验收台账见 [`t024-acceptance-report.md`](./t024-acceptance-report.md) 与 [`evidence/t024-results.json`](./evidence/t024-results.json)，本文件不重复记录该批次的逐条结果。

## 1. 实现等级定义

| 等级 | 含义 |
| --- | --- |
| `Missing` | 无路由、无页面、无状态夹具，用户不可达。 |
| `Placeholder` | 有路由或占位页，但只有静态壳，未实现原型业务与状态。 |
| `Partial` | 有实现但与原型结构/状态不完整对齐，或含未确认规则。 |
| `Implemented` | 覆盖原型结构、状态与交互，可用确定性夹具复现。 |
| `Verified` | `Implemented` 且具备截图、交互与工程证据。 |

T014 范围关闭节点使用范围结论：`Exclude / Preserve Evidence / Future / Superseded / Needs Decision`（对应 T001 卡的 `Excluded / Scope-Closed` 契约，均反向链接到 T014 决策记录）。

## 2. 当前种籽页与主导航审计（owner 基线：2026-08-24）

> 本节只记录当前可运行的五个种籽页和由注册表实际驱动的五项 Tab；它们不是“全项目仅有五条路由”的意思。全量实施节点的路由定位见 [route-table.md](./route-table.md)。

| Tab | 路由 | 页面文件 | 当前语义 / 承载节点 | 实现等级 | 375×812 新截图 |
| --- | --- | --- | --- | --- | --- |
| 首页 | `/` | [Home.tsx](../../src/pages/Home.tsx) | 诗得丽品牌专栏首页（T021 改造）：搜索栏 + 头像 + Banner + 迁入的打卡内容 + 公益板块 + 品牌故事；分别进入 `/cause` 与 `/brand-culture` 空富文本承载页 | `Implemented`：公益与品牌故事均可达二级路由；详情页暂不请求数据，仅保留未来富文本内容宿主。首页新人体验券弹窗当前关闭，正式识别等待 APP 用户信息与统一业务服务 | [t021-01-home-first-screen.png](./evidence/screenshots/t021-01-home-first-screen.png)、[t021-02-home-bottom.png](./evidence/screenshots/t021-02-home-bottom.png) |
| 泡泡 | `/points` | [Points.tsx](../../src/pages/Points.tsx) | 泡泡值任务页（T022 改造）：泡泡值余额 + 任务占位区 + 三项福利入口（每日签到 / 澡运 / 体验券兑换）+ 吸底兑换按钮，承接 #5；流水明细已拆到二级页 [`/points/detail`](../../src/pages/PointsDetail.tsx)（收入/消耗筛选与空态四态） | `Implemented`：Tab 语义为任务页，`/points/detail` 为二级页（无底部导航、有返回栏）；打卡页 `/checkin` 保留为二级页面 | 截图由 `scripts/capture-t001.mjs` 生成 `t001-seed-points.png`；本轮见 [t024-06-points-detail-expense.png](./evidence/screenshots/t024-06-points-detail-expense.png)、[t024-07-points-detail-empty.png](./evidence/screenshots/t024-07-points-detail-empty.png)、[t024-08-points-benefits-tasks.png](./evidence/screenshots/t024-08-points-benefits-tasks.png) |
| 扫码 | `/card/verify` | [ScanVerify.tsx](../../src/pages/ScanVerify.tsx) | 扫码核销 #67；可继续进入确认核销 | `Implemented`：reference 标准扫码页，核销确认链路由 T009 继续验收 | [t001-seed-scan.png](./evidence/screenshots/t001-seed-scan.png) |
| 服务 | `/membership` | [Membership.tsx](../../src/pages/Membership.tsx) | 会员中心 #6 | `Implemented`：会员 hero、功能入口、连续打卡福利与权益区已落地 | [t001-seed-membership.png](./evidence/screenshots/t001-seed-membership.png) |
| 我的 | `/profile` | [Profile.tsx](../../src/pages/Profile.tsx) | 我的 #19/#20 | `Implemented`：会员资料、资产、常用功能与热门兑换已落地；H034 已将 APP 引导“下载链接”接到 Native store target contract，当前 Native 未实现时明确失败 | [t001-seed-profile.png](./evidence/screenshots/t001-seed-profile.png) |

路由定义见 [router/index.tsx](../../src/app/router/index.tsx) 与 [routes.ts](../../src/app/router/routes.ts)。五项 Tab 的单一事实源是 `TAB_ROUTES`：`/`、`/points`、`/card/verify`、`/membership`、`/profile`。

### 路由审计要点

- 路由注册表已由 T004 扩展为全量 60 实施节点（见 [route-table.md](./route-table.md) 与 [routes.ts](../../src/app/router/routes.ts)）；五个种籽页是当前主导航入口，不是全量路由数量。
- 旧快照中的 4 Tab（首页/卡包/兑换/我的）已失效：`/card` 与 `/exchange` 保留为二级可达页面；主导航现为 首页/泡泡/扫码/服务/我的。
- `/` 根首页已由 T021 按需求 §2.1 改为「诗得丽品牌专栏」首页并删除金刚区，打卡内容经共享组件 `CheckinBoard` 完整迁入（D-072/D-073）；`/dearseed` 仍为独立专栏页，#12/#13 新人弹窗/引导弹窗与 #23 领取态继续由 `/dearseed` 的 `?overlay=` / `?state=claimed` 承载，D-054 中「`/` 仅承载 APP 首页」的口径已被 D-072 覆盖。
- `/exchange` 语义已由 T004 纠正为「洗护兑换专区」（#18/#37/#38），不再是兑换码页；兑换码入口迁移至 `/redeem`（#68）。
- `/draw-success` 旧路由已由 T004 移除并重定向至 `/luck/result`（#41）；T006 已于 2026-08-22 把三档签运降级为显式 `?state=great|good|minor` 并各带「未定稿」标识，`nextLuck()` 为确定性推进、无随机与持久化，规则本体仍待确认（B-003）。
- 运行证据：`BASE_URL=http://127.0.0.1:5174 node scripts/verify-t001.mjs` 于本次刷新全部 PASS（5 个标签顺序、5 个直达路由及对应激活态）；截图由 `scripts/capture-t001.mjs` 同一 375×812 视口生成。
- T007 已于 2026-08-24 落地 6 条路由承接 9 个节点：`/buddy`（#27 空态 `?state=empty` / #28 有态 `?state=list|multi`）、`/buddy/invite`（#29）、`/buddy/invite/scan`（#30；H034 起 installed 只来自 Native detect，保留 WebView 边界页 + 唤起弹窗视觉，不伪造应用商店视觉）、`/buddy/invite/phone`（#32 搜索四态与 #33 `?state=success`）、`/buddy/invite/qrcode`（#34 海报保存与 #35 链接复制，成功/失败各两态）、`/buddy/accept`（#36 含 `?state=bound|dismissed`）。失败态只由 `?state=` 驱动、页内真实操作恒成功（D-056）；分享能力统一走 [buddyShare.ts](../../src/app/adapters/buddyShare.ts) 适配层。#31 默契值不提供任何入口（D-059），`--color-buddy-mutual` 仅预留命名、禁止搭子页引用。见 [decisions/T007-partner-invite.md](decisions/T007-partner-invite.md)。
- T013 已于 2026-08-22 落地 4 个节点：`/service/welfare-officer`（#57 服务列表纠正为摹客 3 类）、`/service/chat`（#58 欢迎/对话/发送失败重试/企微入口，#71 二维码引导弹层由 `?overlay=request-human` 承载）、`/service/chat/human`（#70 仅 `?state=queuing|connected` 两态，无人数递减/倒计时）。见 [decisions/T013-customer-service.md](decisions/T013-customer-service.md)。
- T005–T013 其余未施工节点由 [NodeStub.tsx](../../src/pages/NodeStub.tsx) 明确占位（`Missing` 级，不伪装完成）。

## 3. 覆盖总览

```text
实施节点（T005–T013）：9 + 9 + 9 + 8 + 9 + 4 + 4 + 4 + 4 = 60
范围关闭节点（T014）：12
合计：60 + 12 = 72
```

| 任务卡 | 节点数 | 节点号 |
| --- | --- | --- |
| T005 | 9 | #2 #12 #13 #14 #15 #16 #23 #24 #25 |
| T006 | 9 | #4 #5 #6 #7 #8 #21 #22 #26 #41 |
| T007 | 9 | #27 #28 #29 #30 #32 #33 #34 #35 #36 |
| T008 | 8 | #17 #18 #37 #38 #39 #40 #48 #49 |
| T009 | 9 | #54 #62 #63 #64 #65 #66 #67 #68 #69 |
| T010 | 4 | #55 #56 #60 #72 |
| T011 | 4 | #19 #20 #59 #61 |
| T012 | 4 | #11 #42 #43 #44 |
| T013 | 4 | #57 #58 #70 #71 |
| T014 | 12 | #1 #3 #9 #10 #31 #45 #46 #47 #50 #51 #52 #53 |

### 实现等级分布（60 实施节点）· 快照 2026-08-24（T005 #2/#16 收尾施工后）

> 本快照由逐节点矩阵 §4.1 直接统计得出。2026-08-24 owner 已确认 T005 整卡通过，#2、#16 由 `Implemented` 升为 `Verified`；T001 同日通过，旧快照仅作过程留痕。

| 等级 | 数量 | 节点 |
| --- | ---: | --- |
| `Verified` | 13 | #19 #20 #59 #61（T011，2026-08-22 owner 通过）、#2 #12 #13 #14 #15 #16 #23 #24 #25（T005，2026-08-24 整卡 9/9 owner 通过；27 张截图、交互断言与 typecheck/build 证据齐备） |
| `Implemented` | 26 | #4 #5 #6 #7 #8 #21 #22 #26 #41（T006）、#57 #58 #70 #71（T013）、#11 #42 #43 #44 #54 #62 #63 #64 #65 #66 #67 #68 #69（reference 标准页/WebView 边界/确定性 fixture） |
| `Partial` | 0 | 原 `Partial` 节点 #2 已于 2026-08-24 补齐剩余两项并经 owner 验收，升为 `Verified` |
| `Placeholder` | 0 | 原占位页（#19/#54/#68）已由 reference 标准页取代 |
| `Missing` | 21 | 其余未施工实施节点（NodeStub 明确占位，不伪装完成）；#16 已于 2026-08-24 移出本行 |

## 4. 逐节点矩阵

> 列含义：模块＝原型文档归属（01–06）；卡＝所属任务卡；可达＝路由或 fixture 定位方式；等级＝实现等级；决策＝决策风险与阻塞；验收＝验收状态。

### 4.1 实施节点（60）

#### T005 专栏首页与新人流程

| # | 节点名 | 模块 | 卡 | 可达 | 等级 | 决策/风险 | 验收 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 2 | 诗得丽专栏 | 01 | T005 | `/dearseed` | Verified | 已按 D-054 从 APP 首页拆为独立业务页；保留原型确认的 Banner、会员/泡泡值摘要、品牌文化/会员空间/洗护兑换、本期活动、为你精选与通知入口。未确认入口不补做 | owner 通过（2026-08-24）；[375×812 截图](../design/evidence/dearseed-column-375x812.png) |
| 12 | 新人弹窗 | 01 | T005 | `/dearseed?overlay=newcomer`（专栏承载） | Verified | 按原型 §2 落地「专栏背景＋遮罩＋居中弹窗」，复用 `PromptOverlay`；「去完善信息」→ `/onboarding`，弹窗链式切到 `?overlay=app-guide`。**2026-08-24 按摹客真值修正**：标题回正为「恭喜你！」（原误用正文话术「见面礼已送达」作标题）、正文回摹客原话术、卡片改左图右文横排、CTA 移出卡片外下方居中、启用摹客独立插画 `dialog-prompt-bottle`、移除凭空添加的 `bodyHint` 与摹客侧 `disabled:true` 却被误启用的 `border-[#797979]` 描边 | owner 通过；承载路由按 D-054 更新；视觉参数（圆角 8px／阴影／白遮罩）经摹客核验即为原型真值，本轮按 owner 指示不动 |
| 13 | 引导弹窗 | 01 | T005 | `/dearseed?overlay=app-guide`（专栏承载） | Verified | 复用 `AppPromptDialog`；H034 已将「下载链接」接到 Native store target contract；H5 不再自造或等待硬编码商店 URL。**2026-08-24 按摹客真值修正**：原实现误套 #20 强制版双按钮形态，现拆为 `variant='guide'`（单按钮「下载链接」＋ 右上角关闭图标，对应摹客「引导弹窗」artboard），与 #20 的 `variant='force'`（双按钮「我知道了／下载链接」）分离；正文回摹客原话术「积分彩蛋存放处已开启！双倍泡泡积分存放在APP里，超多养护福利等你挖掘」 | owner 通过；承载路由按 D-054 更新 |
| 14 | 完善信息 | 01 | T005 | `/onboarding` | Verified | 按 T01-A 分步 onboarding 落地：昵称/生日/身份/性别/消费密码；校验＋提交中＋成功闭环。**owner 已确认：不复用 T011 的 #61 放弃修改弹窗，返回直接回诗得丽专栏；年级/生日/性别保持非必填。**密码强度、重复提交规则仍未确认 | owner 通过（2026-08-22） |
| 15 | 领取成功 | 01 | T005 | `/claim/success`（专栏「前往领取」进入） | Verified | 专栏背景 + 遮罩 + 居中成功弹窗；关闭回 `/dearseed?state=claimed` | owner 通过；返回目标按 D-054 更新 |
| 16 | 品牌故事 | 01 | T005 | `/brand-culture`（首页品牌故事或专栏「品牌文化」进入） | Placeholder | 当前为空富文本承载页；未来仅请求富文本，保留标题栏并返回来源页；原型长图不再作为当前页面内容 | 用户 2026-09-23 新决策 D-081；此前长图验收仅作历史证据 |
| 23 | 领取完专栏状态 | 01 | T005 | `/dearseed?state=claimed` | Verified | 「本期活动」主按钮由 前往领取 → 已领取（disabled），由 #15/#25 关闭后自动跳转复现 | owner 通过；承载路由按 D-054 更新 |
| 24 | 完善信息（学生） | 01 | T005 | `/onboarding?state=student` 或表单内选「学生」 | Verified | 身份选「学生」后展开年级 2 列网格（大一–大五、研一–研三，共 8 项）；切换教职工自动清空年级；年级非必填（owner 确认） | owner 通过（2026-08-22） |
| 25 | 填写完成后领取成功 | 01 | T005 | `/onboarding/success`（表单提交后自动进入） | Verified | 与 #15 同构的专栏背景弹窗，`from=onboarding` 文案分支；关闭回 `/dearseed?state=claimed` | owner 通过；返回目标按 D-054 更新 |

T005 证据（2026-08-24 #2 补齐 + #16 施工后复跑）：`BASE_URL=http://127.0.0.1:5177 node scripts/capture-t005.mjs`，27 张 375×812 截图见 `evidence/screenshots/t005-*.png`；`npm run typecheck` 与 `npm run build` 均 exit 0，4 个新素材已进入产物（`home-banner-carousel` 129.11 kB、`exchange-pick-shampoo-a` 64.09 kB、`exchange-pick-shampoo-b` 47.79 kB、`brand-culture-longpage` 653.84 kB）。

T005 补充证据（2026-08-24 #12/#13 按摹客真值修正后复跑）：`BASE_URL=http://127.0.0.1:5178 node scripts/capture-t005.mjs` exit 0、无 `[assert]` 失败，27 张截图重新生成；`npm run typecheck` 与 `npm run build` 均 exit 0，新增素材 `dialog-prompt-bottle` 61.20 kB 已进入产物。断言同步强化（不只替换字符串，避免同类错位回归）：
- #12：拆为「标题=恭喜你！」与「正文含见面礼已送达」两条独立断言 —— 原缺陷正是标题与正文错位，单条断言无法拦住。实测 `标题恭喜你=true 见面礼已送达话术=true 专栏背景=true 去完善信息=true 夹具占位壳=0`。
- #13：新增形态断言「右上角关闭图标可见」与「『我知道了』按钮数=0」，锁死 guide/force 不再张冠李戴；关闭动作改为点右上角图标。实测 `TIPS=true 双倍泡泡积分文案=true 右上关闭图标=true 我知道了按钮数=0 夹具占位壳=0`。

本轮新增断言记录：
- #2 轮播：可见=true、帧数=2、指示点=2、**位于黑金签到 Banner 之上**（用 `getBoundingClientRect().top` 客观比对 `[data-carousel-slide]` 与 `[data-home-checkin-banner]`）；轮播整体点击 → URL 含 `overlay=newcomer`。
- #2 为你精选：卡片数=2、「去兑换」按钮数=2、价格「200🫧」可见；点「去兑换」跳 `/exchange?overlay=redeem`。
- #16 品牌文化：`长图=true 全宽铺满=true(w=375) 页内按钮=0 返回栏=1 占位文案=0`；长图滚到底可完整浏览无裁切；**返回链路 `/` →（首页「诗得丽品牌专栏」入口）→ `/brand-culture` → 返回 `/`**。
- 沿用上一轮断言（#2 主按钮=前往领取；#23 已领取且 disabled；#15/#25 容器形态与关闭回落；#14 空提交校验；#24 年级=8；#12/#13 全部要点）本轮同样全部通过。

⚠️ 取证方式修正说明：#16 返回断言初版用 `page.goto('/brand-culture')` 直达后点返回，实测退回 `/onboarding/success`。原因是项目返回栏由 `TitleBar` 统一实现为 `navigate(-1)`（history back，全局既有行为、属禁改层），直达时 history 上一条正是脚本前一步地址。已改为走首页真实入口进入再返回，与摹客 remark「点击左上角的返回按钮回到主页面」一致；页面本身无缺陷。

脚本尾部 30 条控制台记录经分解全为 React Router v7 future flag 警告（`v7_startTransition` + `v7_relativeSplatPath`，既有全局噪声、非本次引入），无 `[assert]` 失败、无运行错误。

owner 验收结论：
- 2026-08-22 第一次：#14 #15 #23 #24 #25 判通过。
- 2026-08-22 补尾：**#12 #13 判通过**（实测 #12 → #13、#12 → 完善信息、下载提示、关闭弹窗均正常；typecheck/build 通过、无运行错误）。
- 2026-08-22 复核时为 **7/9 节点通过**，结束条件两项：① 补齐 #2 首页剩余内容（Banner 轮播、为你精选）；② owner 先确认 #16 品牌文化设计方向（B-001）再施工。
- 2026-08-24：owner 就上述两项给出定案并在施工完成后确认整卡通过；#2、#16 升为 `Verified`，**B-001 关闭**，T005 以 9/9 收口。

已知偏差（未自行修改，待决策）：`/claim/success`、`/onboarding/success` 作为背景渲染首页时**不显示底部 Tabbar**，因 `isTabPath()` 只匹配 `/` 与各 Tab 前缀，而该函数属 `routes.ts` 公共区段，超出「只改本任务区段 + 不改 Tabbar」的施工边界。

#### T006 会员、泡泡值、打卡与澡运

| # | 节点名 | 模块 | 卡 | 可达 | 等级 | 决策/风险 | 验收 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 4 | 打卡提示弹窗 | 02 | T006 | `/checkin?overlay=reminder` | Implemented | 按原型 §5 提示 + TIPS 两段文案实现（D-024）；「每日首次进入自动弹出」的触发与频次规则未确认，故只做 `?overlay=` 夹具直达，不写自动触发 | 未验收 |
| 5 | 泡泡值明细 | 02 | T006 | `/points`（`?state=income\|expense\|empty`） | Implemented | 余额 + 全部/收入/消耗筛选 + 空态 + 列表尾部（D-026）；条目建模为绝对值 `amount` + `kind`，符号由 `kind` 渲染；时间锚点统一到 2026-06 仅为展示口径（D-027）。**配色仍待确认（B-002）：本轮沿用项目金橙 Token，未改条目、金额与增减类型** | 未验收 |
| 6 | 会员中心 | 02 | T006 | `/membership` | Implemented | 四入口按原型逐字校正为 今日澡运 / 是日任务 / 优惠卡包 / 洗头搭子（D-022）；LV.4 命名统一为「溱蜜传说」（D-029）；泡泡值余额与查看等级入口实测可跳转。等级数量/命名/限定卡面沿用历史稿，待确认（B-022） | 未验收 |
| 7 | 今日澡运 | 02 | T006、T022 | `/luck`（`?state=drawn`） | Implemented | T022 整改后为**不可操作占位页**：无抽取 CTA、无结果页入口，主位为「敬请期待」占位块 + 「玩法筹备中」说明 + 「玩法待定」标签，两种状态口径一致（原 D-025 的抽取/结果入口已下线，文案暂存 `LUCK_DRAW` 待定稿恢复）。**签运档位、重抽与结果持久化规则未确认（B-003）**，由 `LUCK_RULE_STATUS` 隔离，不做随机与持久化 | 未验收 |
| 8 | 打卡成功 | 02 | T006 | `/checkin?state=success` | Implemented | 独立打卡成功态由 `?state=success` 承载，复用同一月历与连续天数（`CHECKIN_STREAK` 由 `CHECKIN_DONE_DAYS` 推导，不硬编码） | 未验收 |
| 21 | 打卡日历 | 02 | T006 | `/checkin` | Implemented | 已改为原型月历式：单月 30 格、已签到 9 / 今天 1 / 可补签 2 / 未到 18（D-023）。月份切换（B-019）、补签消耗与上限（B-020）、底部「为你精选」清单（B-018）未确认，均登记于 `CHECKIN_RULE_STATUS` 未实现 | 未验收 |
| 22 | 补打卡成功弹窗 | 02 | T006 | `/checkin?overlay=make-up-success` | Implemented | 点日历漏签日「6 日补签」实测可打开弹窗并改写 URL（D-024）。**弹窗内广告位与 30s 关闭倒计时未确认（B-021），本轮不实现** | 未验收 |
| 26 | 会员等级 | 02 | T006 | `/membership/levels` | Implemented | 展示原型备注「仅开会时作展示」+ LV.1–LV.4 分级 + 本季限定卡面（D-028）；**按原型未画即不补：不做权益矩阵与升级进度（B-023）**，等级命名待确认（B-022） | 未验收 |
| 41 | 抽取成功 | 02 | T006 | `/luck/result`（`?state=great\|good\|minor`） | Implemented | 默认态只呈现已确认的奖励文案；大吉/中吉/小吉三档降级为显式 `?state=` 且各带「未定稿」隔离标识，`nextLuck()` 为确定性推进（D-025）。**三档命名、随机重抽与持久化仍未确认（B-003）** | 未验收 |

T006 本轮证据（2026-08-22）：`BASE_URL=http://127.0.0.1:5174 node scripts/capture-t006.mjs`，17 张 375×812 截图见 `evidence/screenshots/t006-*.png`；`npm run typecheck` 与 `npm run build`（含 `tsc --noEmit`）均通过（1636 modules，CSS 48.37 kB / gzip 9.96 kB，JS 361.67 kB / gzip 108.03 kB）；控制台无 error/warning，仅 38 条 React Router v7 future flag 已知框架噪音。断言记录：#6 四入口=今日澡运/是日任务/优惠卡包/洗头搭子、泡泡值余额入口与本期活动区块均存在；#26 原型备注可见、等级数=4、当前等级=LV.4；#5 余额=1,280、全部=15 条、income 符号=`+`、expense 符号=`-`、empty 文案可见；#21 周期=2026.06.01 - 2026.06.30，已签到 9 + 今天 1 + 可补签 2 + 未到 18 = 30；#8 打卡成功态可见；#4 提示与 TIPS 两段可见；#22 URL=`/checkin?overlay=make-up-success`；#7 默认态抽取按钮与 `?state=drawn` 结果入口、未定稿标注均可见；#41 默认态奖励文案可见且隔离标识=0、档位名=0，great/good/minor 各带隔离标识；D-020 `/checkin` 默认态调试面板=0、`?debug=1` 下 states=2（含默认）overlays=3（含关闭）。

交互实测（真实点击）：`/membership` 点「泡泡值余额 1280」→ `/points`；点「查看等级」→ `/membership/levels`；`/checkin` 点日历漏签日「6 日补签」→ 弹窗出现且 URL 改写；`/luck/result` 点「返回会员中心」→ `/membership`；`?debug=1` 调试面板胶囊可切换。其余状态（`/points` 三态、`/checkin?state=success`、`/checkin?overlay=reminder`、`/luck?state=drawn`、`/luck/result` 三档）为 `?state=` / `?overlay=` 夹具直达断言，不经点击，不计入交互实测。

决策记录见 [T006-membership-checkin.md](./decisions/T006-membership-checkin.md)（D-022–D-030）。本轮判 `Implemented`、不自判 `Verified`：#5 配色（B-002）、#7/#41 澡运规则（B-003）与新登记的 B-018–B-023 仍待用户决策，页面按「未确认即不实现」处理，规则开关登记在 `LUCK_RULE_STATUS` / `CHECKIN_RULE_STATUS` / `MEMBER_RULE_STATUS`。

#### T007 搭子与邀请闭环

| # | 节点名 | 模块 | 卡 | 可达 | 等级 | 决策/风险 | 验收 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 27 | 搭子（无） | 03 | T007 | `/buddy?state=empty` | Implemented | 与 #28 同一业务模型的空态档，仅换插画与引导文案（D-058）；数量上限/排序/解绑 ⚠️ B-004（`BUDDY_RULE_STATUS.buddyCount`） | 未验收 |
| 28 | 搭子（有） | 03 | T007 | `/buddy`、`/buddy?state=multi` | Implemented | `list`/`multi` 两档，`multi` 沿用原型 4 行「小美」占位；历史 T07 稿 4 人 mock 与默契值数值一律不继承，且以负向断言防回归（D-057/D-058/D-059） | 未验收 |
| 29 | 邀请搭子 | 03 | T007 | `/buddy/invite` | Implemented | 只还原摹客真值（二维码区 + 话术胶囊 + 截图提示 + 保存/复制双入口），T06 二次设计不继承（D-057）；未登记 `states` 故无调试面板（D-064）；二维码为占位图形 ⚠️ B-005 | 未验收 |
| 30 | 邀请搭子（没APP） | 03 | H034 | `/buddy/invite/scan` | Implemented | 保留 D-055 的 WebView 边界视觉；H034 用 Native `openApp(detect/open/store)` 取代 `?state=no-app|has-app` 假安装态与 `/buddy/accept` 假唤起。Native 当前未实现，真实 inviteCode/fallback 仍待真机联调 | 未验收 |
| 32 | 手机号邀请 | 03 | T007 | `/buddy/invite/phone`、`?state=searching/invitable/not-found/invited` | Implemented | 确定性号码映射（`BUDDY_SEARCH_OUTCOMES`，未登记号码落「可邀请」）；重复邀请由 `invitedPhones` 记忆且不再暴露发送按钮（D-061） | 未验收 |
| 33 | 手机号邀请成功 | 03 | T007 | `/buddy/invite/phone?state=success&phone=13900000000` | Implemented | 发送走适配层 `buddyShare.sendPhoneInvite`（固定 `SEARCH_LATENCY=500`，无随机，D-060）；「我知道了」回 `/buddy` | 未验收 |
| 34 | 二维码保存到本地 | 03 | T007 | `/buddy/invite/qrcode?state=saved`、`?state=poster-failed` | Implemented | 成功态为原型真值；失败态是任务卡要求的补充态，**只由 `?state=` 复现**、页内操作恒成功（D-056，用户 2026-08-24 定案）；相册权限 ⚠️ B-005 | 未验收 |
| 35 | 生成分享链接 | 03 | T007 | `/buddy/invite/qrcode?state=link-copied`、`?state=link-failed` | Implemented | 同上口径（D-056）；不调用 `navigator.clipboard`，统一走适配层避免成败随环境漂移（D-060） | 未验收 |
| 36 | 接受邀请 | 03 | T007 | `/buddy/accept`、`?state=dismissed` | Implemented | 专栏首页背景层 + 邀请弹窗（`titleBar: 'plain'`），只有「接受邀请」+ 关闭图标、不加「拒绝」（D-063）；接受后经共享状态 `state/buddies.ts` 落到 #28 已绑定（D-062） | 未验收 |

决策记录见 [T007-partner-invite.md](./decisions/T007-partner-invite.md)（D-055–D-066）。运行证据：`BASE_URL=http://127.0.0.1:5211 node scripts/capture-t007.mjs` 全部断言 PASS、20 张截图，控制台无 error/warning（46 条 React Router future-flag 提示为已知框架噪音）。本轮判 `Implemented`、不自判 `Verified`：`B-004`/`B-005` 的残余项（数量上限与排序解绑、端能力与正式头像素材）仍待用户决策，规则开关登记在 `BUDDY_RULE_STATUS`（D-065）；#31 默契值按 `B-006` 归 T014，T007 侧以负向断言保证无任何入口（D-059）。

#### T008 洗护兑换与商城链路

| # | 节点名 | 模块 | 卡 | 可达 | 等级 | 决策/风险 | 验收 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 17 | 卡博士商城（H5嵌入） | 04 | T008 | `/mall` | Implemented / App validation pending | D-082：`MallWebView` 在现有 H5 壳层内 iframe 承载 Maintainer 指定的 `http://www.3-wins.cn/`；HTTP scheme 不自动替换。真实 App WebView 的 cleartext/mixed-content、iframe policy 与鉴权仍待联调 | 未验收 |
| 18 | 洗护兑换专区 | 04 | T008 | `/exchange` | Implemented | 本地原生页（D-032，关闭 B-008）：余额条 + 搜索 + 三维度排序 + 商品卡；只用已注册语义 Token，未引入 T11 深绿金 KV；`/exchange` 语义已纠正为兑换专区（兑换码页在 `/redeem`）；SKU 清单未定挂 B-025 | 未验收 |
| 37 | 兑换量排行 | 04 | T008 | `/exchange?state=sort-exchange` | Implemented | 同一列表的排序状态而非独立页（D-033，原型 §2）；实测顺序与综合态不同 | 未验收 |
| 38 | 泡泡值排行 | 04 | T008 | `/exchange?state=sort-points` | Implemented | 同 D-033；排序方向取「由低到高」，原型未标升降序，挂 B-024 | 未验收 |
| 39 | 商品兑换弹窗 | 04 | T008 | `?overlay=redeem&product=e1`、`product=e5`（余额不足）、`product=e4`（售罄） | Implemented | 弹层承载（D-035）：商品/数量/说明/消耗/余额；余额不足与售罄由夹具数据推导，主按钮 disabled 且文案换为「泡泡值不足」/「已售罄」，非静态文案 | 未验收 |
| 40 | 存入卡包 | 04 | T008 | `/exchange/result?product=e1` | Implemented | 兑换专区作背景层 + 成功提示（D-036），双 CTA 实测「查看我的卡包」→`/card`、「关闭」→`/exchange`；不做持久化扣减与卡包写入，挂 B-026 | 未验收 |
| 48 | 商品详情页 | 04 | T008 | `/mall/goods/1001` | Implemented | WebView 边界页（D-031），伪 URL `…/goods/1001` | 未验收 |
| 49 | 购物车 | 04 | T008 | `/mall/cart` | Implemented | WebView 边界页（D-031），伪 URL `…/cart` | 未验收 |

T008 本轮证据（2026-08-22）：`BASE_URL=http://127.0.0.1:5173 node scripts/capture-t008.mjs`，20 张 375×812 截图见 `evidence/screenshots/t008-*.png`（含 4 张 `t008-debug-panel-*` 调试面板展开态）；控制台无 error，交互断言全部通过；`npm run typecheck` 退出码 0，`npm run build` 通过（CSS 48.71 kB / gzip 10.02 kB，JS 371.34 kB / gzip 110.81 kB）。三维度排序实测顺序：综合 `e1/e2/e3/e4/e5` → 兑换量 `e1/e2/e3/e5/e4` → 泡泡值 `e1/e2/e4/e3/e5`，点「综合」完全回归。调试面板门控实测：无 `debug=1` 时 `[data-debug-panel]` count=0，`?debug=1` 下 `/exchange` 与 `/mall` 均渲染且切换状态保留 `debug=1`。决策与未决项见 [T008-mall-exchange.md](./decisions/T008-mall-exchange.md)。

#### T009 卡包、核销、转赠与兑换码

| # | 节点名 | 模块 | 卡 | 可达 | 等级 | 决策/风险 | 验收 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 54 | 卡包 | 04 | T009 | `/card`、`/card?overlay=use&coupon=c1` | Implemented | 按 `reference/卡包.html` 三态 Tab（可用/已使用/已过期）+ 券卡 + 使用弹层；原型文档写的第 4 个「全部」Tab 与右上角「使用记录」标准页均无，见 D-014；B-016 已由用户定案关闭——卡包以 `reference/卡包.html` 为准，只保留三个 Tab | 未验收 |
| 62 | 卡包 - 可用 | 04 | T009 | `/card?state=available` | Implemented | 可用券展示金额/名称/有效期/可用 chip，提供「使用」「转赠」 | 未验收 |
| 63 | 卡包 - 已使用 | 04 | T009 | `/card?state=used` | Implemented | 标准页该 Tab 计数为 0，本态即设计好的空态「暂无已使用的体验券」；不造 `used` 夹具倒推产品规则，见 D-014 | 未验收 |
| 64 | 卡包 - 已过期 | 04 | T009 | `/card?state=expired` | Implemented | 已过期券置灰 + 时钟 chip，无操作按钮 | 未验收 |
| 65 | 分享 | 04 | T009 | `/card/share?coupon=c1` | Implemented | 按 `reference/分享.html` 还原：搜索框 + 「搭子列表」单选（默认选中首位）+ 底部主按钮，路由标题统一用「分享」（D-019）；B-015 已由用户定案关闭——搭子列表仅作夹具，不做对方接受/次数/时效/持久化 | 未验收 |
| 66 | 分享成功 | 04 | T009 | `/card/share?coupon=c1&state=success` | Implemented | 按 `reference/分享成功.html` 还原：成功 hero + 原型副文案「已成功分享给好友，邀请他也来一起玩吧」+ 「分享的商品」卡 + 「查看我的卡包」/「返回」双按钮（D-019）；B-017 已由用户定案关闭——「洗发试用装 / 已发货 / 单次使用」仅展示夹具，不实现物流规则 | 未验收 |
| 67 | 核销 | 04 | T009 | `/card/verify/confirm`、`?state=done`、`?state=repeat` | Implemented | 凭证明细 + 防误触确认 + 已核销反馈（Toast 后回 `/card?state=used`）+ 重复核销态 | 未验收 |
| 68 | 兑换卡券 | 04 | T009 | `/redeem`、`?state=format/invalid/used/network` | Implemented / real API pending verification | 2026-10-12 D-083：后台合同至少 10 位，原样提交，不限制字符集与前端上限；API `/api/cardredemptioncodes/redeem` 已接入 H5；旧 reference 12 位规则已被覆盖；覆盖格式错误/无效/已使用/网络异常 + 提交中 | 未验收 |
| 69 | 兑换成功 | 04 | T009 | `/redeem?state=success` | Implemented | 成功入包 + 兑换码回显 + 「查看我的卡包」/「再兑换一张」 | 未验收 |

T009 状态验收统一走页面右下角的「调试」胶囊（[DebugPanel.tsx](../../src/components/mobile/DebugPanel.tsx)，D-020）：胶囊只读 `routes.ts` 已登记的 `states`/`overlays`，点选后改写 `?state=` / `?overlay=`，上表所有 URL 都可以不手改地址栏直达。面板展开态证据：[t009-debug-panel-wallet.png](./evidence/screenshots/t009-debug-panel-wallet.png)、[t009-debug-panel-wallet-expired.png](./evidence/screenshots/t009-debug-panel-wallet-expired.png)、[t009-debug-panel-wallet-overlay.png](./evidence/screenshots/t009-debug-panel-wallet-overlay.png)、[t009-debug-panel-redeem.png](./evidence/screenshots/t009-debug-panel-redeem.png)、[t009-debug-panel-redeem-invalid.png](./evidence/screenshots/t009-debug-panel-redeem-invalid.png)。

#### T010 地址与订单

| # | 节点名 | 模块 | 卡 | 可达 | 等级 | 决策/风险 | 验收 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 55 | 地址管理（商城） | 04 | T010 | `/address`、`/address?state=empty` | Implemented | 列表 + 默认置顶（切换即置顶 + Toast，D-045）+ 编辑入口（`?id=`，D-043）+ 新增；数据走共享状态 `state/addresses.ts`（D-044）；行政区划数据源 ⚠️ B-027 | 未验收 |
| 56 | 订单管理（商城） | 04 | T010 | `/orders`、`?state=completed/ongoing/aftersale/empty` | Implemented | 全部/已完成/进行中/售后中 为同一列表四种筛选态（D-047）；订单状态全集 ⚠️ B-029，夹具只覆盖原型出现过的状态 | 未验收 |
| 60 | 添加新地址 | 04 | T010 | `/address/new`、`?state=invalid`、`?id=a2` | Implemented | 一页两用（新增 / 回填编辑，D-043）+ 必填校验 + 保存回流；粘贴识别只留入口与能力提示 ⚠️ B-028（D-046） | 未验收 |
| 72 | 订单详情 | 04 | T010 | `/orders/o1`、`/orders/o3`、`/orders/o4`、`/orders/none` | Implemented | 订单状态/收货地址/商品信息/价格信息/订单信息 五段式 + 不存在兜底空态；实付款只做「总价 + 运费」求和 ⚠️ B-030（D-048） | 未验收 |

T010 本轮证据（2026-08-24）：`BASE_URL=http://127.0.0.1:5173 node scripts/capture-t010.mjs`，21 张 375×812 截图见 `evidence/screenshots/t010-*.png`（含 3 张 `t010-entry-profile-*` 入口证据）；交互断言实测 `默认地址置顶: 张小鹿 -> 李思棠`、`新增地址回流列表可见: true`；`控制台/断言问题 38 条` 逐条为 React Router v7 future-flag 警告，无 `[error]` / `[pageerror]` / `[assert]`；`npm run typecheck` 退出码 0，`npm run build` 通过（`✓ built in 1.87s`，CSS 51.71 kB / gzip 10.48 kB，JS 407.00 kB / gzip 119.62 kB）。入口沿用 `/profile` 九宫格「订单管理」「地址管理」两块既有瓦片；施工中曾按 `prototype/04` §8 加过卡包「使用记录」入口，复核后按用户已定案的 B-016 / D-014 完整回滚，T010 未修改任何共享外壳组件。决策与未决项见 [T010-address-orders.md](./decisions/T010-address-orders.md)（D-043–D-050，B-027–B-030）。

#### T011 我的、设置与 APP 引导

| # | 节点名 | 模块 | 卡 | 可达 | 等级 | 决策/风险 | 验收 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 19 | 我的 | 05 | T011 | `/profile` | Verified | 按 reference 我的标准页实现（D-007）：暖白 hero（头像/昵称/VIP/等级进度/三宫格）+ 6 宫格常用功能 + 热门兑换；12 条对外跳转逐点实测落地，11 条返回路径实测回到 `/profile`；顶栏原「更多」死按钮已改为通知入口 → `/notifications` | 已验收（2026-08-22） |
| 20 | APP弹窗 | 05 | T011 | `/profile?overlay=app-prompt` | Verified | 小程序能力拦截引导；`/profile` 六宫格「绑定搭子」标记 `appOnly` 触发且不跳页（实测）；H034 已将「下载链接」接到 Native store target contract；当前 Native 未实现时明确失败，不在 H5 硬编码商店地址。**2026-08-24**：`AppPromptDialog` 拆两形态后本节点显式传 `variant="force"`（摹客「强制APP弹窗」双按钮「我知道了／下载链接」），与 T005 #13 的 `variant="guide"` 单按钮形态分离 | 已验收（2026-08-22） |
| 59 | 个人设置 | 05 | T011 | `/settings` | Verified | 头像/昵称/生日/年级/消费密码可编辑 + 底部动作面板 + 「确认修改」保存回 `/profile`（实测）；入口为 `/profile` 头像与铅笔，`/membership` 顶栏齿轮亦通 | 已验收（2026-08-22） |
| 61 | 放弃修改 | 05 | T011 | `/settings?overlay=discard` | Verified | 脏数据返回拦截 + 「确认放弃」真正离开至 `/profile`（实测）：`useBlocker` + 弹窗可见性由 `blocker.state` 驱动（blocked 期间禁止任何导航，否则污染 pending 导航使 `proceed()` 失效） | 已验收（2026-08-22） |

T011 本轮证据（2026-08-22）：`BASE_URL=http://127.0.0.1:5175 node scripts/capture-t011.mjs`，17 张 375×812 截图见 `evidence/screenshots/t011-*.png`；`npm run typecheck` 与 `npm run build` 通过。交互实测：正向跳转与出口 17 条全 PASS（含 `/profile` 12 个入口、`/membership` 齿轮、绑定搭子弹窗不跳页、`/settings` 三个出口），返回路径 11 条全 PASS，0 FAIL。等级依 §1 定义升为 `Verified`（截图＋交互＋工程证据齐备）；owner 于 2026-08-22 明确确认通过，任务卡状态为 `Accepted`。

#### T012 通知与消息详情

| # | 节点名 | 模块 | 卡 | 可达 | 等级 | 决策/风险 | 验收 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 11 | 通知 | 05 | T012 | `/notifications` | Implemented | 4 Tab（全部/未读/系统/活动）+ 今天/昨天/更早 分组 + 分类点/标签/摘要（D-010，B-010 已关闭） | 未验收 |
| 42 | 通知 副本（未读） | 05 | T012 | `/notifications?state=unread` | Implemented | 夹具进入未读 Tab；未读数由共享状态派生（D-010/D-013） | 未验收 |
| 43 | 清除消息 | 05 | T012 | `/notifications?overlay=clear` | Implemented | 「全部标为已读」确认弹窗 + 结果反馈 Toast，不做删除（D-012） | 未验收 |
| 44 | 消息详情 | 05 | T012 | `/notifications/:id` | Implemented | 按 `:id` 渲染真实正文 + 进入即已读 + 活动类 CTA + 兜底空态（D-011，B-011 已关闭） | 未验收 |

#### T013 福利官、智能/人工客服

| # | 节点名 | 模块 | 卡 | 可达 | 等级 | 决策/风险 | 验收 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 57 | 品牌福利官 | 05 | T013 | `/service/welfare-officer` | Implemented | 服务列表按摹客 3 类（人工客服/活动咨询/福利抽奖），历史稿 4 项作废（D-038，B-012 已关闭） | 未验收 |
| 58 | 智能客服 | 05 | T013 | `/service/chat` | Implemented | 只做欢迎/对话/发送失败重试/企微入口；4 个热门问题不实现，失败由关键词确定性映射（D-039/D-040，B-013 口径部分关闭，热门问题清单仍缺依据） | 未验收 |
| 70 | 人工客服排队 | 05 | T013 | `/service/chat/human?state=queuing`、`?state=connected` | Implemented | 仅排队中/已接入两态，无人数递减/倒计时/虚假队列；历史消息头像保持「诗」，坐席开场语用「哥」（D-041/D-042，B-014 已关闭） | 未验收 |
| 71 | 请求人工客服 | 05 | T013 | `/service/chat?overlay=request-human` | Implemented | 企微二维码引导弹层（占位码 + 仅「取消」，按原型 §10）；进入 #70 的前进入口与企微本体跳转均未确认，故不实现（D-041） | 未验收 |

### 4.2 范围关闭节点（12，T014）

| # | 节点名 | 模块 | 卡 | 范围结论 | 理由 | 验收 |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | 首页 | 06 | T014 | Exclude | 原型总览画布，非单一业务页，禁止实现成巨型首页 | 范围关闭 |
| 3 | 颜色测试 | 06 | T014 | Exclude | 视觉试验页，不注册业务路由 | 范围关闭 |
| 9 | 健康管理（暂时不做） | 06 | T014 | Needs Decision | 页面名已标“暂时不做” | 范围关闭 |
| 10 | 数字空间（暂时不做） | 06 | T014 | Needs Decision | 页面名已标“暂时不做” | 范围关闭 |
| 31 | 搭子默契值（先不做） | 03/06 | T014 | **最高风险** | 摹客明确“先不做”；T14 历史稿 4 维评分/曲线不得采用 | 范围关闭 |
| 45 | 数字空间 2 | 06 | T014 | Preserve Evidence | 数字空间另一版本状态，与 #10 取舍未定 | 范围关闭 |
| 46 | 单品碎片 | 06 | T014 | Preserve Evidence | 数字藏品碎片进度，随 #10 关闭 | 范围关闭 |
| 47 | 获取碎片 | 06 | T014 | Preserve Evidence | 扫码得碎片反馈，随 #10 关闭 | 范围关闭 |
| 50 | 卡博士积分界面 | 06 | T014 | Preserve Evidence | 旧/并存积分体系，与泡泡值主表达不合并 | 范围关闭 |
| 51 | 积分明细 | 06 | T014 | Preserve Evidence | 旧/并存积分流水，与泡泡值明细不合并 | 范围关闭 |
| 52 | 数据填写 | 06 | T014 | Exclude | 健康测评数据录入，随 #9 关闭 | 范围关闭 |
| 53 | AI推荐 | 06 | T014 | Exclude | 健康测评推荐，随 #9 关闭 | 范围关闭 |

> 范围结论：`Exclude`＝明确不做；`Needs Decision`＝暂缓但未来可能恢复；`Preserve Evidence`＝保留证据与入口但本轮不实现。任何节点要重新纳入实施，必须先有用户确认记录并回写对应任务卡与 T001。

## 5. 覆盖计数结果（自动/人工核对）

- 72 节点全部入表，无遗漏。
- 实施 60 + 关闭 12 = 72，节点无重复归属、无双重计数。
- 当前矩阵分布：`Verified` 13、`Implemented` 26、`Partial` 0、`Placeholder` 0、`Missing` 21、范围关闭 12；详见 §3 当前快照。任务卡 `Accepted` 是 owner 对整卡完整度的结论，不要求逐节点都机械升级为 `Verified`。
- 阻塞节点（决策未决，禁止施工）：#16 #18 #27 #28 #29 #31 #37 #38，共 8 个（含 T014 的 #31）。T012 的 #11 #42 #44 已由 D-010/D-011 解除阻塞（见 [decisions/T012-notifications.md](decisions/T012-notifications.md)）；T009 的 #68 #69 已由 D-008 关闭 B-009 解除阻塞；T009 的 B-015 / B-016 / B-017 已于 2026-08-22 由用户定案关闭，T009 已无未关闭阻塞项（见 [decisions/T009-wallet-redemption.md](decisions/T009-wallet-redemption.md) §7）；T006 的 #5 #41 已由该卡交付时的夹具开关隔离方案解除阻塞；T013 的 #57 #58 #70 已由 D-038–D-042 解除阻塞（见 [decisions/T013-customer-service.md](decisions/T013-customer-service.md)）。

## 6. 修订前后差异说明

| 项 | 修订前（旧基线） | 修订后（本矩阵） |
| --- | --- | --- |
| `docs/design/design-baseline.md` | 曾标 `PASS`，把「不靠谱的设计历史」当质量下限 | `PASS` 撤销；历史稿重定位为「待确认参考」，见 [design-baseline.md](../design/design-baseline.md) |
| 完成度依据 | 以「构建通过 / 智能体自审」为通过信号 | 以逐节点实现等级 + 截图 + 交互 + 用户验收为准 |
| 覆盖证明 | 只有任务名 + 一句说明 | 72 节点逐行矩阵 + 60/12 计数校验 |
| 路由语义 | 旧快照把 `/card`、`/exchange` 当作主 Tab，且保留 `/draw-success` | 全量注册表已审计；五项主 Tab 为 `/`、`/checkin`、`/card/verify`、`/membership`、`/profile`；`/draw-success` 重定向至 `/luck/result` |
| 暂缓页面 | 可能被「全量适配」偷渡施工 | T014 12 节点逐一给出范围结论，未授权不得转实施 |

## 7. 证据索引

- 最新种籽页截图命名：`docs/workbench/evidence/screenshots/t001-seed-{home,points,scan,membership,profile}.png`（375×812）；现有 `t001-seed-checkin.png` 降为历史证据。旧 `route-*.png` 仅保留为历史证据，不再作为当前 T001 事实。
- 截图脚本：`scripts/capture-t001.mjs`（Playwright，`BASE_URL` 可覆盖，默认 `http://localhost:5173`）。
- 决策索引：`docs/workbench/decisions/README.md`。
- 任务卡：`docs/workbench/tasks/T001…T015`。
- 工程证据：`npm run typecheck`、`npm run build`、`scripts/verify-t001.mjs` 均通过（见 T001 卡）。


## 8. H040｜会员业务数据与历史四级展示分离（2026-10-08，实施待验收）

> **增量变更记录，不回写历史验收结论。** 原有 T006 / D-028 / D-029 保留为 2026-08 产品视觉历史证据，不能误认为后台已配置这四级。H040 追踪 [#93](https://github.com/dangjingtao/dr-card-ui/issues/93) 和 [PR #97](https://github.com/dangjingtao/dr-card-ui/pull/97)，未通过真实 App test 验收前状态仍为 **Implemented / Pending acceptance**。

| 维度 | T006 旧展示 | H040 当前施工目标 / 事实 | 验收边界 |
| --- | --- | --- | --- |
| `/membership` 当前会员 | `MEMBER_PROFILE` 历史视觉夹具：昵称、固定 LV.4 / 溱蜜传说、展示编号 | 会员昵称与等级从 `GET /api/user/profile` 读取；余额从 `GET /api/userpoints/stat` 读取；未配置则清楚标示，不伪造四级身份 | 需真实登录用户与真实响应对照 |
| `/membership/levels` 等级名单 | T006 固定 LV.1–LV.4，B-022 数量、名称、卡面未定 | `GET /api/usergrade/index` 仅渲染已启用等级；0 条显示未配置，失败显示失败/重试；`grade_id` 与后端等级 `id` 对齐 | 后台列表是唯一业务等级事实源；不因设计有四张图擅自增等级 |
| 卡面画廊 | 四张历史限定卡面艺术稿 | **保留四张静态视觉参考**，在 UI 明确不代表后台等级、实际生效卡面或权益。品牌素材与视觉结构不丢失 | 不得把四张卡面拿来推算启用会员等级数 |
| 等级未配置 | 原型没有这个数据态 | 后端 `User.profile` 无默认等级时可能省略 `grade/grade_id`；H5 应仍保留可用个人资料，等级标「尚未配置」，不得宣称「已是最高等级」 | service 契约测试 + 无数据/未配置页面态 |

### 开发后端现场证据与差异

- 本地只读后端 `API/master@4f91aa2` 的 `src/app/api/controller/UserGrade.ts`、`src/app/api/service/User.ts`、`docs/api-membership—levels.md`；未修改后台仓库。
- 2026-10-08 对 `https://tunnel-dev.3cgroup.cn/api/usergrade/index?status=10&page=1&pageSize=15` 的只读探测得到 HTTP 200、`code=0`、**2 条启用等级**：`id=1 泡泡新生 min_exp_number=1000`（默认）、`id=2 泡泡萌芽 min_exp_number=10000`。此为**开发环境瞬时状态**，不是 test/prod 的配置承诺。
- 历史设计四级：海泡泡新生、春氧达人、头皮管理员、溱蜜传说；当前并不与后台两级一一对应。B-022/B-023 仍待产品决定是否扩充后台等级、如何映射卡面、升级门槛与权益。**前端不新造等级、不代替后台配置。**
- 前端实现进度和后端是否已经部署、是否可在真机使用是三件不同的事；CI 全绿不能代替 App WebView 验收。

### 本卡验收余项

- [ ] PR #97 代码审查与 CI：会员等级数量动态变化（0 / 1 / 2 / 4 / 8+）、对比度正确、空态和错误态可恢复。
- [ ] test WebView：用登录用户核对 `profile.grade_id` / `usergrade.index.id`、实时 `userpoints.stat.points`；用户等级不在启用表内时记录后端数据异常。
- [ ] 产品/后台确认 B-022/B-023，决定是否把历史四级作为真实业务等级（不能由 H5 自动填充）。


## H041｜福利官配置真 API 接入增量证据（2026-10-08，待真机验收）

> 保留 T013/D-038 原有设计验收结论；此处记录业务数据由 Mockplus 静态展示迁为真实后端配置。施工卡 [#94](https://github.com/dangjingtao/dr-card-ui/issues/94)，接口文档 [#90](https://github.com/dangjingtao/dr-card-ui/issues/90)。**实现、构建与真实 WebView 验收是不同状态；不得因本记录提前将真机验收改为通过。**

| 链路 | 历史状态 | H041 对齐后的状态与验收边界 |
| --- | --- | --- |
| `/service/welfare-officer` 文案 | 固定 `WELFARE_OFFICER`（吴哥、诗得丽等） | `GET /api/settings/detail?key=brand_welfare_setting` 的 `title/subtitle`，未配置则为空态，不在 API 模式回退固定姓名 |
| 福利官二维码 | `WecomQrPlaceholder`，明确非真二维码 | 只有后端给出安全、可被 HTTPS WebView 加载的二维码 URL 才显示真图；无 URL / 非法 URL / 图片加载失败不能伪装可扫码 |
| 福利项列表 | 固定三项 D-038 视觉说明 | 后端 `benefits[].image/title/description` 动态驱动，无配置隐藏列表，无跳转动作，保留列表的视觉结构 |
| `settings/detail` 的 key | 既有 `welfare` 仍是品牌文化富文本别名 | 福利官严格传 `brand_welfare_setting`，不可把两种业务混用；Mock handler 必须按 key 精确过滤 |
| 例外状态 | 只展示 fixture | loading / error-retry / empty / unsafe image URL / image error 有显式行为；API 模式不使用静态业务模拟 |

### 后台资源地址待修（真实联调前置）

2026-10-08 对开发后端 URL `https://tunnel-dev.3cgroup.cn/api/settings/detail?key=brand_welfare_setting` **只读**请求：HTTP 200 / `code=0`；title 与 subtitle 配置存在，benefits 实际三项为「人工客服、活动咨询、福利抽奖」。但配置中的 **qrcode 和三个 benefit.image 均为 `http://127.0.0.1:7002/storage/...`**；这是后端服务器环回地址，手机 WebView 指向自身，且会形成 HTTPS 混合内容风险。

- H5 按安全规则隐藏不可加载的二维码/图片，明确提示；**不能猜测公网 CDN 或自行替换 hostname**。
- 后端/运营需提供浏览器可直接访问的公网 HTTPS 图片 URL，再进入 test App WebView 扫码实测。
- 这个后端资源配置问题不应与「H5 已接入 API」混为一谈。可不阻塞代码 PR → dev，但不能宣布真正扫码功能已验收。

### H041 验收待办
- [ ] GitHub CI：typecheck、服务/页面测试、lint、build、浏览器基础回归
- [ ] test App WebView：响应与 UI 字段一一对应；二维码变为公网 HTTPS 后扫码，真实设备可识别
- [ ] 不修改同事 `workspace/API`、不更改 `ServiceChat` 的人工客服二维码占位语义


## #89｜首页与签到页记录查询范围修复（2026-10-08，待 CI / test 验收）

- **问题证据：** 正式 H5 `/` 首页仅展示 7 日签到入口，`/checkin` 详情页使用完整月历，但改造前共用 `useSignRecords()` 默认按 `range=month` 查询，首页请求了不必要的本月记录。
- **后端依据：** 只读 `API/master@4f91aa2` 的 `src/app/api/service/SignRecords.ts`、`docs/api-index.md` 和 `docs/api-checkin.md`：`GET /api/signrecords/index` 已提供 `range=week|month`，周起始以周一计；不需要修改后端。
- **修复：** `Home` 显式 `useSignRecords('week')`、`Checkin` 显式 `useSignRecords('month')`（代码通过同名常量）；共享 hook 使用依赖范围的稳定回调，保持历史默认 `month`，避免无意破坏其他调用者。
- **回归边界：** 页面请求参数、Hook 默认 / 切换范围 / 不重复请求由 Vitest 锁定；签到/补签记录的 `year/month/day` 业务日归属及 UI/Native 交互保持不变。
- **验收：** GitHub CI/PR 审查通过后可合入 `dev`；真机 test 登录态确认首页的实际网络请求为 `range=week`、签到页为 `range=month`；不得把 dev 构建成功当作 App WebView 业务验收。
- 关联：[Issue #89](https://github.com/dangjingtao/dr-card-ui/issues/89)、总卡 [#92](https://github.com/dangjingtao/dr-card-ui/issues/92)。


## H044｜用户真实资料统一与保存（#103，2026-10-08，实施中）

- **事实源**：`dev` 现有 `src/services/userProfile.ts`；本地后端 `workspace/API/docs/api-profile.md`、`src/app/api/controller/{User,Upload}.ts`、`src/app/api/service/User.ts` 的只读核对。源码存在不等于 test 环境部署可用。
- **身份读取**：正式 H5 的头像/昵称统一取当前用户 `GET /api/user/detail`，避免 `GET /api/user/profile` 登录 Redis 快照盖回已写入资料；现有 `profile` 仍负责等级、优惠券等快照字段。采用非持久化、按认证会话隔离的共享状态。
- **提交**：昵称/年级/头像在「确认修改」后才调用 `POST /api/user/update`；以写入结果更新页面状态，失败保留编辑稿并提示，不再假成功。头像先由 Native 选择，经 multipart `POST /api/upload/image` 得 URL 后再更新；拒绝非公网 HTTPS URL。
- **未确认合同**：生日和消费密码没有本期已证实的写入合同，UI 明确不可保存而不伪造完成；后端图片域名、上传字段、App 相机/相册调用仍需 test WebView 实测。
- **验证状态**：工程改动与聚焦单测已提交至 `feat/103-h044-user-profile`，GitHub CI 与 PR Review 待核；**真账号图片上传、资料修改后重载、Android/iOS WebView 尚未验收，Issue 不应因此关闭**。

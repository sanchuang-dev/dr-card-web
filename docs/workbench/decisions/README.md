# 决策索引（T001）

> 本索引汇总 15 张任务卡涉及的已确认决策与待确认阻塞项，作为 T001 事实矩阵（[`evidence-matrix.md`](../evidence-matrix.md)）的决策反向链接。
> 决策优先级遵循 `AGENTS.md`：用户确认 > 已确认摹客原型 > 原型文档 > Com Design/公共组件 > 已验收实现 > 历史参考 > 智能体推断。

## 1. 已确认决策

| 编号 | 决策 | 状态 | 依据/记录 | 关联卡/节点 |
| --- | --- | --- | --- | --- |
| D-001 | 完善信息采用分步 onboarding（权益引导→基本信息→身份补充→安全设置→领取成功）；字段含昵称/生日/性别/身份/消费密码，学生增年级 | PASS | [T01-A-info-architecture.md](../T01-A-info-architecture.md) | T005 #14 #24 |
| D-002 | 设计基线三方约束：Mockplus 结构保留 + Com Design 体系 + 品牌视觉升级；历史稿仅作待确认参考，非质量下限 | PASS | [design-baseline.md](../../design/design-baseline.md) | 全局 |
| D-003 | 主链路确认：诗得丽专栏为入口，经新人流程、打卡、会员/泡泡值、兑换入包、卡包核销/转赠、我的服务 | PASS | [prototype/README.md](../../prototype/README.md) §4 | 全局 |
| D-004 | 原型差异不擅自统一：泡泡值/积分并存、诗得丽/DearSeed 名称、8/11 位兑换码、APP/小程序边界 | PASS | [prototype/README.md](../../prototype/README.md) §5 | T014 #50 #51；T009 #68 |
| D-005 | T001 旧 `PASS` 撤销，改用逐节点证据 + 用户验收判定 | PASS | [evidence-matrix.md](../evidence-matrix.md) §6 | T001 |
| D-006 | 根首页（`/`）按「不靠谱的设计历史/首页.html」实现，物料同源（用户 2026-08-21 确认，参考稿已放入 `reference/首页.html`） | PASS | [首页.html](../../../reference/首页.html)、[Home.tsx](../../../src/pages/Home.tsx) | T005 #2 |
| D-007 | 泡泡/服务/我的 一级页面以 reference 标准页实现：每日签到领福利→`/checkin`、会员中心→`/membership`、我的→`/profile`；底部 4 Tab 维持现状（D1 不变） | PASS | [每日签到领福利.html](../../../reference/每日签到领福利.html)、[会员中心.html](../../../reference/会员中心.html)、[我的.html](../../../reference/我的.html) | T005/T006/T011 |
| D-008 | reference 其余参考页全部接入：卡包→`/card`、扫码→`/card/verify`、确认核销→`/card/verify/confirm`、消费密码核销→`/card/verify/password`、会员等级→`/membership/levels`、兑换卡券→`/redeem`（12 位规则按 reference 确认）、泡泡值明细→`/points`、资料设置→`/settings`、完善信息→`/onboarding`、品牌福利官→`/service/welfare-officer`、通知→`/notifications`、消息详情→`/notifications/:id` | PASS | reference/*.html、src/pages/ | T005–T013 |
| D-009 | 底部导航按 reference 首页 5 项 Tab 重构：首页/泡泡(`/checkin`)/扫码(`/card/verify` FAB)/服务(`/membership`)/我的(`/profile`)（由并发会话落实，覆盖 D1 的 4 Tab） | PASS | [routes.ts](../../../src/app/router/routes.ts) | 全局 |
| D-010 | 通知列表采用 reference 的 全部/未读/系统/活动 4 Tab；「全部」角标有未读显未读数、无未读显总数；列表按 今天/昨天/更早 分组（关闭 B-010） | PASS | [T012-notifications.md](T012-notifications.md) | T012 #11 #42 |
| D-011 | `/notifications/:id` 按 `:id` 渲染真实单条正文（不保留 system/promo 双 Tab 演示）；进入详情即已读；CTA 仅活动类携带；标题栏用中性标题「消息详情」（关闭 B-011） | PASS | [T012-notifications.md](T012-notifications.md) | T012 #44 |
| D-012 | 节点 #43「清除消息」承载「全部标为已读」确认层 + 结果反馈 Toast，不做删除消息 | PASS | [T012-notifications.md](T012-notifications.md) | T012 #43 |
| D-013 | 通知已读状态由模块级共享状态 `src/app/state/notifications.ts` 提供（订阅广播、不持久化，保证 `?state=` 夹具可复现） | PASS | [state/notifications.ts](../../../src/app/state/notifications.ts) | T012 #11 #42 #44 |
| D-014 | 卡包采用 reference 卡包标准页的 可用/已使用/已过期 三态 Tab，不引入原型文档写的第 4 个「全部」Tab 与右上角「使用记录」入口（用户已关闭 B-016，定案「卡包以 `reference/卡包.html` 为准，只保留三个 Tab」） | PASS | [T009-wallet-redemption.md](T009-wallet-redemption.md) | T009 #54 #62 #63 #64 |
| D-015 | `#63 卡包-已使用` 保持标准页设计的空态，不新增 `status: 'used'` 卡券夹具填充画面；核销成功跳 `/card?state=used` 落到空态属预期 | PASS | [T009-wallet-redemption.md](T009-wallet-redemption.md) | T009 #63 #67 |
| D-016 | 分享为 单选＋搜索＋「下一步」→ 成功页 的前端闭环；对象列表按原型做「搭子列表」夹具，不做对方接受、次数限制、时效限制和持久化，分享后原卡包状态不变（用户已关闭 B-015 并定案该范围） | PASS | [T009-wallet-redemption.md](T009-wallet-redemption.md) | T009 #65 #66 |
| D-017 | **历史原型决策；已被 D-083 覆盖**：兑换码规则曾含 `pending`/`blocker`/`source`、仅空输入禁用；正式后台合同按至少 10 位执行 | Superseded by D-083 | [T009-wallet-redemption.md](T009-wallet-redemption.md) | T009 #68 #69 |
| D-018 | 核销链路收口为 确认 → 结果反馈 Toast → 回 `/card?state=used`，并补 `?state=repeat` 重复核销态 | PASS | [T009-wallet-redemption.md](T009-wallet-redemption.md) | T009 #67 |
| D-019 | #65/#66 以用户当轮提供的原型为准还原：#65 为「搜索 + 搭子列表单选 + 底部主按钮」，#66 为「成功 hero + 副文案「已成功分享给好友，邀请他也来一起玩吧」+ 分享的商品卡 + 查看我的卡包/返回 双按钮」；`/card/share` 路由标题统一为「分享」，卡包入口按钮保留原型的「转赠」 | PASS | [分享.html](../../../reference/分享.html)、[分享成功.html](../../../reference/分享成功.html)、[CardShare.tsx](../../../src/pages/CardShare.tsx) | T009 #65 #66 |
| D-020 | 状态验收统一由 `DebugPanel` 承载：胶囊只读 `routes.ts` 已登记的 `states`/`overlays`，切换仅改 `?state=`/`?overlay=`（`replace`），未登记状态的路由渲染 null；面板为验收工具，不属业务 UI，`z-[60]` 高于弹层/Toast（z-50）与 Tabbar（z-40） | PASS | [DebugPanel.tsx](../../../src/components/mobile/DebugPanel.tsx)、[routes.ts](../../../src/app/router/routes.ts) | T009 #62 #63 #64 #65 #66 #67 #68 #69 |
| D-021 | 调试面板仅在 `?debug=1` 时渲染，正常页面完全不出现（避免遮挡底部操作区）；面板切换 `state`/`overlay` 时 `debug=1` 原样保留 | PASS | [DebugPanel.tsx](../../../src/components/mobile/DebugPanel.tsx)、[capture-t009.mjs](../../../scripts/capture-t009.mjs) | T009 全节点 |
| D-022 | #6 会员中心四入口按摹客 §1 逐字还原为 今日澡运 / 是日任务 / 优惠卡包 / 洗头搭子（不用历史稿的「今日幸运 / 每日任务」），去向 `/luck`、`/checkin`、`/card`、`/buddy` | PASS | [T006-membership-checkin.md](T006-membership-checkin.md) | T006 #6 |
| D-023 | #21 打卡日历为单月月历（周期 `2026.06.01 - 2026.06.30`，30 天、首日周一、夹具「今天」12 日），四态 已签到/今日已签到/可补签/未到；不提供月份切换（原型未画切换范围，B-019） | PASS | [T006-membership-checkin.md](T006-membership-checkin.md) | T006 #21 #8 |
| D-024 | #4 打卡提示与 #22 补打卡成功统一由 `?overlay=reminder` / `?overlay=make-up-success` 弹层承载，不做独立页面；日历补签点击后跳 `?overlay=make-up-success` | PASS | [T006-membership-checkin.md](T006-membership-checkin.md) | T006 #4 #22 |
| D-025 | #41 默认态只呈现摹客确认的奖励表达（50🫧 + 返回会员中心）；大吉/中吉/小吉三档与重抽降级为显式 `?state=` 夹具且必须带未定稿隔离标识，`nextLuck()` 确定性推进、全链路去随机（落实「随机澡运和重抽规则先隔离」） | PASS | [T006-membership-checkin.md](T006-membership-checkin.md) | T006 #41 #7 |
| D-026 | #5 流水金额建模为 `{ amount: 绝对值, kind: 'income'\|'expense' }`，符号与配色由 `kind` 决定，页面不解析字符串；全部/收入/消耗为确定性过滤 | PASS | [T006-membership-checkin.md](T006-membership-checkin.md) | T006 #5 |
| D-027 | #5 流水时间锚点统一到 `CHECKIN_CYCLE_LABEL` 的 2026-06 周期（消除 T006 夹具内 2026-08 与 2026-06 的自相矛盾）；仅统一展示口径，条目/金额/增减类型/条数不变，B-002 仍未决 | PASS | [T006-membership-checkin.md](T006-membership-checkin.md) | T006 #5 |
| D-028 | #26 会员等级页明示原型备注「本页为会员等级分级，仅开会时作展示。」，不展示权益矩阵、升级进度与未解锁判定（原型均未画，B-022/B-023） | PASS | [T006-membership-checkin.md](T006-membership-checkin.md) | T006 #26 |
| D-029 | LV.4 命名同页出现「深鲨传说 / 溱蜜传说」两种写法，统一取会员等级页在用的「溱蜜传说」并收敛到夹具 `MEMBER_PROFILE`；整体等级命名仍挂 B-022 | PASS | [T006-membership-checkin.md](T006-membership-checkin.md) | T006 #6 #26 |
| D-030 | 滚动列表型二级页的底部主操作用 `sticky bottom-0` + `pb-[calc(1rem+env(safe-area-inset-bottom))]`（见 `NotificationDetail.tsx`），不得按 TabBar 高度做 `fixed` 偏移——`MobileLayout` 只在 Tab 路由渲染 `BottomNav` | PASS | [Points.tsx](../../../src/pages/Points.tsx)、[MobileLayout.tsx](../../../src/layouts/MobileLayout.tsx) | T006 #5 |
| D-031 | H5 商城三节点最初统一走 WebView 边界页；**2026-09-29 起 `/mall` 主入口已被 D-082 覆盖**，本决策继续适用于 `/mall/goods/:id` 与 `/mall/cart` 的边界承载 | SUPERSEDED-PARTIAL | [T008-mall-exchange.md](T008-mall-exchange.md) | T008 #17 #48 #49 |
| D-032 | 洗护兑换专区为本地原生页，视觉只消费已注册的 `exchange-*`/`bubble-*`/`coupon-*` 语义 Token；不引入历史 T11 深绿金 KV，不新建页面私有配色（用户定案，关闭 B-008） | PASS | [T008-mall-exchange.md](T008-mall-exchange.md) | T008 #18 #37 #38 #39 #40 |
| D-033 | #18/#37/#38 是同一列表的三种排序状态而非三个页面：`/exchange` + `?state=sort-exchange`/`sort-points`，「综合」为默认态（清空 `state`）；搜索与排序正交 | PASS | [T008-mall-exchange.md](T008-mall-exchange.md) | T008 #18 #37 #38 |
| D-034 | 搜索检索范围为「商品名 + 商品说明」（`exchangeSearch`）；商品卡只渲染名称/泡泡值/兑换量，商品说明仅出现在 #39 弹窗内（按原型 §1/§3 字段口径） | PASS | [T008-mall-exchange.md](T008-mall-exchange.md) | T008 #18 #39 |
| D-035 | #39 兑换确认为弹层 `?overlay=redeem&product=<id>`；余额不足/售罄时主按钮 disabled 且文案换为「泡泡值不足」/「已售罄」，并在列表卡以 Tag/蒙层同步标记 | PASS | [T008-mall-exchange.md](T008-mall-exchange.md) | T008 #39 #18 |
| D-036 | #40 存入卡包沿用兑换专区作为背景层 + `PromptOverlay`，双 CTA「查看我的卡包」→`/card`、「关闭」→`/exchange`；提交中态固定 700ms，不引入随机 | PASS | [T008-mall-exchange.md](T008-mall-exchange.md) | T008 #40 |
| D-037 | 兑换未决业务规则集中在夹具 `EXCHANGE_RULE_STATUS`（`confirmed`/`blocker`/`note`），页面不硬编码，也不得把夹具当已确认规则（沿用 D-017 模式） | PASS | [T008-mall-exchange.md](T008-mall-exchange.md) | T008 #18 #37 #38 #39 #40 |
| D-038 | 品牌福利官服务列表为摹客的 3 类（人工客服 / 活动咨询 / 福利抽奖），历史稿 T08 的 4 项服务卡作废（关闭 B-012） | PASS | [T013-customer-service.md](T013-customer-service.md) | T013 #57 |
| D-039 | 智能客服只实现 欢迎 / 对话 / 发送失败与重试 / 企微客服入口 四件事；原型提到但未给条目的 4 个「热门问题」不实现，企微入口与转人工统一落到 #71 二维码引导弹层 | PASS | [T013-customer-service.md](T013-customer-service.md) | T013 #58 #71 |
| D-040 | 发送成败由关键词确定性映射（`CHAT_FAIL_KEYWORDS`）决定，不用随机数、不做概率失败；`CHAT_FAILED_MESSAGES` 刻意不含失败关键词，保证重试必定成功 | PASS | [T013-customer-service.md](T013-customer-service.md) | T013 #58 |
| D-041 | #70 只有 排队中 / 已接入 两个 `?state=` 驱动态；不做人数递减、等待倒计时、虚假队列，也不编造坐席后续问答（关闭 B-014）。#71 弹层内只保留原型明确的「取消」，#71 → #70 的前进入口未确认故不实现，#70 暂由直达路由与 `?debug=1` 验收 | PASS | [T013-customer-service.md](T013-customer-service.md) | T013 #70 #71 |
| D-042 | 智能客服历史消息保留进入 #70，接入后仅追加一条坐席开场语；头像字形由消息自身 `glyph` 承载——历史消息保持「诗」、坐席消息用「哥」，不把历史说话人改写为人工客服 | PASS | [T013-customer-service.md](T013-customer-service.md)、[ChatMessageList.tsx](../../../src/components/mobile/ChatMessageList.tsx) | T013 #70 |
| D-043 | #60 同页承载「新增」与「编辑」两种用途，由 `?id=<addressId>` 触发回填，不新建编辑页路由（原型 §12 只画编辑入口、未画编辑页，字段完全一致） | PASS | [T010-address-orders.md](T010-address-orders.md) | T010 #55 #60 |
| D-044 | 地址数据由模块级共享状态 `src/app/state/addresses.ts` 提供（订阅广播、不持久化），保证「新增后返回列表可见」是真实数据流（沿用 D-013 模式） | PASS | [state/addresses.ts](../../../src/app/state/addresses.ts) | T010 #55 #60 |
| D-045 | 默认地址为全局单选：切换后该项立即置顶并触发反馈 Toast，已是默认的项不可重复点按 | PASS | [T010-address-orders.md](T010-address-orders.md) | T010 #55 |
| D-046 | 「粘贴识别收件信息」只保留入口与能力提示 Toast，不实现剪贴板读取与地址解析（原型 §13 未给解析规则，B-028） | PASS | [T010-address-orders.md](T010-address-orders.md) | T010 #60 |
| D-047 | #56 的 全部订单/已完成/进行中/售后中 为同一列表四种筛选态：`/orders` + `?state=completed/ongoing/aftersale`，「全部订单」为默认态（清空 `state`），另有 `?state=empty`（沿用 D-033） | PASS | [T010-address-orders.md](T010-address-orders.md) | T010 #56 |
| D-048 | #72 固定为 订单状态/收货地址/商品信息/价格信息/订单信息 五段式；实付款只做「商品总价 + 运费」算术求和，不引入优惠与泡泡值抵扣（原型 §15 仅三字段，B-030） | PASS | [T010-address-orders.md](T010-address-orders.md) | T010 #72 |
| D-049 | 地址/订单未决业务规则集中在夹具 `ADDRESS_ORDER_RULE_STATUS`（`confirmed`/`blocker`/`note`），页面不硬编码，也不得把夹具当已确认规则（沿用 D-017/D-037） | PASS | [fixtures/index.ts](../../../src/app/fixtures/index.ts) | T010 #55 #56 #60 #72 |
| D-050 | T010 入口沿用 `/profile` 九宫格既有的「订单管理」→`/orders`、「地址管理」→`/address`；**不**新增卡包右上角「使用记录」入口——施工中曾按 `prototype/04` §8 添加，复核后按用户已定案的 B-016 / D-014 完整回滚，T010 未修改任何共享外壳组件 | PASS | [T010-address-orders.md](T010-address-orders.md) §3.4 | T010 #55 #56；T009 #54 |
| D-051 | #16 品牌文化只铺摹客原型长图（`D1gOOzGEq`：全页 0 button、单张 1683×5950 长图按 375 宽等比铺满 1414 artboard），**不加浮动 CTA、不继承 T13 深绿深色稿**；页面用 `PageContainer inset={false}` 全宽贴边，返回栏由 MobileLayout 统一提供，底色直接消费 `bg-background`（`#FCF8F1` 与原型 `rgb(252,250,246)` 同属暖白，不为单页引入私有底色）。关闭 B-001 | PASS | [T005-entry-home-onboarding.md](T005-entry-home-onboarding.md) | T005 #16 |
| D-052 | #2 顶部 Banner 轮播严格按摹客层级放在最顶部（`carouselChart` @(0,88)），**黑金签到 Banner 顺次下移保留**（用户定案「黑金 Banner 之上另加一条轮播」）；轮播 interval 3000 / speed 700 取自原型 `playInterval`/`playSpeed`，整体点击 → `?overlay=newcomer`。⚠️ 原型第二帧素材为空字符串，按「不补图、不删帧」保留占位帧 | PASS | [T005-entry-home-onboarding.md](T005-entry-home-onboarding.md) | T005 #2 |
| D-053 | #2 「为你精选」商品清单、名称、描述、价格（200🫧）与「去兑换」目标一律照抄摹客原型（用户定案「按原型」），两卡文案原型本就相同故不去重、不自行编造差异；「去兑换」底板 `#EAD6C4` 按 `AppPromptDialog` 先例以 arbitrary 值落在页面内，不入全局 Token | PASS | [fixtures/index.ts](../../../src/app/fixtures/index.ts) | T005 #2 |
| D-054 | 卡博士 APP 首页与诗得丽专栏拆分：摹客页面树中「首页」(`cufRJUfA8i`) 与「诗得丽专栏」(`mRzKbV3B_`) 为并列顶级页；`/` 仅承载 APP 首页，首页「诗得丽品牌专栏」进入 `/dearseed?overlay=reminder`，专栏返回 `/`。活动、精选、新人弹层与领取态归属 `/dearseed`。本决策覆盖 route-table 旧 D2 与 D-006 中“根首页承载专栏”的旧解释 | PASS | [01-entry-and-home.md](../../prototype/01-entry-and-home.md)、[routes.ts](../../../src/app/router/routes.ts) | T005 #2 #12 #13 #15 #23 #25 |
| D-055 | #30 用 WebView 边界页 + 唤起弹窗两态承载：`?state=no-app` 渲染显式「应用商店 H5」承接边界占位，`?state=has-app` 渲染「打开 APP / 取消」弹窗；不伪造任何应用商店视觉（负向断言 `/App Store\|安装\|下载卡博士/` 计数为 0）（用户 2026-08-24 定案，沿用 D-031） | PASS | [T007-partner-invite.md](T007-partner-invite.md) | T007 #30 |
| D-056 | 分享失败态（`poster-failed`/`link-failed`）只能由 URL `?state=` 复现；页面内真实操作恒定成功，不做关键词判定、不做随机失败、不做次数计数（用户 2026-08-24 定案；与 T013 的 D-040 口径不同的原因见记录 §3.2） | PASS | [T007-partner-invite.md](T007-partner-invite.md)、[buddyShare.ts](../../../src/app/adapters/buddyShare.ts) | T007 #34 #35 |
| D-057 | T007 历史稿继承边界：可继承 = 无（T06/T07 的二维码卡版式、用户胶囊、搭子数量与默契值二次设计一律不继承）；只继承摹客真值与已注册的 Com Design/品牌 Token | PASS | [T007-partner-invite.md](T007-partner-invite.md) | T007 #27 #28 #29 |
| D-058 | #27/#28 是同一业务模型的三个夹具档位（`?state=empty/list/multi`），共用列表区/功能介绍区/两个邀请入口，仅空态换插画与引导文案；`multi` 档沿用原型的 4 行「小美」占位，不引入历史 T07 稿的 4 人 mock 与默契值数值（沿用 D-033/D-047） | PASS | [T007-partner-invite.md](T007-partner-invite.md) | T007 #27 #28 |
| D-059 | 不提供任何默契值入口：说明卡内「默契升级」仅作原型文案保留，不做数值、进度条与跳转；`card-brand.css` 相关 Token 仅预留命名不落地视觉；证据脚本以负向断言防回归 | PASS | [T007-partner-invite.md](T007-partner-invite.md)、[capture-t007.mjs](../../../scripts/capture-t007.mjs) | T007 #27 #28（#31 排除） |
| D-060 | 保存海报/复制链接/发送邀请统一走分享适配层 `src/app/adapters/buddyShare.ts`，页面不直接调用 `navigator.clipboard`、`a[download]` 或任何端能力；固定 `SHARE_LATENCY = 600` / `SEARCH_LATENCY = 500`，不用随机 | PASS | [buddyShare.ts](../../../src/app/adapters/buddyShare.ts) | T007 #32 #33 #34 #35 |
| D-061 | 手机号搜索为确定性号码映射（`BUDDY_SEARCH_OUTCOMES`，未登记号码统一落「可邀请」）；重复邀请由 `invitedPhones` 记忆，同号二次搜索必得「已邀请」且不再暴露「发送邀请」按钮 | PASS | [T007-partner-invite.md](T007-partner-invite.md)、[fixtures/index.ts](../../../src/app/fixtures/index.ts) | T007 #32 #33 |
| D-062 | 搭子绑定关系由模块级共享状态 `src/app/state/buddies.ts` 提供（订阅广播、不持久化，刷新回夹具初始态），使「#36 接受邀请 → 返回 #28 看到已绑定」是真实数据流；新增 id 用递增 `buddy-accepted-N`，不用随机（沿用 D-013/D-044） | PASS | [state/buddies.ts](../../../src/app/state/buddies.ts) | T007 #36 #28 |
| D-063 | #36 用诗得丽专栏首页背景层 + 邀请弹窗承载（`titleBar: 'plain'`），不做二级返回栏；弹窗内只有原型给出的「接受邀请」+ 右上角关闭图标，不加「拒绝」；取消路径落 `?state=dismissed`（沿用 D-024/D-036） | PASS | [T007-partner-invite.md](T007-partner-invite.md)、[routes.ts](../../../src/app/router/routes.ts) | T007 #36 |
| D-064 | `/buddy/invite`（#29）不登记 `states` 故按 D-020/D-021 不渲染调试面板；`/buddy/accept` 自身也不挂面板，页面上唯一面板来自背景层 `DearseedColumn`（两个 `fixed bottom-0` 面板会完全重叠） | PASS | [T007-partner-invite.md](T007-partner-invite.md) | T007 #29 #36 |
| D-065 | 搭子未决业务规则集中在夹具 `BUDDY_RULE_STATUS`（`confirmed`/`blocker`/`note`），页面只读开关与说明，不自行补写判定逻辑（沿用 D-017/D-037/D-049） | PASS | [fixtures/index.ts](../../../src/app/fixtures/index.ts) | T007 #27 #28 #30 #32 #34 #35 |
| D-066 | `12.jpg`/`25.jpg` 在 `assets-inventory.md` §2.6 的旧用途登记与摹客真值不符，按真值更正为头像位；两图为摹客自带图库占位照片（人物照/绿蛙照），与昵称「小美」不匹配属原型自带占位，保留不替换、也不自行生成头像 | PASS | [assets-inventory.md](../../design/assets-inventory.md) §2.6 §2.14、[extract-mockplus-assets.mjs](../../../scripts/extract-mockplus-assets.mjs) | T007 #28 #29 #32 #33 #36 |
| D-067 | 诗得丽专栏视觉基准重做：用户明确否决“白卡组件拼装”版本；保留摹客产品事实与既有物料，视觉改为完整 375×210 品牌 Banner、黑金会员资产卡、品牌橙立体服务入口、大幅深色福利活动卡和双列精选商品卡。稳定容器圆角注册为 `--radius-feature-card`，会员/活动/按钮继续消费既有语义 Token，不新增未确认业务入口 | PASS | [DearseedColumn.tsx](../../../src/pages/DearseedColumn.tsx)、[375×812 首屏](../../design/evidence/dearseed-column-375x812.png)、[精选区](../../design/evidence/dearseed-column-selection-375x812.png) | T005 #2 #23 |
| D-068 | 打卡页视觉基准重做：保留原型确认的单月月历、已签到/今日/补签/未到四态、连续奖励与精选商品；视觉改为自绘暖金泡泡 Hero、品牌橙今日态、金色已签到态、奖励里程碑卡与商品图双列卡。3D 泡泡素材复用现有品牌资产，背景由 `--gradient-checkin-hero` Token 绘制；未确认的月份切换、补签消耗与广告规则只在 `?debug=1` 展示，不污染用户界面 | PASS | [Checkin.tsx](../../../src/pages/Checkin.tsx)、[375×812 月历](../../design/evidence/checkin-calendar-375x812.png)、[精选区](../../design/evidence/checkin-selection-375x812.png) | T006 #4 #8 #21 #22 |
| D-069 | 底部导航「泡泡」一级 Tab 改为 `/points`（泡泡值明细），不再指向 `/checkin`；打卡页保留为专栏、会员中心及泡泡福利入口可达的二级业务页。本决策按用户 2026-08-24 明确纠正，覆盖 D-009 中「泡泡→`/checkin`」的旧映射及 D-030 对 `/points`“无 TabBar”的旧前提 | PASS | [routes.ts](../../../src/app/router/routes.ts)、[Points.tsx](../../../src/pages/Points.tsx) | 全局；T006 #5 #21 |
| D-069 | 打卡页主插画替换为专属“泡泡签到礼盒”：透明琥珀泡泡、无品牌洗护瓶、日历勾选牌、泡沫与金色水花组成单一 3D 主体；不含文字、Logo 与新增业务符号。由 ImageGen 生成透明 PNG 后缩放并转换为 480×533 透明 WebP，Hero 与每日打卡弹窗共用；旧 `checkin-bubble-3d` 也已转换为 WebP 保留 | PASS | [checkin-ritual-hero-v2.webp](../../../src/assets/brand/bubble/checkin-ritual-hero-v2.webp)、[Checkin.tsx](../../../src/pages/Checkin.tsx) | T006 #4 #21 |
| D-070 | 打卡详情精修以用户提供的暖白橙金参考图作为视觉气质参考，仅吸收泡泡装饰、数据强调、轻盈卡片和福利层级；产品结构与交互继续以当前摹客事实为准，保留整月月历、四种日期状态、补签、连续奖励、精选兑换与现有弹窗，不引入参考图的泡泡余额、7 日签到、每日任务或快捷入口 | PASS | [Checkin.tsx](../../../src/pages/Checkin.tsx)、[375×812 月历](../../design/evidence/checkin-calendar-375x812.png)、[精选区](../../design/evidence/checkin-selection-375x812.png) | T006 #4 #8 #21 #22 |
| D-071 | 用户后续明确要求打卡界面体现「任务」，因此新增「是日任务」区；当前只呈现既有且可验证的「每日打卡」一项，奖励复用泡泡流水已登记的 +100🫧，页面当前签到态对应进度 1/1 与「已完成」。不自行增加观看、邀请、兑换等任务，也不补领取、刷新或任务周期规则。本决策覆盖 D-070 中“不引入每日任务”的旧边界 | PASS | [fixtures/index.ts](../../../src/app/fixtures/index.ts)、[Checkin.tsx](../../../src/pages/Checkin.tsx)、[375×812 任务区](../../design/evidence/checkin-task-375x812.png) | T006 #21 |
| D-072 | 根路由 `/` 语义按需求 §2.1 改为「诗得丽品牌专栏」首页：标题、`titleBarTitle` 与 Tab 语义统一为该名称，金刚区（淋浴/洗烘/饮水/吹风）整块删除，搜索栏、头像与既有 Banner 保留。**本决策覆盖 D-054 与 route-table 旧 D2 中「`/` 仅承载卡博士 APP 首页」的口径**；独立路由 `/dearseed`（#2/#23 及其弹层与领取态）与 `/dearseed?overlay=reminder` 的既有实现全部保留不动，T005 历史验收结论不回改。需求原文「诗得力」按用户确认为笔误，一律作「诗得丽」 | PASS | [routes.ts](../../../src/app/router/routes.ts)、[Home.tsx](../../../src/pages/Home.tsx)、[t021-01-home-first-screen.png](../evidence/screenshots/t021-01-home-first-screen.png) | T021 |
| D-073 | 打卡业务内容按需求 §2.3「完整迁入、不重复页面外壳」抽取为共享组件 `CheckinBoard`（今日签到状态 / 当月签到日历 / 是日任务 / 为你精选四段），由 `/` 与 `/checkin` 共同消费；页面标题、返回栏与底部导航不随内容迁入，避免两套外壳。`CheckinBoard` 各段自管 `mx-4`，故宿主必须使用 `inset={false}` 的 `PageContainer`。`/checkin` 作为二级页保留不动（返回栏 = 1、底部 Tab = 0），其内部业务规则未改，B-018/B-019/B-020/B-021 仍未决 | PASS | [CheckinBoard.tsx](../../../src/components/mobile/CheckinBoard.tsx)、[Home.tsx](../../../src/pages/Home.tsx)、[Checkin.tsx](../../../src/pages/Checkin.tsx) | T021 T006 #4 #8 #21 #22 |
| D-074 | 新人体验券随机 1/2 张的**验收状态一律由夹具与 URL 参数复现**，随机数只决定无参数访问时的默认落点，不作为验收状态来源（沿用 D-020/D-021 的确定性夹具铁律）：`NEWCOMER_COUPON_VARIANTS` 给出 `coupon-1`（1 张）与 `coupon-2`（2 张）两组固定券面，`?state=coupon-1|coupon-2` 精确复现；`Math.random()` 仅在未带 `?state=` 时选初始 variant，且该值在组件生命周期内不再变化。券种池、概率与库存为 B-032，不自行补写 | PASS | [fixtures/index.ts](../../../src/app/fixtures/index.ts)、[Home.tsx](../../../src/pages/Home.tsx)、[NewcomerCouponDialog.tsx](../../../src/components/mobile/NewcomerCouponDialog.tsx) | T021 |
| D-075 | 新人体验券弹窗按需求 §3.2 实现两条互斥出口：点「确定」先切到领取成功层（`?overlay=coupon-success`）呈现反馈，再由「查看体验券」跳 **`/exchange`**（用户于 2026-08-27 确认目标页为洗护体验券专区）；点关闭不领取、停留 `/` 且 `overlay` 清空。本阶段仅 UI 演示，不做服务端领取、库存扣减与账户写入 | PASS | [NewcomerCouponDialog.tsx](../../../src/components/mobile/NewcomerCouponDialog.tsx)、[t021-04-coupon-success.png](../evidence/screenshots/t021-04-coupon-success.png) | T021 |
| D-076 | 打卡内容迁入首页后，补签这一主要操作需在首页自持反馈，因此把补打卡成功弹窗抽为 `CheckinMakeupSuccessOverlay`，由 `/` 与 `/checkin` 共用，首页以 `?overlay=make-up-success` 复现，节点沿用 `/checkin` 的 #22、不新增节点。T021 为需求变更新增内容、摹客原型无对应 artboard，故该卡 `nodes: []`，新人券两态与两个弹层的 `node` 记 0 占位，第 4 节 60 节点核算口径不变 | PASS | [CheckinMakeupSuccessOverlay.tsx](../../../src/components/mobile/CheckinMakeupSuccessOverlay.tsx)、[routes.ts](../../../src/app/router/routes.ts) | T021 #22 |
| D-077 | **用户 2026-08-27 定案「默认全是新用户」**：本阶段不做真实识别与持久化，不带参数进入 `/` 即自动弹出新人体验券。因 `useOverlay()` 完全由 URL `?overlay=` 驱动、无内部 state，若把「默认弹出」写成 `overlay === null → 弹`，关闭时 `close()` 删参会立刻重新命中条件形成死循环；故默认弹出由独立的 `autoNewcomer` state 承担，挂载时惰性求值一次（`newcomer !== 'off' && !overlay`），关闭与确定时置 `false`。取证脚本断言「关闭自动弹窗 → 弹窗 = 0 且 `pathname` 仍为 `/`」以锁死该行为 | PASS | [Home.tsx](../../../src/pages/Home.tsx)、[useFixture.ts](../../../src/app/fixtures/useFixture.ts)、[t021-05-home-auto-newcomer.png](../evidence/screenshots/t021-05-home-auto-newcomer.png) | T021 |
| D-078 | 首页默认弹窗改变了 `/` 的初始形态，会遮挡一切首页点击型断言，因此引入取证专用抑制参数 **`?newcomer=off`**：它只让脚本确定性地拿到首页无遮挡形态，不改变产品行为，既不是 fixture 状态也不是弹层，故 **不进 `states` / `overlays`**；`RouteMeta` 亦不为其新增字段（现有字段集无「取证参数」语义位，新增属过度设计），改为在 `routes.ts` 的 `/` 条目就近块注释 + `owner` 文案登记，并在 route-table 留档。所有触碰 `/` 的取证/回归脚本统一改用 `/?newcomer=off`；`console-check-t004.mjs` 例外地同时保留 `/` 与 `/?newcomer=off`，因为弹窗态本身也必须无 console error | PASS | [routes.ts](../../../src/app/router/routes.ts)、[route-table.md](../route-table.md)、[capture-t021.mjs](../../../scripts/capture-t021.mjs)、[console-check-t004.mjs](../../../scripts/console-check-t004.mjs) | T021 全局 |
| D-079 | **用户 2026-08-27 定案「1 张 / 2 张体验券领取概率 1:1」**：页面层按 50/50 抽取初始 variant，且该值惰性求值一次、同次访问内不变（沿用 D-074，随机仍不作为验收状态来源）。**「公益板块暂不实现跳转」**：该板块渲染为 `div` 静态承载，不给 `button` 语义、不带入口文案与 `ChevronRight`，原先指向 `/checkin` 的占位链接一并移除；`COLUMN_HOME_SECTIONS` 中 `cause` 的 `action`/`to` 均为 `null`，「卡博士品牌故事」保留跳 `/brand-culture`。取证脚本断言公益板块与品牌故事区内可点击入口有且仅有「卡博士品牌故事」 | PASS | [fixtures/index.ts](../../../src/app/fixtures/index.ts)、[Home.tsx](../../../src/pages/Home.tsx)、[capture-t021.mjs](../../../scripts/capture-t021.mjs) | T021 |
| D-080 | 金刚区删除（D-072）带来一处连带脚本失效：`capture-t005.mjs` 原先点击首页「诗得丽品牌专栏」卡片进入 `/dearseed?overlay=reminder`，而该卡片正是金刚区的一部分（已由 `git show HEAD:src/pages/Home.tsx` 核实旧版存在），故这不是弹窗遮挡、加 `?newcomer=off` 无效。改为直连 `/dearseed?overlay=reminder`，该脚本只继续验证专栏侧提示层与关闭出口；首页与专栏的新入口关系由 `capture-t021.mjs` 覆盖。**T005 历史验收结论不回改** | PASS | [capture-t005.mjs](../../../scripts/capture-t005.mjs)、[T005-entry-home-onboarding.md](T005-entry-home-onboarding.md) | T021 T005 #2 |
| D-081 | 首页「公益板块」和「极地种子品牌故事」均为可点击入口，分别进入 `/cause` 与 `/brand-culture`；两个详情页使用共享空富文本承载组件，当前不请求接口、不填充假内容，未来由统一数据层提供富文本。两个路由沿用 App 壳层标题栏，返回各自来源页；`/cause` 为新增空节点，`/brand-culture` 保留原路径和来源入口 | Implemented | [Home.tsx](../../../src/pages/Home.tsx)、[RichTextPlaceholder.tsx](../../../src/pages/RichTextPlaceholder.tsx)、[routes.ts](../../../src/app/router/routes.ts) | T021 |

| D-083 | **2026-10-12 用户确认后台兑换码合同**：兑换码至少 10 位，不自动去空格/大写、不限定字符类型或 H5 最大长度；输入不足 10 位禁用提交；真实 API `/api/cardredemptioncodes/redeem`；成功返回卡包券凭证；本地卡包 source=60，第三方 MyCoupons 独立读取。覆盖历史 D-004/D-008/D-017 中与兑换码格式及提交门槛相冲突的规则，原型历史保留不篡改 | Implementation in PR #195 / API validation pending | [card-code-redeem-contract.md](../../engineering/card-code-redeem-contract.md) | T009 #68 #69 |
| D-082 | **2026-09-29 Maintainer 定案商城主入口**：`/mall` 使用 `MallWebView` 在现有 H5 壳层内 iframe 承载商城，覆盖 D-031 对 `/mall` 主入口的占位口径，商品详情/购物车边界继续保留；当时的 `http://www.3-wins.cn/` 为历史联调地址，入口 URL 由 D-084 管理。真实 App WebView 的 iframe policy 与鉴权仍需联调证据 | Implemented / URL superseded by D-084 | [T008-mall-exchange.md](T008-mall-exchange.md)、[MallWebView.tsx](../../../src/pages/MallWebView.tsx) | T008 #17 |
| D-084 | **2026-10-21 商城 iframe 入口调整**：`kbs_shop` 使用 `https://kbs-shop.3cgroup.cn/`，`kbs_shop2` 仍使用 `https://kbs-shop2.3cgroup.cn/h5`。依据已有探测记录，`kbs_shop` 的 `/h5` 返回 404、根路径返回 200；可达性不代表页面内容或 SSO 已验收，仍需商城方和 App WebView 联调确认 | Implemented / validation pending | [T008-mall-exchange.md](T008-mall-exchange.md)、[MALL_SHOPS](../../../src/services/sso/mallSso.ts) | T008 #17 |

## 2. 待确认/阻塞项（施工前必须决策）

| 编号 | 阻塞项 | 风险 | 历史稿 | 关联节点 | 关联卡 |
| --- | --- | --- | --- | --- | --- |
| B-002 | 泡泡值明细历史配色改造（原型紫 → 暖橙/暖金）与 mock 数据是否沿用 | 高 | T02 | #5 | T006 |
| B-003 | 今日澡运结果规则：签运数量、文案、是否可重抽、结果持久性；当前大吉/中吉/小吉 + 随机重抽需隔离 | 高 | T03 | #41 | T006 |
| B-004 | 搭子数量上限、列表排序规则与解绑/移除搭子的入口和二次确认（原型 #27/#28 只画列表与两个邀请入口；整页结构与数量口径已由 D-057/D-058 关闭） | 中 | T07-empty/list | #27 #28 | T007 |
| B-005 | 端能力落地口径：相册保存权限、剪贴板写入、APP 唤起（URL Scheme / Universal Link）与应用商店包信息；正式搭子头像素材（现用摹客自带图库占位照）。视觉可继承部分已由 D-055/D-056/D-057/D-060 关闭 | 中 | T06 | #29 #30 #34 #35 | T007 |
| B-006 | #31 搭子默契值本体设计（数值口径、升级规则、页面结构）——「先不做」，归 T014；严禁从 T14 历史稿反推需求。T007 侧已由 D-059 落成负向硬约束 | 最高 | T14 | #31 | T014 |
| B-013 | 智能客服「热门问题」条目清单与问答库内容（原型 §9 只提到入口，未给条目；历史稿 T09 自创 4 问已作废，故快捷入口暂不展示） | 中 | T09 | #58 | T013 |
| B-018 | 打卡页底部「为你精选」商品清单与价格（原型 §6 有该模块，reference 无视觉稿） | 中 | — | #21 | T006 |
| B-019 | 打卡日历月份切换：可切换范围、越界表现（原型只画当前活动周期单月） | 中 | — | #21 | T006 |
| B-020 | 补签规则：消耗、次数上限与「不可补签」判定（原型只确认漏签显示补签 + 补打卡成功） | 高 | — | #21 #22 | T006 |
| B-021 | #22 补打卡成功弹窗内的广告位与关闭倒计时（原型画有广告 30s，来源与规则未定） | 中 | — | #22 | T006 |
| B-022 | 会员等级数量、命名与本季限定卡面清单（原型 §2 未给出，现 LV.1–LV.4 + 四款卡面沿用历史稿） | 高 | T02/T03 | #6 #26 | T006 |
| B-023 | 各等级权益、升级门槛与「未解锁 / 最高级」判定（原型未画，故等级页暂不展示权益与进度） | 高 | — | #26 | T006 |
| B-024 | 泡泡值排序方向：原型 §1/§2 只写「泡泡值」维度，未标注升序/降序；现取「由低到高」 | 中 | — | #38 | T008 |
| B-025 | 洗护兑换 SKU 清单、所需泡泡值、兑换量与售罄判定（原型 §1 只逐字给出一张商品卡） | 高 | T11 | #18 #37 #38 | T008 |
| B-026 | 兑换结算规则：泡泡值扣减时机、失败回滚与卡包写入（服务端规则，当前不做持久化扣减） | 高 | — | #39 #40 | T008/T009 |
| B-027 | 地址编辑页形态与省市区县-乡镇行政区划数据源（原型 §12 有编辑入口、§13 未给数据源；现复用 #60 表单回填，候选项取自夹具，见 D-043） | 中 | — | #55 #60 | T010 |
| B-028 | 「粘贴识别收件信息」的解析规则、失败提示与剪贴板权限降级（原型 §13 只画按钮；现只保留入口与能力提示，见 D-046） | 中 | — | #60 | T010 |
| B-029 | 订单状态全集与流转：待付款、已取消、退款完成等状态及迁移条件（原型 §14 只给四 Tab 与少量配送状态；夹具不自行补全，见 D-047） | 高 | — | #56 #72 | T010 |
| B-030 | 运费计算、优惠抵扣与泡泡值抵扣规则（原型 §15 只列商品总价/运费/实付款；现实付款只做算术求和，见 D-048） | 高 | — | #72 | T010 |
| B-031 | 新人体验券弹窗的**跨会话频次**与「已领取后再次进入首页」的服务端口径（用户 2026-08-27 已定案「默认全是新用户」，见 D-077：本阶段不做真实识别与持久化，进入 `/` 即弹、关闭后同次会话内不复现；剩余未决部分需等接口阶段确认） | 中 | — | — | T021 |
| B-032 | 新人体验券的**券种池、库存与单人发放上限**（用户 2026-08-27 已定案 1 张 / 2 张概率 1:1，见 D-079；剩余券池与库存未给出，故只沉淀 `coupon-1`/`coupon-2` 两组确定性夹具，验收一律用 `?state=` 复现，不做服务端发券） | 中 | — | — | T021 |
| B-033 | 「公益板块」的**实际内容与数据来源**（需求 §2.2 只给名称与顺序，`docs/prototype` 全库无「公益」命中；详情页已按 D-081 建为可达空富文本承载页，未来数据来源与服务契约待接口阶段确认；不自造公益数据、项目列表与捐赠进度） | 中 | — | — | T021 |

### 2.1 已关闭阻塞项

| 编号 | 阻塞项 | 关闭方式 | 关闭记录 |
| --- | --- | --- | --- |
| B-001 | 品牌文化视觉方向（深绿深色长页 + 浮动 CTA 是否保留） | **用户定案（2026-08-24）**：#16 只铺摹客原型长图、不加浮动 CTA，T13 深绿深色稿与右下浮动按钮均不继承；实现按 `D1gOOzGEq` 真值（全页 0 button、单张长图铺满 artboard），返回栏沿用 MobileLayout 统一提供（D-051） | [T005-entry-home-onboarding.md](T005-entry-home-onboarding.md) |
| B-009 | 兑换码长度/字符集/错误态/成功态（原型 8 位、11 位 vs 历史 12 位） | **历史** D-008/D-017 曾按 reference 取 12；**2026-10-12 D-083 新合同覆盖**：至少 10 位，原样提交，不限制字符集/前端最大长度；此处仅保留决策演变 | [T009-wallet-redemption.md](T009-wallet-redemption.md) |
| B-007 | H5 商城承载方式（本地高保真 / WebView / 外链占位） | 2026-08-22 的三路由边界定案 D-031 仍保留历史；**2026-09-29 Maintainer 以 D-082 覆盖 `/mall` 主入口**，改为 iframe 承载商城；2026-10-21 D-084 将 `kbs_shop` 入口调整为根路径，页面内容与 SSO 仍待验收；商品详情/购物车仍保留边界 | [T008-mall-exchange.md](T008-mall-exchange.md) §3.1 / §7 |
| B-008 | 洗护兑换专区主视觉与搜索/排序；T11 深绿 KV 不自动生效 | **用户定案（2026-08-22）**：兑换专区在本仓库本地实现（搜索/三维度排序/商品卡/兑换确认/余额不足/售罄/成功存入卡包）；禁止照搬历史 T11 深绿金 KV 与私有配色，只消费已注册语义 Token（D-032、D-033） | [T008-mall-exchange.md](T008-mall-exchange.md) §7 |
| B-010 | 通知 Tab 结构：原型「全部/未读」两类 vs 历史 4 Tab | D-010：按 reference 通知标准页采用 4 Tab | [T012-notifications.md](T012-notifications.md) |
| B-011 | 消息详情：是否自动已读、CTA 类型、分类 Tab | D-011：按 `:id` 渲染真实单条正文、进入即已读、CTA 仅活动类 | [T012-notifications.md](T012-notifications.md) |
| B-015 | 分享关系口径：好友关系来源、是否需对方接受、次数/时效限制、分享后原持有人卡包变化 | **用户定案（2026-08-22）**：按原型做「搭子列表」夹具，单选对象 → 下一步 → 分享成功；不做对方接受、次数限制、时效限制和持久化，分享后原卡包状态暂不改变 | [T009-wallet-redemption.md](T009-wallet-redemption.md) §7 |
| B-016 | 卡包是否需要「全部」Tab 与右上角「使用记录」入口（`prototype/04` §8 有、reference 标准页无） | **用户定案（2026-08-22）**：卡包以 `reference/卡包.html` 为准，只保留「可用 / 已使用 / 已过期」三个 Tab，不加「全部」和「使用记录」，与 D-014 一致 | [T009-wallet-redemption.md](T009-wallet-redemption.md) §7 |
| B-017 | #66 原型商品卡「洗发试用装」「已发货」语义：是否触发实物发货、卡券与商品是否同一实体 | **用户定案（2026-08-22）**：`洗发试用装 / 已发货 / 单次使用` 仅作为原型展示夹具，「已发货」不代表分享操作触发真实发货，不实现物流规则 | [T009-wallet-redemption.md](T009-wallet-redemption.md) §7 |
| B-012 | 品牌福利官服务项：原型 3 类 vs 历史 4 服务卡 | **用户定案（2026-08-22）**：福利官按摹客的人工客服 / 活动咨询 / 福利抽奖 3 类，纠正历史稿 4 项（D-038） | [T013-customer-service.md](T013-customer-service.md) |
| B-014 | 人工客服排队：只保留排队中/已接入两态，队列递减等 mock 不得引入 | **用户定案（2026-08-22）**：#70 只做排队中 / 已接入两个确定状态，不做人数递减、倒计时或虚假队列；历史消息保留且不改写说话人（D-041、D-042） | [T013-customer-service.md](T013-customer-service.md) |
| B-013（部分） | 智能客服聊天视觉与关键词识别行为 | **用户定案（2026-08-22）**：智能客服只做欢迎 / 对话 / 发送失败重试 / 企微客服入口，发送成败走关键词确定性映射（D-039、D-040）。**残余项**：热门问题条目清单与问答库内容仍缺依据，见 §2 的 B-013 | [T013-customer-service.md](T013-customer-service.md) |
| B-004（部分） | 搭子（无/有）整页结构、搭子数量与默契值口径、底部按钮 | **用户定案（2026-08-24）**：#27/#28 为同一业务模型的 `empty/list/multi` 三档夹具，共用列表区/功能介绍区/两个邀请入口；`multi` 档沿用原型 4 行「小美」占位，历史 T07 稿的 4 人 mock 与默契值数值一律不继承（D-057、D-058）。**残余项**：数量上限、排序与解绑规则仍缺依据，见 §2 的 B-004 与夹具 `BUDDY_RULE_STATUS.buddyCount` | [T007-partner-invite.md](T007-partner-invite.md) |
| B-005（部分） | 邀请搭子二维码卡、用户胶囊、按钮与 IP 视觉可继承部分 | **用户定案（2026-08-24）**：#29 只按摹客真值还原（二维码区 + 话术胶囊 + 截图提示 + 保存/复制双入口），T06 历史二次设计不继承；#30 用 WebView 边界页 + 唤起弹窗两态、不伪造应用商店视觉；分享失败态只由 `?state=` 复现，端能力统一收在适配层（D-055、D-056、D-057、D-060）。**残余项**：相册/剪贴板/APP 唤起等端能力口径与正式头像素材，见 §2 的 B-005 与 `BUDDY_RULE_STATUS.shareCapability`/`inviteeLanding` | [T007-partner-invite.md](T007-partner-invite.md) |
| B-006（T007 侧） | 搭子默契值「先不做」：严禁从 T14 历史稿反推需求 | **用户定案（2026-08-24）**：T007 不提供任何默契值入口——不做数值、进度条与跳转，说明卡内「默契升级」仅保留原型字面文案，`card-brand.css` 相关 Token 仅预留命名；证据脚本以「默契值文案 = 0 / 历史数值 = 0」负向断言防回归（D-059）。**#31 本体设计仍归 T014**，见 §2 的 B-006 | [T007-partner-invite.md](T007-partner-invite.md) |

## 3. 范围关闭结论（T014）

12 个非本轮实施节点的结论见 [evidence-matrix.md](../evidence-matrix.md) §4.2；任何节点重新纳入实施必须有用户确认记录。

## 4. 维护规则

- 新增/解决决策时更新本索引并反向链接到 `evidence-matrix.md` 与对应任务卡。
- 用户确认的结论优先级最高，确认后需回写原型说明或代码。
- 未决决策不得被「视觉优化」「顺手补全」等名义静默带过。

# 决策记录｜T008 洗护兑换与商城链路

> 决策日期：2026-08-22
> 决策卡：[T008-mall-exchange.md](../tasks/T008-mall-exchange.md)
> 决策类型：UI / Flow / Integration
> 决策范围：Mockplus 节点 #17、#18、#37、#38、#39、#40、#48、#49
> 决策人：智能体按 `AGENTS.md` §11 证据阶梯裁定；B-007 / B-008 由用户当轮指令定案关闭，未新增产品规则
> 状态：Accepted（B-007 / B-008 已关闭；新增 B-024 / B-025 / B-026 未决，见 §8）
> 2026-09-29 更新：Maintainer 明确定案 `/mall` 主入口改为在现有 H5 壳层内 iframe 承载 `http://www.3-wins.cn/`，由 D-082 覆盖 D-031 对 `/mall` 主入口的旧边界占位口径；商品详情/购物车边界未随本次改动扩展。
> 2026-10-21 更新：PR #253 将 `kbs_shop` 的 iframe 入口从 `/h5` 改为站点根路径 `/`。依据现有联调记录 `/h5` 返回 404、根路径返回 200；这仅说明入口探测结果，不代表商城页面内容或 SSO 已完成验收。`kbs_shop2` 仍使用 `/h5`。具体记录见 D-084。

## 1. 决策目的

T008 原状态是 `Draft / Blocked`，两个阻塞项挡在施工前：

- `B-007` H5 商城承载方式（本地高保真 / WebView 边界 / 外链占位）未定；
- `B-008` 洗护兑换专区主视觉与搜索/排序未定，历史 T11 稿自带深绿金 KV 与私有配色，不自动生效。

用户当轮指令直接给出了这两项的口径（「H5 商城、商品详情、购物车继续使用明确的 WebView 边界」「本地实现洗护兑换专区……」「禁止照搬历史稿的深绿金 KV 和私有配色」），因此本记录先落账这两项的关闭，再固定实现口径，并把施工中暴露的三条服务端规则显式挂为未决，避免把夹具当产品规则。

## 2. 决策结论

| 编号 | 决策 | 依据 | 关联节点 |
| --- | --- | --- | --- |
| D-031 | **H5 商城三节点（#17/#48/#49）统一走 WebView 边界页**：由 `routes.ts` 的 `boundary: 'webview'` 声明，`WebViewBoundary.tsx` 渲染浏览器外壳占位 + 加载/已加载/失败三态（`?state=`），不在本仓库做原生还原、不接真实 H5 | 用户当轮指令「H5 商城、商品详情、购物车继续使用明确的 WebView 边界」，**关闭 B-007** | #17 #48 #49 |
| D-032 | **洗护兑换专区（#18/#37/#38/#39/#40）为本地原生页**，视觉只消费已注册的 `exchange-*` / `bubble-*` / `coupon-*` 语义 Token；不引入历史 T11 的深绿金 KV，也不新建任何页面私有配色 | 用户当轮指令「本地实现洗护兑换专区……禁止照搬历史稿的深绿金 KV 和私有配色」，**关闭 B-008**；`AGENTS.md` §3 要求优先使用已有 Token | #18 #37 #38 #39 #40 |
| D-033 | **#18/#37/#38 建模为同一列表的三种排序状态**，不是三个页面：一条路由 `/exchange` + `?state=sort-exchange` / `sort-points`，「综合」为默认态（清空 `state`）。搜索与排序正交，切换排序不清空关键词 | `docs/prototype/04-mall-card-order.md` §2 明确「排序状态，不是独立业务模块」；URL 为唯一事实源（D-020） | #18 #37 #38 |
| D-034 | **搜索检索范围为「商品名 + 商品说明」**（夹具 `exchangeSearch`），商品卡只渲染名称/泡泡值/兑换量，商品说明只出现在 #39 弹窗内 | 原型 §1 商品卡逐字只有三项字段，§3 弹窗才有「商品说明」一行；扩大卡面字段会偏离原型 | #18 #39 |
| D-035 | **#39 兑换确认为弹层而非页面**：`?overlay=redeem&product=<id>`，弹窗内呈现商品/数量/说明/消耗泡泡值/当前余额；余额不足与售罄时主按钮 `disabled` 且按钮文案换为「泡泡值不足」/「已售罄」，同时在列表卡上以 Tag / 蒙层同步标记 | T008 卡实施要求「兑换确认显示商品、消耗、余额和不足/不可兑换状态」；不可兑换必须在列表与弹窗双处可见，才不是静态文案 | #39 #18 |
| D-036 | **#40 存入卡包沿用兑换专区作为背景层** + `PromptOverlay` 成功提示，双 CTA：「查看我的卡包」→ `/card`、「关闭」→ `/exchange`；提交中态为固定 700ms，不引入随机 | 原型 §4 成功态是覆盖在专区之上的提示层；固定时长保证截图可复现（与 T009 提交中态同款处理） | #40 |
| D-037 | 兑换未决业务规则集中在夹具 `EXCHANGE_RULE_STATUS`（`confirmed` / `blocker` / `note`），页面与组件不得硬编码，也不得把夹具当成已确认规则 | T009 D-017 已确立该模式；本轮三条规则（排序方向 / SKU 清单 / 结算写入）均未确认 | #18 #37 #38 #39 #40 |
| D-082 | **/mall 主入口改为商城 iframe 承载**：`router/index.tsx` 对 `/mall` 使用 `MallWebView`，在现有手机壳层与底部导航内嵌商城。2026-09-29 Maintainer 当时指定的 `http://www.3-wins.cn/` 是历史联调地址，2026-10-21 起入口配置由 D-084 管理。D-031 对 `/mall` 主入口的占位口径由本决策覆盖，`/mall/goods/:id`、`/mall/cart` 仍沿用既有边界页，除非另有定案。 | Maintainer 2026-09-29 当轮明确要求；当前实现 `MallWebView.tsx` | #17 |
| D-084 | **`kbs_shop` 当前 iframe 入口使用站点根路径** `https://kbs-shop.3cgroup.cn/`；`kbs_shop2` 仍使用 `https://kbs-shop2.3cgroup.cn/h5`。本次调整依据已有探测记录：`kbs-shop` 的 `/h5` 返回 404、根路径返回 200。此证据只确认 HTTP 可达性，不确认根路径实际呈现商城或 SSO 成功；需商城部署方确认页面内容，并完成浏览器及 App WebView 联调。 | PR #253 的入口调整及 2026-10-20 联调探测记录；运行时配置 `MALL_SHOPS` | #17 |

## 3. 决策细节

### 3.1 商城承载（D-031 → D-082）

- D-031 是 2026-08-22 的历史事实：三条商城路由最初统一由 `WebViewBoundary` 承载占位。
- 2026-09-29 D-082 覆盖其中 **`/mall` 主入口**：`router/index.tsx` 直接渲染 `MallWebView`，在手机壳层与底部导航内承载商城；当时使用的 `http://www.3-wins.cn/` 已是历史联调地址，不再作为当前入口。
- 2026-10-21 D-084 更新 `MallWebView` 的目标配置：`kbs_shop` 使用 `https://kbs-shop.3cgroup.cn/`，`kbs_shop2` 使用 `https://kbs-shop2.3cgroup.cn/h5`。这是基于可达性探测的运行时入口调整，不把 HTTP 200 等同于页面内容正确或 SSO 可用；商城页面内容和真实 WebView/SSO 仍待验收。
- `/mall/goods/:id`、`/mall/cart` 当前仍按 `routes.ts` 的 `boundary: 'webview'` 落到 `WebViewBoundary`，本次没有擅自把两个子路由改成真实商城 URL。
- 当前商城入口统一由 `MALL_SHOPS` 配置。cleartext / mixed-content、X-Frame-Options / CSP frame-ancestors、鉴权透传均属于 App WebView 联调证据，不因浏览器 preview 构建成功而宣称已通过。
- D-021 的业务 `DebugPanel` 规则不变：仍仅由 `?debug=1` 显式开启。

### 3.2 兑换专区视觉与排序（D-032、D-033）

三种排序在夹具里是三个确定性顺序，实测已验证互不相同且「综合」可回归：

| 维度 | URL | 顺序 |
| --- | --- | --- |
| 综合（默认） | `/exchange` | e1 / e2 / e3 / e4 / e5 |
| 兑换量排行 | `/exchange?state=sort-exchange` | e1 / e2 / e3 / e5 / e4 |
| 泡泡值排行 | `/exchange?state=sort-points` | e1 / e2 / e4 / e3 / e5 |

- 泡泡值方向取「由低到高」，属未定稿推断，已挂 `B-024`，不得当成产品规则。
- 视觉侧只用已注册语义 Token；历史 T11 的深绿金 KV 未被引入，也未新增私有 CSS 变量或页面私有色值。

### 3.3 兑换确认与不可兑换态（D-035）

- `BUBBLE_BALANCE = 1280`（🫧）。e5「现金减免体验券」需 1500 > 1280，构成**余额不足**；e4「洗发试用装」`stock` 为售罄，构成**售罄**。两态都是夹具数据推导出来的，不是写死的文案。
- 弹窗按 §3 逐项渲染：商品名 / `x1` / 商品说明 / 所需泡泡值 / 「泡泡值余额 1,280 🫧」/ 主按钮。
- 列表卡：售罄用蒙层 + 「已售罄」，余额不足用 `Tag variant="warning"` 「泡泡值不足」。

## 4. 实现映射

| 关注点 | 文件 |
| --- | --- |
| T008 区段路由、状态/浮层与 `boundary: 'webview'` | [routes.ts](../../../src/app/router/routes.ts) |
| 商品/余额/排序/搜索/未决规则夹具 | [fixtures/index.ts](../../../src/app/fixtures/index.ts) |
| 洗护兑换专区与兑换确认（#18 #37 #38 #39） | [Exchange.tsx](../../../src/pages/Exchange.tsx) |
| 存入卡包成功态（#40） | [ExchangeResult.tsx](../../../src/pages/ExchangeResult.tsx) |
| H5 商城主入口（#17，D-082） | [MallWebView.tsx](../../../src/pages/MallWebView.tsx) |
| 商品详情 / 购物车边界（#48 #49，D-031 保留部分） | [WebViewBoundary.tsx](../../../src/pages/WebViewBoundary.tsx) |
| 页面注册与 `boundary` 分派 | [router/index.tsx](../../../src/app/router/index.tsx) |
| 证据脚本 | [capture-t008.mjs](../../../scripts/capture-t008.mjs) |

## 5. 状态与夹具矩阵

| 节点 | 可达 URL |
| --- | --- |
| #18 洗护兑换专区（默认＝综合） | `/exchange` |
| #37 兑换量排行 | `/exchange?state=sort-exchange` |
| #38 泡泡值排行 | `/exchange?state=sort-points` |
| #39 兑换确认（可兑换） | `/exchange?overlay=redeem&product=e1` |
| #39 兑换确认（余额不足） | `/exchange?overlay=redeem&product=e5` |
| #39 兑换确认（售罄） | `/exchange?overlay=redeem&product=e4` |
| #40 存入卡包成功 | `/exchange/result?product=e1` |
| #17 卡博士商城（商城 iframe，D-082 / D-084；目标 URL 见 `MALL_SHOPS`） | `/mall` |
| #48 商品详情（WebView 边界） | `/mall/goods/1001` |
| #49 购物车（WebView 边界） | `/mall/cart` |

上表每条都可在 **`?debug=1`** 下由页面右下角「调试」胶囊直接切换（D-020、D-021）：`/exchange?debug=1` 提供 3 个状态胶囊（含「默认」）+ 2 个弹层胶囊（含「关闭」），`/mall?debug=1` 按 `routes.ts` 登记项渲染。不带 `debug=1` 时面板完全不渲染。

## 6. 工程证据

- `npm run typecheck`（`tsc --noEmit`）退出码 0。
- `npm run build` 通过：CSS 48.71 kB（gzip 10.02 kB）/ JS 371.34 kB（gzip 110.81 kB），1639 modules。构建耗时随缓存冷热波动，不作为验收指标。
- 截图采集：`scripts/capture-t008.mjs`（375×812），20 张产物见 `docs/workbench/evidence/screenshots/t008-*.png`，其中 4 张为调试面板展开态（`t008-debug-panel-*`，均在 `?debug=1` 下采集）。
- 控制台：**无 error；存在既有 Router warning**（32 条 React Router v7 future flag），属项目全局既有提示、非本轮引入，脚本用 `isKnownNoise` 单列计数。
- 运行时断言（脚本输出，全部通过）：
  - #18 余额条「泡泡值余额 1,280🫧」；商品 5 件；首卡含「200🫧 / 兑换量 / 2000+」；排序维度 3 个。
  - #37 / #38 顺序与 #18 均不同（见 §3.2 表），点「综合」后顺序完全回归默认。
  - 搜索「洗发」命中 4 件（`DearSeed 洗发水样包 / 洗护体验样包 / 核心洗发水体验券 / 洗发试用装`），其中「洗护体验样包」靠商品说明命中（卡面不渲染说明，故断言按夹具语义校验命中集合，D-034）；搜索「不存在的商品」渲染空态「没有找到相关商品」；「清空搜索」恢复 5 件。
  - #39 可兑换弹窗提交按钮 `disabled=false`；e5 弹窗提交 `disabled=true` 且按钮文案「泡泡值不足」；e4 弹窗提交 `disabled=true` 且文案「已售罄」；列表卡同时可见「已售罄」与「泡泡值不足」标记。
  - #40 成功文案「兑换成功，卡券已经存入你的卡包啦～ DearSeed 洗发水样包 x1」；「查看我的卡包」→ `/card`；「关闭」→ `/exchange`。
  - #17/#48/#49 边界页含「WebView 边界」标识与伪 URL，`/mall/cart` 文案为「WebView 边界页：商城 H5 由宿主承载，本仓库只保留边界与状态占位。」
  - 调试面板门控：`/exchange` 无 `debug=1` 时 `[data-debug-panel]` count=0；`/exchange?debug=1` 面板可展开；点「兑换量排行」→ `/exchange?debug=1&state=sort-exchange`（`debug=1` 保留）且选中 Tab 同步为「兑换量」；点「商品兑换弹窗」后弹层可见；`/mall?debug=1` 面板同样渲染。
- 附带修正（两处不属本卡新功能但阻塞交付，已最小化处理并在此落账）：
  1. `src/pages/WelfareOfficer.tsx` 存在 5 条 TypeScript 错误（`TS2304 Cannot find name 'qrGrid'` + 4 条 `TS7006` 隐式 any），来源是该文件已改为 import `WecomQrPlaceholder`、却仍残留抽取前的内联二维码块，引用了组件文件内的模块私有常量 `qrGrid`。经 `git status` / `git log` 确认为本卡之前既有问题。因其阻断 `typecheck` / `build` 门禁，按等价标记替换为 `<WecomQrPlaceholder className="mt-4" />`，未改动视觉。
  2. `src/pages/WebViewBoundary.tsx` 自带常显状态胶囊，违反 D-021。已删除并改挂 `DebugPanel`；同时更新过期文案。

## 7. 已关闭阻塞项

| 编号 | 定案内容 |
| --- | --- |
| `B-007` | **历史定案（2026-08-22）**：三条商城路由最初统一使用 WebView 边界页（D-031）。**2026-09-29 Maintainer 新定案 D-082 已覆盖 `/mall` 主入口**，改为 iframe 承载商城；2026-10-21 D-084 将 `kbs_shop` 入口调整为 `https://kbs-shop.3cgroup.cn/`（探测到 `/h5` 为 404、根路径为 200，页面内容与 SSO 仍待验收），`kbs_shop2` 仍为 `/h5`；商品详情/购物车仍保留原边界。 |
| `B-008` | **用户定案（2026-08-22）**：洗护兑换专区在本仓库本地实现（搜索、综合/兑换量/泡泡值排序、商品卡、兑换确认、余额不足、售罄、成功存入卡包）；禁止照搬历史 T11 稿的深绿金 KV 和私有配色，视觉只消费已注册语义 Token。对应 D-032、D-033。 |

## 8. 未决与风险

以下三项本轮**新增为显式阻塞项**，已收敛在夹具 `EXCHANGE_RULE_STATUS`（D-037），接真实服务前不得当成产品规则：

| 编号 | 未决内容 |
| --- | --- |
| `B-024` | 泡泡值排序方向：原型 §1/§2 只写「泡泡值」维度，未标注升序或降序。当前取「由低到高」（低门槛商品优先曝光），待产品确认。 |
| `B-025` | SKU 清单、所需泡泡值、兑换量与售罄判定：原型 §1 只逐字给出一张商品卡，完整目录未确认。当前 5 件商品用项目内既有文案凑成确定性夹具。 |
| `B-026` | 兑换结算：泡泡值扣减时机、失败回滚与卡包写入均为服务端规则。本页不做持久化扣减，兑换成功后卡包列表不随之变化（与 T009 D-015 空态设定一致）。 |

其他风险：

- 商品缩略图目前复用 `dearseed-kit` 物料，真实商品图未提供；一旦拿到正式素材需重新评估卡面比例。
- `/mall` 当前按 `VITE_MALL_TARGET` 选择 `MALL_SHOPS` 中的商城地址：`kbs_shop` 为 `https://kbs-shop.3cgroup.cn/`，`kbs_shop2` 为 `https://kbs-shop2.3cgroup.cn/h5`。D-084 的根路径变更基于可达性探测，商城页面内容是否正确、SSO、目标站 iframe 策略及 App WebView 仍需联调验证。商品详情/购物车仍是边界占位。
- #40 成功态未与 T009 卡包夹具联动（受 B-026 约束），若后续产品要求兑换即写入卡包，需要新决策而非按缺陷修复。

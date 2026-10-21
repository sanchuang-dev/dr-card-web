# H002｜正式 H5 / Native reference 路由边界证据

## 实施结果

H002 将“正式 H5 / Native reference / 当前 deferred”的边界从文档约定升级为机器可读路由 scope。

核心实现：`src/app/router/routeScope.ts`。

### 归属规则

- `formal-h5`：正式 H5 产品路由。
- `native-reference`：Native 同事参考页面，保留可访问性，但不属于正式 H5 施工/验收面。
- `active`：当前 H5 工程施工面。
- `deferred`：保留产品路由，但当前工程轮次不施工。

Native reference 采用 canonical route 精确清单，不依赖 `/legacy` 字符串匹配；因此 `/device/*`、`/vending/*` 以及不含 `legacy` 的历史签到链路 `/signin`、`/signin/detail` 也归入 Native reference。

当前登记 45 条 Native reference canonical route。

商城当前按用户要求暂缓施工，三条路由 `/mall`、`/mall/goods/:id`、`/mall/cart` 保持 `formal-h5` ownership，但 `engineeringScope=deferred`，不改变现有产品导航。

## Review 修正

PR #6 合并后，Codex Review 指出 `/signin` 与 `/signin/detail` 未被列入 Native reference，导致未来 `ACTIVE_FORMAL_H5_ROUTES` 会错误包含这两条历史页面。

复核 `src/app/router/index.tsx` 后确认：

- `/signin` → `src/pages/legacy/SignInPage`
- `/signin/detail` → `src/pages/legacy/PointsPage`

因此该 review 有效。本次 H002 修正将两条 canonical path 补入 `NATIVE_REFERENCE_ROUTE_PATHS`，不改页面实现、不改入口行为。

## 实际消费点

- `BottomNav.tsx`：主导航从 `FORMAL_H5_TAB_ROUTES` 生成；历史 reference 导航独立保留。
- `MobileLayout.tsx`：主 Tab 显示使用 `isFormalH5TabPath()`。
- `DebugPanel.tsx`：只对 `active formal-h5` 路由开放。
- 后续 route-wide CI / E2E / 工程治理统一可消费 `ACTIVE_FORMAL_H5_ROUTES`。

## 未扩大施工范围

本卡没有：

- 删除或重构 Native reference 页面；
- 修改商城内部实现；
- 改变现有 Tab 信息架构；
- 处理 H003 的 formal-H5 → legacy runtime 依赖；
- 重写历史 `verify-t015.mjs`。

## 自动化证据

原实现 PR：#6 `refactor: establish H002 route ownership boundary`

原 GitHub Actions Build run：`35033599628`

结果：

- Static hygiene: PASS
- Typecheck: PASS
- Development server smoke: PASS
- Development build: PASS
- Production build: PASS
- Cloudflare SPA fallback asset: PASS
- Production preview smoke: PASS

scope registry 会在运行时代码初始化时校验显式归类的 canonical path 是否真实存在于 `ROUTES`；本次 review 修正 PR 继续走同一套 CI，并接受 Codex / OpenCode review。

## 当前结论

H002 在 review 修正完成后继续保持 `Agent Review`。是否标记为 `Accepted` 仍由用户确认。

## 后续范围更新（2026-10-21）

H002 实施时 `/mall`、`/mall/goods/:id`、`/mall/cart` 均为 deferred。后续 `/mall` 主入口由 D-082/D-084 启用为 iframe + SSO 容器，并在 `routeScope.ts` 中转为 active formal-H5；商品详情与购物车继续 deferred。以上记录保留 H002 当时的历史状态，不代表当前路由 scope。

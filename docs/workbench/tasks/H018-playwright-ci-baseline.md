# H018｜Playwright / CI 正式 H5 基线

**Status:** Accepted  
**Phase:** Test  
**Depends on:** H002, H004, H013

## 目标

把 CI 从 UI 阶段的 60 节点历史验收脚本迁到当前正式 H5 的 smoke / 关键业务 E2E，避免旧验收事实绑架新工程。

## 已知问题

现有 `verify-t015.mjs` 仍硬编码历史 `/membership` 为“WebView 边界”，已与当前路由事实漂移。

## 范围

- 将 `verify-t015` 明确降级为历史证据，不再作为长期产品事实源。
- 从 formal-H5 路由归属生成/维护当前 smoke 范围，排除 legacy/Native reference 与当前 deferred 的商城子路由。
- 建立少量高价值业务 E2E，而不是逐页面像素验收。
- test branch gate 保留 build、无 Mock 泄漏、浏览器回归等真正工程门槛。

## 不做

- 不逐个修复旧 capture/verify 脚本使其继续“全绿”。
- 不把 CI PASS 等同 App WebView/业务 Accepted。

## 验收

- CI 不再因过期 UI 节点文案决定正式 H5 是否可晋级。
- formal-H5 关键路由 smoke、console error、坏图/明显横向溢出等基础回归可自动发现。
- legacy/Native reference 与 deferred 商城子路由不会成为业务 gate。

## 证据

### 基线落地

- PR：#25 `H018: establish formal H5 Playwright CI baseline`，已合入 `dev`。
- merge commit：`d4b273895d96fcc5067006b9f9b961da4e02f004`。
- 原始实现 head：`09d0819ac3e4edbe7a375350d7199382db35ba8f`。
- GitHub Actions Build #388：success；保留 H017 4 files / 13 tests、H007–H015 retained verify、dev/preview/test/prod 构建与 smoke 链路，并新增 formal-H5 Playwright regression。
- formal-H5 Playwright：38 tests passed；这是 H018 基线建立时的历史范围，按当时的 `ACTIVE_FORMAL_H5_ROUTES` 生成，Native reference 与当时 deferred 的商城路由不进入业务 gate。
- 新 gate 覆盖浏览器 runtime error、可见坏图、明显横向溢出，并含 `会员中心 → 通知 → 浏览器返回` 代表性导航链路。
- `test` branch gate 已改为 production-like `test + api` bundle 上的 Playwright gate；H008/H015 未解阻部分仍未伪造成真实 API / Native Bridge 验收。
- 历史 `verify-t015` 保留为 `verify:legacy:t015` 证据入口，不再决定正式 H5 晋级。

### 验收前加固

- PR：#28 `H018: close acceptance gaps in Playwright gate`，已合入 `dev`。
- fix head：`07a46cb0a1b9653bc563f818aa6e791c4ac1f413`；merge commit：`bd047d367aa1a644f7c13fc5213d1cafc66318f7`。
- Playwright 视口与仓库主要移动端视觉基准对齐为 `375 × 812`，避免 390px 宽度掩盖 375px 下的横向溢出。
- 删除固定 `100ms` 睡眠；route health 改为 active route 可见、字体就绪、可见图片在 5 秒有界窗口内完成 load/error settle 后再检查。
- 坏图最终判定保留 `complete && naturalWidth === 0`，避免仍在加载的图片被误报为坏图；同时不再依赖全局 `networkidle`。
- 删除已失效的 `PLAYWRIGHT_EXPECT_APP_ENV` / `PLAYWRIGHT_EXPECT_DATA_MODE` workflow 变量；`test-gate` 仍通过 `/build-meta.json` 与 CI build identity 验证 `test + api`。
- `docs/testing/ci-gates.md` 已与真实 preview server / `PLAYWRIGHT_BASE_URL` / readiness 流程一致。
- GitHub Actions Build #400：success；最终 fix head 上 formal-H5 browser regression、test/prod build、Mock 泄漏检查、SPA fallback 与 prod preview smoke 全部通过。
- OpenCode Review #150：success，最终结论 `No material findings`；确认前序 broken-image、`networkidle`、viewport、dead env 与文档一致性问题均已解决。
- 合入 `dev` 后 GitHub Actions Build #401：success；说明验收加固并非仅在 PR 分支成立，`dev` 落地后的完整 CI 仍保持全绿。

### 真实 test 晋级门禁

- PR：#29 `chore: verify dev → test gate after H018`，仅用于真实触发 `dev → test` 条件，不合并。
- GitHub Actions Build #406 的 `Test branch gate`：success；不再是 `dev` 普通 Build 中的 skipped 状态。
- `VITE_APP_ENV=test`、`VITE_DATA_MODE=api` 环境策略通过；test bundle 身份验证通过；bundle 中无 `mockServiceWorker.js`。
- production-like Playwright test gate：4/4 passed，覆盖 build identity、`/`、`/profile`、`/settings`。
- AI Review 最终通过；独立人工 review 无 blocker。

H018 已由用户明确验收为 `Accepted`。

### 路由范围后续更新（2026-10-21）

- 后续 D-082/D-084 将 `/mall` 主入口启用为 iframe + SSO 容器，并从 deferred 调整为 active formal-H5；当前 route smoke 会覆盖该入口。
- `/mall/goods/:id` 与 `/mall/cart` 仍为 deferred，不进入 active formal-H5 smoke。
- PR #254 在 formal-H5 E2E 中 stub 商城第三方 iframe 响应，避免 CI 依赖外部商城站点；这只稳定浏览器自动化，不验证商城内容、SSO 或 App WebView。

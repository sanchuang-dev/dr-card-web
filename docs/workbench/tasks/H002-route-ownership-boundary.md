# H002｜正式 H5 / Native reference 路由边界

**Status:** Accepted  
**Phase:** Hygiene  
**Depends on:** H001

## 目标

让路由层在代码上表达页面归属，使正式 H5 与 Native reference 不再只靠路径命名和文档约定区分。

## 范围

- 为路由元数据建立明确的 ownership / scope 语义。
- 正式 H5 的导航、测试枚举、调试与后续工程能力只消费 formal-H5 范围。
- 将 `/legacy-home*`、`/legacy-service*`、`/legacy-profile*` 及按归属属于 Native reference 的 `/device/*`、`/vending/*`、`/signin*` 从 H5 施工/验收枚举中排除。
- 保留历史 reference 路由可查看性，不删除旧页面。

## 不做

- 不重构 Native reference 页面内部实现。
- 不处理商城内部实现。
- 不改变产品信息架构。
- 不提前处理 H003 的 formal-H5 → legacy runtime 依赖。
- 不在本卡重写历史 `verify-t015.mjs`；正式 CI/E2E 枚举由 H018 收口。

## 实现结果

- 新增 `src/app/router/routeScope.ts`，按 canonical route path 精确维护 scope，不使用 `/legacy` 前缀猜测。
- ownership 明确为 `formal-h5` / `native-reference`；engineering scope 明确为 `active` / `deferred`。
- 当前登记 45 条 Native reference canonical route，包括不含 `legacy` 的 `/device/*`、`/vending/*`、`/signin` 与 `/signin/detail`。
- PR #6 的 Codex Review 指出 `/signin`、`/signin/detail` 漏归类；复核 router 后确认两条路由分别直接渲染 `pages/legacy/SignInPage` 与 `pages/legacy/PointsPage`，修正已补入 Native reference。
- 实施时商城三条路由保持 formal-H5 ownership，但按当时决定标记为 `deferred`；现有商城 Tab 不因此消失。当前 `/mall` 已依据后续 D-082/D-084 转为 active，商城详情与购物车仍 deferred。
- 导出 `ACTIVE_FORMAL_H5_ROUTES`，供后续 CI / E2E / 体验治理统一枚举。
- `BottomNav` 主入口、`MobileLayout` 主 Tab 判断、`DebugPanel` 已实际消费统一 scope。
- reference 路由注册表与页面实现未删除、未重写。

## 验收

- 代码可可靠判断一个路由是否属于正式 H5，而不是只做 `/legacy` 字符串匹配。
- H5 的后续 CI / 测试 / 体验能力能复用该归属信息。
- reference 路由仍可访问，正式 H5 行为无回归。

## 证据

详见 [`../evidence/h002-route-ownership.md`](../evidence/h002-route-ownership.md)。

原 PR #6 GitHub Actions Build run `35033599628` 全绿；review 修正通过 PR #8 合并到 `dev`，merge commit `72ec303ef80e1ebca028e90734cde11b42e41a04`。

用户已确认通过，状态记为 `Accepted`。

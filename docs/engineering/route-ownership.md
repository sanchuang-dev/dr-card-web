# H5 路由归属与施工范围

本文定义 `dr-card-ui` 在正式 H5 工程阶段如何区分 **formal H5**、**Native reference** 与当前暂缓施工的业务区域。

代码事实源：`src/app/router/routeScope.ts`。

## 1. 为什么不能按 `/legacy` 字符串判断

当前仓库既有 `/legacy-home*`、`/legacy-service*`、`/legacy-profile*`，也存在不含 `legacy` 但仍属于 Native reference 的路由，例如：

- `/device/:type`
- `/device/connecting`
- `/device/success`
- `/vending/buy`
- `/vending/order`
- `/signin`
- `/signin/detail`

其中 `/signin` 与 `/signin/detail` 直接渲染 `src/pages/legacy/SignInPage` 与 `src/pages/legacy/PointsPage`，因此归属按实际页面责任判定，而不是按 URL 是否包含 `legacy` 判定。

因此“路径里有没有 `legacy`”不是产品归属规则，只能算历史命名痕迹。

H002 改为按 **路由注册表中的 canonical path** 显式维护归属 overlay；动态 URL 仍先通过 `findRouteByPathname()` 解析回 canonical route，再判断归属。

## 2. 两个独立维度

### ownership

- `formal-h5`：正式 H5 产品路由。
- `native-reference`：为 Native 同事保留的参考/历史页面；可以直接查看，但原则上不进入 H5 施工、重构与业务验收。

### engineeringScope

- `active`：当前 H5 工程施工面。
- `deferred`：路由仍存在，但当前工程轮次不施工。

这两个维度不能混用。比如商城路由仍保留在正式产品路由图中，但用户当前明确要求暂不处理，因此标记为：

```text
ownership = formal-h5
engineeringScope = deferred
```

这样不会为了“暂时不做”而错误改变产品导航或永久归属。

## 3. 当前 Native reference 范围

以代码清单为准，当前覆盖：

- `/legacy-home` 与现有后代；
- `/legacy-service` 与现有后代；
- `/legacy-profile` 与现有后代；
- `/device/*` 当前注册的三条设备参考路由；
- `/vending/*` 当前注册的两条售货机参考路由；
- `/signin` 与 `/signin/detail` 两条历史签到/积分参考路由。

当前共登记 45 条 canonical Native reference route。

这些路由仍由原 router 注册，不因 H002 被删除、重定向或改写内部实现。

## 4. 当前 deferred formal-H5 范围

`/mall` 主入口已由 D-082/D-084 正式启用为 iframe + SSO 容器，并纳入 active formal-H5 smoke；这不代表商城页面内容、SSO 或 App WebView 已验收。当前仍 deferred 的只有：

- `/mall/goods/:id`
- `/mall/cart`

以上子路由标记为 `formal-h5 + deferred`。

`deferred` 只约束当前工程施工、调试和后续自动化枚举，不改产品信息架构。

## 5. 可复用 API

`src/app/router/routeScope.ts` 提供：

- `SCOPED_ROUTES`
- `FORMAL_H5_ROUTES`
- `ACTIVE_FORMAL_H5_ROUTES`
- `NATIVE_REFERENCE_ROUTES`
- `DEFERRED_FORMAL_H5_ROUTES`
- `FORMAL_H5_TAB_ROUTES`
- `getRouteScope()` / `getRouteScopeByPathname()`
- `isFormalH5Route()`
- `isActiveFormalH5Route()`
- `isNativeReferenceRoute()`
- `isFormalH5TabPath()`

后续正式 H5 的 route-wide CI、E2E、体验治理、数据迁移等，优先从 `ACTIVE_FORMAL_H5_ROUTES` 枚举，而不是自行再写一份 legacy 排除规则。

## 6. 当前消费点

H002 已让以下能力消费统一 scope：

- 主 `BottomNav`：只从 formal-H5 Tab 生成主导航；
- `MobileLayout`：主 Tab 显示判断使用 formal-H5 Tab；
- `DebugPanel`：仅 active formal-H5 路由允许调试面板。

Native reference 的三项历史导航仍独立保留，用于参考页面查看。

## 7. 与后续任务的边界

H002 只建立路由归属事实，不顺手处理其他结构债：

- 正式 H5 仍依赖 `pages/legacy/userInfoStore`：H003；
- fixture/debug 是否进入 test/prod：H004；
- 历史 fixture 巨石拆分：H005；
- 正式 Playwright / CI 路由枚举改造：H018。

尤其不要因为已有 `ACTIVE_FORMAL_H5_ROUTES`，就在 H002 中重写历史 `verify-t015.mjs`；该脚本属于 UI 阶段证据，正式测试基线由 H018 收口。

# H5 认证边界

当前正式 H5 已确认 **Native → H5 登录凭证获取协议**，并按当前开发约定接入 OAuth 登录；token 生命周期与未登录处理仍未全部确认。

## 当前已确认事实

- 正式 H5 不再依赖 `pages/legacy/userInfoStore.ts` 等 Native reference / 历史演示状态；
- Android 登录凭证入口：`window.androidBridge.getLoginToken()`；
- iOS 登录凭证入口：`window.iosBridge.getLoginToken()`；
- 两端均无参数、同步返回 JSON string；
- 当前返回结构：`{"token":"...","salt":"..."}`；H5 兼容旧版 token-only 返回，但需要签名的接口不得把缺失 salt 当作有效凭证；
- Native 回填写明最低 App 版本目标为 2.13；
- Native 同时注明两端方法已注入，但内部实现仍需改为读取真实登录态；
- H5 统一通过 `src/services/nativeBridge.ts` 获取并验证结果，业务页面不得直接访问宿主对象。
- OAuth 开发登录：`POST {VITE_API_BASE_URL}/api/oauth/login`，请求体 `{ salt, token }`；成功响应兼容旧的 `{ userInfo, accessToken }`，以及当前后台返回的 `{ code: 0, data: { userInfo, accessToken, ... } }`；后续同源 API 请求使用 `Authorization: Bearer <accessToken>`。
- 正式 H5 根首页在 `VITE_DATA_MODE=api` 时先完成登录；仅 `accessToken` 暂存于 `sessionStorage`，`userInfo` 保留在当前文档内存。Mock 模式保留独立浏览器预览，不模拟真实登录。
- HTTP 401 或响应顶层 `code: 401` 触发一次单飞重登；原请求最多重放一次。首次打开文档时，如果初始 `/api/oauth/login` 自身返回 401，同样只允许再登录一次。若这次重登/重试登录再次返回 401，或重登成功后重放原请求仍返回 401，则判定当前用户会话已失效：H5 弹出「用户信息过期」Toast，并调用 Native `closeWebView()` 关闭当前 WebView，不再继续重登或停留在当前业务页。重登过程中的非 401 失败仍进入 `/error?reason=auth`，不循环。
- 2026-09-28 后端统一响应协议：成功码 `code: 0`（兼容原生；`GET /api/user/detail` 此前 2026-09-24 实测的 `code: 200` 已由后端统一改回 0）；失败为非 0 code + `message` 字段（无 `msg` / `status`）。正式接口共用 `parseApiEnvelope` 解析。

旧 iOS `webkit.messageHandlers.getAuthorizationInfo.postMessage({}) → window.onToken(token)` 仅作为历史联调 / Bridge Lab Raw Probe 证据保留，不再是 production auth contract。

## 2026-10-16｜/api 请求签名（来自后台源码静态核对）

本地 API `docs/api-signature.md`、`src/middleware/auth.ts`、`src/app/api/config.ts` 已确认：所有 `/api/**` HTTP 请求经 `AppAuthMiddleware` 校验。H5 除已有 Bearer 会话外，还需携带 `token`、`timesp`（Asia/Shanghai 的 `yyyy-MM-dd HH:mm:ss`）及 `secstr`（`md5(salt + 排序拼接参数 + salt)`）；服务端对收到的 Query + Body 合并（Body 优先），排除 `secstr`/`callback` 后计算签名，时间窗口默认 ±5 分钟。

实现统一在 `src/services/http/apiSignature.ts`；Axios 通过 `httpClient` 拦截器补签，`/api/oauth/login` 的 `skipAuth` **仅跳过 Bearer，不能跳过 secstr**；客服 SSE 和真人转接的独立 `fetch` 调同一签名函数，保留不可重放语义；Socket.IO 握手仍使用既有 `auth.token`，不属于 `/api/**` HTTP 中间件。

**两种 Token 不可混淆**：Native `getLoginToken()` 返回的上游 `token/salt` 用于请求签名；OAuth 返回的 `accessToken` 负责 Bearer 业务会话。Native 凭据只在文档内存保存，不新增持久化字段、不注入第三方 origin。无有效签名凭据不能静默发送无签名业务请求。

此结论基于本地后端源码和签名样例复算，以及 H5 CI；**不代表后端已部署该版本，亦不代表 Android/iOS WebView、CORS、上传 FormData 和真实用户会话已验收**。后端文档另已知「客户端自行提交 salt 即被采信」及「窗口内无 nonce 防重放」的安全限制，当前仅做协议对接；后端安全策略升级须独立评估。

## 当前仍待确认

Native Bridge 解决的是“如何从 App 拿到登录 token”，以下问题仍不能自行推断：

- 以上 Authorization 约定来自当前开发联调口径，需由后端最终确认是否同时适用于所有 API；
- 2026-09-24 本地联调（模拟器 WebView 真实登录态）实测：7002 需登录接口只接受 `token` 请求头；仅带 `Authorization: Bearer <accessToken>` 返回 401「请先登录」。Bearer 是否为最终口径仍待后端确认，[userProfile.ts](../../src/services/userProfile.ts) 暂按实测同时携带两种头；
- token 过期、刷新、登出与跨 WebView 生命周期同步；
- 未登录时 Native `getLoginToken()` 返回什么；
- token 为空 / 过期时由 Native 拉起登录，还是 H5 展示登录入口；
- 业务 401 的完整响应结构；当前只识别响应顶层 `code: 401`，HTTP 401 按标准状态处理；
- backend 403 与 Native 登录态失效如何协调。

## 与后续任务的关系

- H003：切断 legacy runtime 登录依赖；
- H007：HTTP client / error 基础；
- H008：仍需 backend base URL 与真实 API / 认证使用方式；
- H015：历史 Native boundary；
- H029：正式建立 Android / iOS 统一 `getLoginToken()` Bridge v2 contract；
- H030–H034：继续接其它 Native 能力，不改变本认证边界。

详细 Native Bridge v2 契约见 `docs/engineering/native-bridge-v2-contract.md`。

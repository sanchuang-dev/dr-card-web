# H027｜Bridge Lab 真机联调页升级

**Status:** User Review  
**Phase:** Host Integration / Debug Tooling  
**Depends on:** H025, H026

## 目标

把古老的固定按钮 JSBridge 演示页升级为基于当前 `dev` 的 Bridge Lab：

- 已注册 capability 通过当前 Capability Runtime 动态列出并调用；
- Android / iOS 宿主协议可通过隔离的 Raw Probe 临时探测；
- 不为每个新增 Native 方法继续手写一套固定按钮；
- 调试信息可观察，但敏感返回默认脱敏；
- 异步 Native callback 可按 callbackId 追踪实际入口、回调次数、中间态/终态与超时；扫码原文默认脱敏；
- Lab 只服务 dev / preview / test 联调，不进入 production 正式业务导航或 production bundle。

## 当前事实

- 当前正式 Android 已确认能力仍至少包括 `window.androidBridge.getLoginToken()`；
- H025 已建立 Capability Runtime；
- H026 已建立 Android injected-object transport 与 iOS-style messageHandler/callback transport；
- 古老 `bridge` 分支仅作为真人联调历史证据，不整分支合并，也不提升其中未确认的方法为 production capability。

## 范围

### Registered capabilities

- 从当前 production capability registry 生成 Lab 能力清单；
- 已确认的 capability 通过同一 production runtime/facade 链调用；
- 浏览器或宿主缺失时明确显示 unsupported，不 fake success。

### Async callback trace

- 记录 Native 方法实际调用、object/method、callbackId、候选 callback endpoints 与安全的参数摘要；
- 记录每次 Native callback 实际抵达的 endpoint、callbackId 是否命中 pending、回调次数、payload 类型及 capability 阶段判定；
- 记录 callback timeout；未匹配 callbackId 也要可见，并继续保持既有 fallback 行为；
- callback observer 仅在 Bridge Lab 挂载时订阅；没有 observer 时 transport 不分配诊断事件；
- 扫码 payload 保留 envelope 状态字段用于诊断，但默认遮蔽二维码正文；显式 reveal 仍受现有调试动作控制。

### Android Raw Probe

支持动态输入：

- object name；
- method name；
- 无参数 / string / 单个 JSON value / JSON array 多参数；
- 每次调用重新解析 injected object；
- 保留 receiver binding；
- 明确展示 success / error / duration。

### iOS Raw Probe

支持动态输入：

- message handler；
- payload；
- 仅 postMessage 或等待 H5 global callback；
- timeout；
- callback 冲突保护；
- single-flight timeout 后 fail-closed；
- 仅在操作者确认宿主恢复后显式 reset callback channel。

### 敏感信息

- token / authorization / cookie / password / secret / session / credential 等字段默认脱敏；
- 已登记为敏感的 capability 结果整体默认遮蔽；
- raw 值只能通过显式用户动作查看。

## 不做

- 不把 Raw Probe 暴露给正式业务页面；
- 不因为 probe 成功就自动注册 production capability；
- 不补造 Native 方法、DTO、payload schema 或版本契约；
- 不把古老 `bridge` 分支当产品代码基线；
- 不重新设计正式产品页面。

## 实现结果

- 新增独立 Bridge Lab 页面与 `/__debug/bridge-lab` 调试路由；
- capability list 由 registry 驱动，并通过统一 debug invocation seam 进入正式 Capability Runtime；
- Android Raw Probe 支持 receiver-safe 动态调用；
- iOS Raw Probe 复用 H026 transport，并按 callback name 持久化 single-flight channel 状态；
- timeout 后 channel 保持 fail-closed，显式 reset 才恢复；
- Lab 日志记录开始、耗时、结果与错误，并默认脱敏；
- Registered async callback 增加被动诊断事件：Native 调用、callbackId、实际回调入口、回调计数、阶段判定、未匹配回调与超时；扫码正文默认遮蔽；
- production 使用编译期 route gate + lazy import，CI 额外扫描 dist，避免 Bridge Lab / Raw Probe 落入 production bundle；
- 新增 Vitest / React component / Playwright browser smoke 覆盖。

## 验收标准

- [x] Bridge Lab 基于当前 `dev` 独立实现，不整分支合并古老 `bridge`；
- [x] capability list 不再依赖“一排固定平台按钮”；
- [x] Android Raw Probe 支持 object / method / args，并明确成功或失败；
- [x] iOS Raw Probe 支持 handler / payload / callback / timeout；
- [x] 正式 `getLoginToken` 调试走 production capability runtime；
- [x] 敏感返回默认脱敏，raw 查看需要显式动作；
- [x] 普通浏览器无宿主对象时明确 unsupported；
- [x] Lab 不进入 production 正式业务导航，并由 bundle gate 验证；
- [ ] Registered async callback trace 可关联 request / callbackId / 实际 endpoint / callback 次数 / intermediate-terminal / timeout；扫码正文默认脱敏；
- [ ] 当前 App WebView 对本轮 Lab 再跑一次真人 smoke：registered `getLoginToken` + 至少一次 Android Raw Probe；
- [ ] 用户验收后才标记 Accepted。

## 自动验证

要求最终 HEAD 通过：

- `npm test`
- `npm run verify:h015`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- H027 Bridge Lab Playwright browser smoke
- production bundle exclusion gate

## 证据

见 `docs/workbench/evidence/h027-bridge-lab.md`。

GitHub Issue #45 仅作为兼容跟踪记录，不是 H027 施工契约真相源；本卡完成后按用户要求关闭该 Issue。

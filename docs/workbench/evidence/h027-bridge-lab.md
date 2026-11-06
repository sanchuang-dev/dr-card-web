# H027｜Bridge Lab 真机联调页升级证据

## 1. 施工基线

H027 从已包含 H025/H026 的 `dev@748e1e919371f89a781e7c0866d44106530441cf` 独立开工。

本卡复用已经合入的 Capability Runtime 与 Transport：
- registered capability 通过 `src/services/nativeBridge.ts` 的 registry / shared runtime 调用；
- Android Raw Probe 只做调试期宿主探测，不建立第二套 production capability；
- iOS Raw Probe 复用 H026 的 single-flight callback lifecycle，而不是自己维护一套 callback Promise 表。

古老 `bridge` 分支只作为真人联调证据读取，没有整分支合并。关键已知证据仍是：
- `ddc3c64981b2a134a63924802d8a138fa698e70b`：Android 调用必须保留 injected-object receiver；
- `bb2eb4c6f85db86fba17d3ca07442923b20fa1b1`：Android bridge 需要每次调用从 `window` 重新解析，以容纳 late injection / instance replacement；
- 2026-09-21 重新收到的 Native 联调文档明确记录现有 iOS 模块：`webkit.messageHandlers.getAuthorizationInfo.postMessage({})`，由 Native 回调 `window.onToken(token)`；该具体协议可登记为 iOS capability，返回 DTO / 错误语义仍保持未知。

## 2. Registered capability runner

Bridge Lab 不再为每个正式能力维护一排固定按钮。

`getNativeBridgeCapabilityCatalog()` 从当前 production registry 生成 Lab 可见能力清单，包含：
- capability name；
- description；
- 当前 runtime support 状态；
- result 是否敏感。

`invokeRegisteredNativeCapabilityForDebug()` 仍进入与业务 facade 相同的 Capability Runtime，因此当前已确认的 Android `getLoginToken` 与 iOS `getAuthorizationInfo` 调试都不会复制一套页面直连宿主逻辑。

该 generic debug invocation 在 production runtime fail-closed。

## 3. Raw Probe

### Android

`src/bridge/bridgeLabProbe.ts` 提供隔离的 Android Raw Probe：
- 动态 object / method；
- 无参数、string、单个 JSON value、JSON array → 多参数；
- 每次 invocation 重新解析 injected object；
- `method.call(bridge, ...args)` 保留 receiver；
- 宿主不存在 / 方法不存在 / 参数非法 / Native throw 均明确失败，不 fake success。

Raw Probe 成功只表示“当前宿主上这个调用可探测”，不会自动注册 production capability。

### iOS

iOS Raw Probe 支持：
- 动态 message handler；
- empty object / string / JSON payload；
- 仅 `postMessage`，或等待临时 H5 global callback；
- timeout；
- callback name 冲突保护；
- 临时 callback 调用结束后清理。

对于没有 request-id 的 global callback 模式，H027 按 H026 single-flight 安全边界处理：
- 相同 handler/callback channel 复用同一个 transport，timeout 后的 poison 状态会跨 UI invocation 保留；
- timeout 后下一次 probe fail-closed，不会把上一请求的迟到 callback 归给新请求；
- 只有在宿主恢复，或操作者已确认旧 callback 不可能再到达后，才允许通过显式 **Reset callback channel** 恢复；
- single-flight 仍要求宿主保证每次 invocation 最多回调一次。

这里没有把任何古老 iOS handler/callback 名提升为 production capability。

## 4. 敏感结果

普通 Lab 日志默认递归遮蔽以下语义字段：
- token；
- authorization；
- cookie；
- password；
- secret；
- session；
- credential。

已登记为敏感的 capability（当前 `getLoginToken`、`getAuthorizationInfo`）会强制整体遮蔽返回值。Raw method / handler / callback 名带敏感语义时，同样默认整体遮蔽结果。

只有操作者点击“显式显示原始结果”后，当前日志项才展示 raw value；默认日志、截图路径和初始 UI 不明文暴露该值。

## 5. 运行环境隔离

Bridge Lab 不进入正式业务导航。

- dev / preview / test：可注册 `/__debug/bridge-lab`，用于本地、Cloudflare preview 和 App test WebView 联调；
- prod：router 使用 Vite production mode 的编译期分支，不静态导入 Bridge Lab；production CI 额外扫描 `dist`，确认 Bridge Lab route / Raw Probe UI 文案不存在；
- Raw Probe 与 generic debug invocation 仍保留 runtime guard 作为 defense in depth。

## 6. 自动验证范围

H027 新增：
- `src/bridge/bridgeLabProbe.test.ts`
  - Android receiver / JSON args；
  - browser host missing；
  - iOS handler + temporary callback；
  - timeout cleanup；
  - timeout 后 channel fail-closed + explicit recovery；
  - callback overwrite protection；
  - recursive sensitive-value redaction。
- `src/pages/BridgeLab.test.tsx`
  - registry-driven capability list；
  - sensitive Raw Probe result 默认脱敏 + explicit reveal；
  - browser host absence error。
- `tests/e2e/bridge-lab.spec.ts`
  - Bridge Lab route/list；
  - Android injected-object receiver + sensitive result masking/reveal；
  - iOS dynamic handler/callback + nested sensitive field masking。
- CI 增加专门的 Bridge Lab browser smoke 和 production-bundle exclusion gate。

最终验收仍以当前 HEAD 的 CI / review 结果为准，本文件不预写未执行结果。

## 7. 真实 Native 证据边界

### 已有真实证据

来自 H015/H025/H026 的历史真人 Android 联调：
- `window.androidBridge.getLoginToken()`；
- 无参数；
- 同步 return；
- receiver binding；
- late injection / instance replacement。

这些证据支持 H027 设计不能破坏上述宿主现实，但**不能替代 H027 新 Bridge Lab 页面在当前 App build 里的真机 smoke**。

### H027 当前仍待真人验证

H027 任务卡要求 Android App WebView：
1. 通过 Bridge Lab 的 registered capability runner 调用正式 `getLoginToken`；
2. 至少执行一次 Android Raw Probe。

当前自动化只能证明浏览器/stub-host 机制和构建边界。上述 H027 当前页面的真机 WebView smoke 尚无本轮证据，必须作为验收 validation gap 保留，不能用旧 H015 证据冒充。

iOS 已有文档确认的 `getAuthorizationInfo → window.onToken(token)` 协议，但当前 H027 页面仍缺本轮真实 iOS App WebView smoke；返回 DTO、失败/取消语义与最低 App 版本也尚未确认。


## 8. 2026-09-21 联调返工：按 Native 现状选择平台

本轮根据实际 Native 联调资料与已通过的历史 `bridge` 分支收敛 Bridge Lab，原则是 **H5 接住 Native 已有协议，不要求 Native 为调试页改协议**。

- 平台选择继续沿用历史联调契约的 URL query：
  - `?osType=android`
  - `?osType=iOS`
  - 未指定时为 `web`
- `osType` 决定 Lab 展示哪个平台的 Registered capabilities 与 Raw Probe；runtime 的宿主自动检测只作为 diagnostics，不覆盖联调人员显式选择。
- Android Raw Probe 只在 `osType=android` 展示，并提供历史 `bridge` 分支已使用过的可编辑预设：
  - `androidBridge.showToast(string)`
  - `androidBridge.getLoginToken()`
  - `androidBridge.submitOrder(JSON.stringify(data))`
- iOS Raw Probe 只在 `osType=iOS` 展示，并提供历史联调预设：
  - `webkit.messageHandlers.getAuthorizationInfo.postMessage({})`
  - 临时接收 `window.onToken(token)`
- Raw Probe preset 只负责回填联调参数，本身不会把任何方法升级为 production capability。`getAuthorizationInfo` 的正式登记依据是 2026-09-21 Native 联调文档明确给出的现有 iOS 模块，而不是 preset 本身。
- production capability catalog 增加已确认平台 metadata；当前 `getLoginToken` 登记 Android，`getAuthorizationInfo` 登记 iOS；`closeWebView` 尚无已确认 Native 实现，因此不归属任何平台。
- Bridge Lab 恢复旧联调页的 Native → H5 测试入口 `window.testFunc(params)`，Native 可继续通过 `evaluateJavascript` 调用；H5 记录 callback 日志并返回 `"h5 处理完成"`。
- Registered capability 的 JSON 输入区保留，Raw Probe 的 object/method/payload/callback/timeout 继续可编辑；本页保持工程师联调工具定位，不产品化协议输入。

自动验证补充覆盖 Android / iOS / web 三种 `osType`、平台互斥 Raw Probe、历史 preset 回填、Android receiver + 敏感结果脱敏、iOS callback 以及 Native → H5 `testFunc`。


## 9. 2026-09-21 联调可用性修正

根据实际预览页验证，Bridge Lab 进一步修正两点：

- `osType` 参数按大小写不敏感解析，`ios` / `iOS` / `IOS` 均进入 iOS 联调视图，`android` / `Android` 同理；不再因参数大小写掉回 `web`。
- Cloudflare feature preview 默认业务 `VITE_BRIDGE_MODE=disabled`。这不能阻断 Bridge Lab 真机联调，否则把 preview URL 放进 App WebView 后 registered capability 永远不可调用。
- 因此 production/business facade 继续遵守 `bridgeMode`；只有 `bridgeLabEnabled` 的非 prod Bridge Lab debug invocation 可以直接按当前宿主解析并调用已注册 transport。
- production 仍不注册 Bridge Lab，不能借此绕过正式运行时边界。
- capability catalog 在 Bridge Lab 中按真实宿主 transport 可用性显示 `supported`；业务 diagnostics 仍按正式 `bridgeMode` 计算，不改变业务行为。


## 10. H029：Native Bridge v2 登录协议覆盖旧 iOS auth

2026-09-21 Native 团队回填 H028 后，正式登录协议更新为统一 injected-object 方案：

- Android：`window.androidBridge.getLoginToken()`
- iOS：`window.iosBridge.getLoginToken()`
- 两端无参数，同步返回 JSON string：`{"token":"..."}`
- iOS `webkit.messageHandlers.getAuthorizationInfo.postMessage({}) → window.onToken(token)` 降级为历史联调证据 / Raw Probe preset，不再属于 production capability registry。

H027 Bridge Lab 因此保持两层：

- Registered capability：Android / iOS 均展示正式 `getLoginToken`；
- iOS Raw Probe：仍保留旧 `getAuthorizationInfo + onToken` 预设，用于旧 App build / 历史协议诊断。

该更新不删除 H026 messageHandler transport；它只改变当前 production auth protocol 的事实来源。

## 11. Async callback observability

Bridge Lab subscribes to a passive diagnostic stream emitted by the existing injected-object callback transport. The stream does not create a second callback channel and does not alter request settlement.

Each registered async invocation can be inspected through:

- Native object and method actually invoked;
- generated callbackId and callback endpoints configured for the request;
- safe argument shape summary (JSON keys plus callbackId / scanType only; arbitrary string contents are not copied into logs);
- actual callback endpoint used by Native;
- callbackId pending match / unmatched status;
- callback count and capability-specific intermediate / terminal classification;
- callback payload type and timeout.

Privacy boundary:

- scan callback envelope metadata such as numeric Native code, message and scanType remain visible for diagnosis;
- scanned QR text (including a legacy top-level string `code`) is masked in the default log view;
- explicit reveal remains a user action and exposes only the in-memory current log item;
- unknown / unmatched callbacks are fully masked because their originating capability cannot be established;
- the observer is subscribed only while Bridge Lab is mounted; with no subscribers, the transport skips diagnostic event construction;
- listener exceptions are isolated and cannot interrupt Native callback dispatch or Promise settlement.

The added automated tests cover request correlation, both Android callback aliases, callback counts and stage classification, unmatched callbacks, timeout events, component log rendering and Playwright browser smoke.

**Validation boundary:** these tests use stub Native hosts and prove the H5 diagnostic mechanism only. They do not prove that the current App build emits a callback, that the real Native callbackId matches, or that Android/iOS scan business flows work. A real App WebView scan is still required after the change reaches the test environment.

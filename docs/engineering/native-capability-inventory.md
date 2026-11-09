# H028｜正式 H5 Native 能力盘点与接口征集清单

> 状态：H028 交付文档  
> 扫描基线：`dev@ecd5f72c8c7ad1a2ba83050e5e8517c0ca215ec3`  
> 工作项：GitHub Issue #46  
> 目的：把 active formal H5 中真实存在的宿主/设备能力需求整理成 Native 团队可直接回答的接口征集表。本文只记录事实、需求与待确认项，不替 Native 发明方法名、payload 或跨平台协议。

## 1. 事实分层

本文使用四种事实等级，避免把历史调试代码或候选实现误写成正式协议：

- **已确认宿主事实**：有当前仓库可追溯的真人 Native/WebView 证据，可以作为正式边界依据。
- **当前 H5 产品需求**：active formal H5 页面已经存在的用户动作或明确占位，需要真实能力才能完成。
- **历史调试证据**：只能证明某种 transport/回调形态曾被尝试，不能升级为 production 方法名或 schema。
- **候选实现方式**：例如 Web API、JSBridge、外部 link/scheme、SDK；只有 Native/产品确认后才进入正式契约。

当前已确认并有明确宿主调用形态的鉴权能力包括：

```text
Android:
window.androidBridge.getLoginToken()

iOS:
window.webkit.messageHandlers.getAuthorizationInfo.postMessage({})
→ window.onToken(token)
```

其余条目即使使用了 H5 内部 capability 名，也**不代表 Native 端已存在同名方法**。

## 2. 扫描范围

路由归属以 `src/app/router/routeScope.ts` 为代码事实源，而不是用 URL 是否包含 `legacy` 猜测。

本次共读取路由注册表 87 条：

- active formal H5：**39 条**，全部纳入本次扫描；
- Native reference：**45 条**，排除；
- deferred formal H5：当时为 **3 条商城路由**，排除；后续 `/mall` 主入口已转为 active，商品详情与购物车仍 deferred。
- `/__debug/bridge-lab`、`/tokens` 等调试/工程路由不属于产品路由扫描面。

### 2.1 本次扫描的 39 条 active formal H5

```text
/
/card
/exchange
/profile
/dearseed
/onboarding
/onboarding/success
/claim/success
/brand-culture
/points
/points/detail
/membership
/dearseed/membership
/membership/levels
/checkin
/luck
/luck/result
/buddy
/buddy/invite
/buddy/invite/qrcode
/buddy/invite/phone
/buddy/invite/scan
/buddy/accept
/exchange/result
/redeem
/card/share
/card/verify
/card/verify/password
/card/verify/confirm
/address
/address/new
/orders
/orders/:id
/settings
/notifications
/notifications/:id
/service/welfare-officer
/service/chat
/service/chat/human
```

### 2.2 明确排除

- `/legacy-home*`、`/legacy-service*`、`/legacy-profile*`；
- 当前 `/device/*`、`/vending/*`、`/signin*` Native reference；
- `/mall`：当前为 active formal-H5 iframe + SSO 容器，但不是本次 Native capability inventory 的扫码/宿主能力征集对象；`/mall/goods/:id`、`/mall/cart` 仍 deferred；
- 健康管理、数字空间、搭子默契值等原型已明确暂缓内容；
- Bridge Lab Raw Probe：只用于探测宿主，不自动形成 production capability。

## 3. Native / 设备能力征集总表

| ID | 当前用户动作与代码依据 | 分类 | 当前实现 | 输入需求 | 输出需求 | 取消 / 失败 / timeout | 权限 / 系统 UI | Android 已知事实 | iOS 已知事实 | 需要 Native 团队确认 |
|---|---|---|---|---|---|---|---|---|---|---|
| AUTH-01 | H5 获取当前登录凭证；`src/services/nativeBridge.ts`、H015/H025/H026 evidence | **必须由 Native/JSBridge 提供** | Capability Runtime 已接 Android `getLoginToken` 与 iOS `getAuthorizationInfo` transport；返回均保持 `unknown` | Android 无参数；iOS `postMessage({})` | 当前登录/授权凭证；**DTO/schema 未确认** | 未登录、bridge 缺失、调用异常、timeout 必须可区分；iOS 当前文档未给失败/取消回调结构 | 无额外系统权限事实 | **已确认** `window.androidBridge.getLoginToken()`；同步 return；每次调用重新解析；receiver binding | **已确认** `window.webkit.messageHandlers.getAuthorizationInfo.postMessage({})`；无同步返回；Native 通过 `window.onToken(token)` 回传 | Android/iOS 返回格式与空值语义；凭证过期/未登录如何表达；iOS 失败/取消语义；最低 App 版本 |
| HOST-01 | 一级 active formal H5 左上关闭；沉浸扫码页关闭；`TitleBar.tsx`、`HostCloseButton.tsx` | **必须由 Native/JSBridge 提供** | H5 已定义语义 capability `closeWebView`，但始终 unsupported；按钮因此禁用 | 无业务参数 | 成功关闭当前 H5 WebView 容器；是否有返回值待定 | 若宿主拒绝/无法关闭，应有明确失败；通常无 timeout 长任务；不能用 `history.back()` / `window.close()` 冒充 | 无权限预期 | 未确认具体方法 | 未确认具体方法 | Android/iOS 实际关闭协议；同步/异步；是否允许宿主拦截；失败如何反馈；关闭是否携带 result 给上一 Native 页面 |
| SCAN-01 | `/card/verify` 扫二维码/条形码核销；`src/pages/ScanVerify.tsx` | **Native/JSBridge 征集项**；若 Native 决定走 Web camera，则需另确认 WebView 策略 | 当前扫描框点击后直接 `navigate('/card/verify/confirm')`，只是模拟识别 | 需要启动扫码；支持的码制/业务约束尚未确认，不在 H5 侧先定 | 至少需要扫码结果原文；是否返回码类型/识别来源待确认 | 用户取消、相机拒绝、无结果、识别失败、能力不支持、timeout/页面退出后的回调必须可区分 | 相机权限；系统权限弹窗归属需确认 | 无正式扫码协议 | 无正式扫码协议 | Native 是否已有统一扫码页/SDK；Android/iOS 方法与 callback；结果字段；取消/拒绝/失败定义；页面退出后 callback 生命周期；若改用 Web API，WebView 是否开放 camera/getUserMedia 与权限 |
| MEDIA-01 | `/settings` → 修改头像 → “拍照”；`src/pages/Settings.tsx` | **标准 Web 能力候选，需确认 WebView；必要时 Native/JSBridge** | 点击“拍照”当前直接执行 H5 `save()`，没有相机/文件结果 | 请求拍照；图片尺寸/压缩/裁剪规则当前未定义 | 可供后续头像上传/预览的图片引用或数据；具体表示由最终方案决定 | 用户取消、相机权限拒绝、拍照失败、WebView/宿主不支持 | 相机权限、系统相机 UI | 无协议 | 无协议 | 是否允许 H5 使用 file input/capture；WebView 文件 chooser/camera 是否完整；若走 Native，返回 URI/file/base64 哪种；权限由谁申请；取消如何表达 |
| MEDIA-02 | `/settings` → 修改头像 → “从相册选择”；`src/pages/Settings.tsx` | **标准 Web 能力候选，需确认 WebView；必要时 Native/JSBridge** | 点击当前同样直接 `save()`，没有真实选图 | 请求单张图片；MIME/大小/裁剪规则未确认 | 可供头像上传/预览的图片引用或数据 | 用户取消、照片权限拒绝、文件不可读、格式不支持 | 相册/照片选择器及相关权限 | 无协议 | 无协议 | Android/iOS WebView file chooser 是否可用；是否使用系统 photo picker；返回数据形态；是否需要 Native 侧裁剪/压缩；权限策略 |
| MEDIA-03 | `/buddy/invite` → “保存到本地”；`src/app/adapters/buddyShare.ts`、`BuddyInvite.tsx` | **必须有宿主可落相册的能力**（可由 Native 或被确认可用的系统能力承载） | `saveInvitePoster()` 固定延时 600ms 后恒定成功；明确没有写相册 | 要保存的海报/图片；H5 能提供何种图片表示需与 Native 协商，不预设 schema | 保存成功；如 Native 能返回最终 asset/URI 需另确认，当前产品只需要成功反馈 | 用户拒绝相册权限、取消、保存失败、数据非法、能力不支持；不能继续恒定成功 | 相册/照片写入权限及系统提示 | 无协议 | 无协议 | Native 是否提供保存图片能力；输入支持 URL/blob/base64/临时文件哪种；权限申请时机；已授权/拒绝/永久拒绝语义；失败码 |
| WEB-01 | `/buddy/invite` → “复制链接”；`src/app/adapters/buddyShare.ts` | **标准 Web API 候选**；WebView 不满足时再提供 Bridge fallback | `copyInviteLink()` 固定延时后恒定成功；明确没有调用 `navigator.clipboard` | 邀请链接文本 | 写入成功即可 | Clipboard API 拒绝、非安全上下文、无用户手势、WebView 不支持；通常不需要长 timeout | 可能受 WebView/系统剪贴板策略限制，无独立产品权限事实 | 未确认 WebView 行为 | 未确认 WebView 行为 | Android/iOS 当前 WebView 是否允许用户点击事件内 `navigator.clipboard.writeText`；若不允许，是否提供宿主复制能力及失败语义 |
| AD-01 | `/checkin` 补签看广告；`src/components/checkin/DemoAdPlayer.tsx` | **SDK / 第三方能力，owner 待确认** | 当前为静态素材 + 5 秒倒计时 Demo；倒计时结束即 `onComplete`，没有真实广告 SDK | 至少需要广告位/场景标识，但具体 placement/ad-unit 由广告 owner 定义 | 必须能区分“完整观看并获得资格”与关闭/跳过/失败；其它广告 metadata 非当前 H5 必需 | 加载失败、无填充、用户关闭、未完整观看、SDK 错误、timeout/页面退出 | 可能包含广告跟踪/隐私授权，取决于最终 SDK | 无正式能力 | 无正式能力 | 广告 SDK 在 Native 还是 H5；provider/owner；placement id；completed/closed/failed/no-fill 回调；是否允许跳过；奖励资格由谁判定；Android/iOS 差异 |
| LINK-01 | `/buddy/invite/scan` 的已安装/未安装承接；`AppPromptDialog` 的“下载链接”；`BuddyScanLanding.tsx`、`AppPromptDialog.tsx` | **外部 link / scheme / 应用商店契约** | 已安装状态只是 fixture；“打开 APP”只跳 H5 `/buddy/accept`；“下载链接”目前只显示提示，没有真实 URL | 邀请/deep-link 上下文；具体参数必须由产品/Native 定义，不在 H5 自造 | 已成功唤起 / 无法唤起 / 转应用商店；是否需要回传不确定 | 未安装、scheme 被系统拦截、用户取消、外部浏览器限制、商店不可用 | 系统打开 App/商店确认 UI 由平台决定 | package/scheme/App Link 均未确认 | bundle/scheme/Universal Link/App Store ID 均未确认 | 正式 deep link/App Link/Universal Link；Android package 与商店 URL、iOS bundle/App Store URL；是否允许检测“已安装”；无法唤起后的 fallback；邀请参数和安全校验规则 |

## 4. 各项边界说明

### 4.1 AUTH-01 登录凭证

正式 H5 已经具备 Capability Runtime，并接住 Android injected-object 与 iOS messageHandler/global-callback 两种已确认鉴权协议，因此后续**不要**再在页面散落访问宿主全局对象。

Android 当前真实事实只有：

```text
object: window.androidBridge
method: getLoginToken
args: none
return: synchronous, schema unknown
```

iOS Native 联调文档已明确给出现有模块：`window.webkit.messageHandlers.getAuthorizationInfo.postMessage({})`，原生通过 `window.onToken(token)` 回传授权 token。该方法名与 callback 可作为 AUTH-01 的正式 iOS 协议；但 token DTO、失败/取消语义和最低 App 版本仍未确认。

### 4.2 HOST-01 关闭 WebView

`closeWebView` 是 H5 内部语义 capability，不是 Native 方法名。

当前一级 active formal H5 使用 TitleBar 的 close leading action；`/card/verify` 这种沉浸页通过 `HostCloseButton` 提供相同退出意图。真实宿主协议未确认前按钮保持 unsupported 是正确行为。

Native 侧需要给的是“关闭当前承载 H5 的 WebView 容器”的真实协议，而不是浏览器 history 返回。

### 4.3 SCAN-01 扫码

当前 `ScanVerify.tsx` 的扫描框本质上是一个进入确认页的按钮，没有调用相机，也没有识别二维码/条形码。

H5 本轮不先替 Native 决定：

- 使用宿主已有扫码页；
- 使用 Native camera + scanner SDK；
- 还是 WebView 开放相机后由 H5 解码。

但在任何方案落地前，都必须明确权限、取消、失败、结果 schema 与页面退出后的 callback 生命周期。

### 4.4 MEDIA-01 / MEDIA-02 头像媒体

“拍照”和“从相册选择”是 active formal H5 的真实用户动作，但当前两项操作都会直接落到 H5 的成功保存反馈，并没有媒体输入。

如果 Native 允许标准 HTML file picker/capture 覆盖当前需求，则不需要为它们硬造 JSBridge；Native 团队仍需确认 Android/iOS WebView chooser、相机/相册权限和返回文件可读性。

若现有 App WebView 无法稳定承载，再为这两个语义能力接 Native transport。

### 4.5 MEDIA-03 保存海报与 WEB-01 剪贴板

`src/app/adapters/buddyShare.ts` 已经是分享能力唯一出口，因此未来接真实能力时页面无需自行触碰宿主全局对象。

当前两个操作都固定延时并恒定成功，这是原型/验收用 deterministic adapter，不是真实设备证据：

- 保存海报：没有写相册；
- 复制链接：没有调用 Clipboard API。

H028 只征集真实能力，不改变当前页面行为。

### 4.6 AD-01 激励广告

`DemoAdPlayer` 明确写着“演示位 · 后续接入真实 SDK”。当前 5 秒倒计时只能演示交互，不能作为“广告完整观看”的真实业务凭证。

后续正式接入必须由广告 SDK/宿主真实完成事件驱动补签资格；不能继续让 H5 计时器自行宣告 rewarded completion。

### 4.7 LINK-01 APP 唤起 / 应用商店

两个现有入口共同依赖这一外部契约：

1. `/buddy/invite/scan`：原型要求区分已安装 APP 的唤起和未安装时的应用商店承接；
2. `AppPromptDialog`：`/dearseed` 的 app-guide 与产品 APP 引导场景需要真实下载地址。

当前仓库没有正式 scheme、App Link、Universal Link、package/bundle id 或商店 URL，因此不能在 H5 里猜。

## 5. 不需要向 Native 新增接口的当前页面行为

本轮扫描也明确排除了以下“看起来像宿主能力、实际上当前不需要新增 Native 接口”的内容：

- H5 二级页返回：继续使用 React Router/history；它与“关闭 WebView”是两件事。
- 企业微信福利官 / 人工客服二维码：当前只是 H5 展示二维码，不要求 Native 打开企微。
- 通知列表、地址、订单、会员、泡泡值、搭子列表等业务数据：属于 API/service 范围，不是 JSBridge。
- 消费密码输入、昵称/生日/年级表单：纯 H5 交互。
- H5 内二维码占位图：展示二维码本身不等于扫码能力。
- Native reference 页面中出现的扫码、相册、设备等能力：不纳入本 H028 formal H5 征集范围。
- 商城 iframe + SSO 属正式 H5 集成但不属于本次 Native capability inventory 的宿主能力征集范围；本清单不据此推断或确认任何 Native 能力。

## 6. Native 团队回填模板

Native 同事可以直接按每个 ID 回填，不需要从 H5 页面反推需求：

```text
Capability ID:
Android:
  是否已有:
  真实对象/方法/SDK/Link:
  输入:
  返回/回调:
  取消语义:
  权限:
  错误/失败:
  最低 App 版本:

iOS:
  是否已有:
  真实 handler/方法/SDK/Universal Link:
  输入:
  返回/回调:
  取消语义:
  权限:
  错误/失败:
  最低 App 版本:

补充约束:
```

对于 JSBridge 类能力，Native 回填后再由 H5 把已确认协议注册进现有 Capability Runtime / Transport；对 Web API 类能力，只需确认 WebView 策略即可；对 SDK 与外链能力，按其 owner 建立独立契约，不强塞进 JSBridge。

## 7. 后续落地规则

1. **不从本文直接生成 Native 方法名。** 当前明确例外只有已确认的 Android `getLoginToken` 与 iOS `getAuthorizationInfo` / `onToken`；其余仍只是 H5 语义需求。
2. Native 一旦确认某项协议，应在对应 capability contract / evidence 中追加“已确认事实”，不要改写本次盘点时的未知状态。
3. Android 与 iOS 分开确认；一端接通不等于跨平台支持。
4. Browser stub、Bridge Lab Raw Probe、Playwright 都不能冒充真实 App WebView 证据。
5. 未确认协议继续 fail-closed；不得用 Mock success 作为 prod 兜底。
6. 新能力接入仍走 `src/services/nativeBridge.ts` / transport 层，页面不得直接访问宿主全局对象。

## 8. H028 完成判定

本次已经：

- 完整扫描 active formal H5 39 条路由；
- 以真实源码/原型边界识别 9 类宿主/设备能力需求；
- 覆盖 Issue #46 指定的关闭 WebView、扫码、拍照、相册选图、保存图片/海报、剪贴板、激励广告、登录凭证、APP 唤起/应用商店边界；
- 明确区分 Android/iOS 已确认鉴权事实、其余未确认协议、历史 debug 证据和候选实现方式；
- 明确排除 Native reference、商城 SSO 集成与无需宿主能力的 H5 行为；
- 给出可直接交给 Native 团队回填的字段模板；
- 未新增或虚构任何未知 Native 方法名、callback 名或 payload schema。

H028 到此只完成“盘点与接口征集清单”职责；真实能力实现由后续获得 Native 协议后分别建卡接入。


## 9. Native 团队回填后的协议更新

H028 征集完成后，Native 团队已回填新的双端统一约定。该回填覆盖本文早期“iOS auth 尚未统一”的状态。

### 9.1 双端 object 与序列化

- Android：`window.androidBridge`
- iOS：`window.iosBridge`
- 两端方法名 / JSON 字段统一；
- 有参方法入参为 JSON string；
- Native 回填中的返回均按同步 JSON string 定义；
- 最低 App 版本目标统一写为 2.13，但除登录外其余能力当前仍标记“是否已有：否”。

### 9.2 AUTH-01 已更新

正式目标改为：

```text
Android: window.androidBridge.getLoginToken()
iOS:     window.iosBridge.getLoginToken()
args:    none
return:  synchronous JSON string
         {"token":"..."}
```

旧 iOS `getAuthorizationInfo/onToken` 仅保留为历史联调 / Raw Probe 证据，不再是 production AUTH-01。

### 9.3 其余能力

Native 已回填 `closeWebView / scanCode / takePhoto / chooseImage / saveImageToAlbum / copyText / showRewardAd / openApp` 的双端 target contract，但当前均标记“是否已有：否”。

因此 H5 可以据此建立后续 contract 与 adapter，但在对应 Native 方法真实注入前仍必须保持 unsupported / fail-closed。后续施工拆分为 H030–H034。

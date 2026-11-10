# H037｜真实 Native 事务回调对齐

> **历史合同说明（2026-11-09）**：本文记录的是 Android `upstream/gitee/master@a8ac84694d2f69e0c1bfa10619fdc3810845a337` 的旧两阶段扫码事务证据。该证据仍保留为历史事实，但不再代表 Android `feat/1109@b595a72b28d38ef033117ebaa91ff5919a4ef763` 的当前 H5 callback 合同。新分支对非设备码一次回调并显式提供 `data.isDevice=false`；设备 11–14 的启动回调带 `consumeUse`，Native 详情页继续负责后续结算；设备 17 的回调只带 `text/scanType`，不带 `isDevice` 或 `consumeUse`。H045（[#295](https://github.com/sanchuang-dev/dr-card-web/issues/295)）据此收口 H5：只对显式 `isDevice=false` 分流，Native 设备结果不进入 H5 业务。**这不构成 iOS 已实现扫码能力的证据。**


**Status:** In Progress  
**Phase:** Host Integration / Contract Alignment  
**Depends on:** H029, H031, H033, H036

## 设计证据

本卡的设计与施工依据集中记录在：

- [H037｜真实 Native 事务回调对齐设计证据](../evidence/h037-native-bridge-transaction-alignment.md)

H037 不允许仅凭代码形态或历史 H5 contract 推断业务语义。以下关键结论必须同时满足“用户确认 + Native 实现事实 + H5 当前行为”三类证据中的适用项：

- 扫码核销是一段 Native 托管的完整设备事务，而不是普通 scanner return；
- 第一次扫码成功 callback 是中间态，设备最终 callback 才把控制权交回 H5；
- 激励广告是否满足完整观看条件由 Native 最终结果决定，H5 不重复判定；
- H5 负责 adapter / transport 收口，不反向规定 Native 内部实现。

证据文件同时列出尚未确认事项；未补证前不得自行扩展为 iOS 已实现、Native 内部策略已确定等结论。

## 背景

2026-09-29 第一波 H5 集成已合入 `dev`。当前 H5 需要继续对齐已经落地的真实 Native 行为，而不是反过来要求 Native 按 H5 旧协议改造。

本卡只负责 H5 侧协议收口，覆盖两条已经确认的宿主链路：

1. 激励广告：Native 负责广告加载、播放与“是否完整观看”的判断，H5 只消费最终结果并继续补签业务；
2. 扫码核销：H5 发起后，Native 接管扫码、设备识别与机器调货/启动；完整 Native 流程结束后回到原 H5 WebView 实例，以原 `callbackId` 通知最终成功或失败，后续交互重新由 H5 接管。

当前证据基线：

- H5：`dev@3e970a4d9751f2083e99399fc84ce6fc93035962`
- Android mirror：`upstream/gitee/master@a8ac84694d2f69e0c1bfa10619fdc3810845a337`

本卡不评价 Native 内部架构，也不承担 Native 代码修改责任。

## 已确认 Native 行为

### 1. 激励广告

Android 当前 `showRewardAd(json)` 使用异步 `callbackId` 回调，最终 envelope 为：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "scene": "h5CheckinResign",
    "adLoadState": 1,
    "finishPlayState": 1
  }
}
```

已确认语义：

- `code = 0`：完整观看条件已经满足，H5 可继续后续补签业务；
- 用户主动关闭并不天然等于失败：若 Native 已判定完整观看，仍返回成功；
- `code = 1`：未完整观看 / cancel；
- `code = 5`：普通失败；
- `code = 6`：加载超时；
- `code = 7`：无广告填充；
- `data.adLoadState` / `data.finishPlayState` 是 Native 当前回填的加载与完播状态。

H5 不重复实现 Native 广告 SDK 的“是否完整观看”判断。

### 2. 扫码核销

Android 当前 `scanCode(json)` 的真实业务链不是单纯“扫到码即结束”，而是一段 Native 托管事务：

```text
原 H5 实例
  -> scanCode(callbackId)
  -> Native 扫码
  -> Native 查询设备
  -> Native 进入设备详情 / 调货或启动流程
  -> Native 得到最终成功或失败
  -> 回到原 H5 WebView 实例
  -> 使用原 callbackId 通知 H5 最终结果
  -> H5 接回后续交互
```

当前 Android 实现中，同一 `callbackId` 会经历两阶段回调：

第一阶段，扫码成功后：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "text": "...",
    "scanType": "..."
  }
}
```

随后 Native 保留原 `callbackId`，进入设备流程。

第二阶段，设备流程结束后再次使用同一 `callbackId`：

成功：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "text": "...",
    "scanType": "..."
  }
}
```

失败：

```json
{
  "code": 5,
  "message": "...",
  "data": {}
}
```

当前两个成功 payload 没有额外阶段字段可供 H5 区分，因此 H5 必须按这条已确认事务的回调顺序理解：

- 第一次扫码成功回调是中间态，不结束 H5 调用；
- 第二次设备结果回调才是事务终态；
- 扫码取消、相机权限拒绝、扫码前失败等在未进入设备流程时可以直接终止调用。

## 当前 H5 缺口

### 激励广告

`src/services/nativeBridge/capabilities/rewardAd.ts` 当前仍要求：

```text
status = completed | closed | failed | no_fill
```

而真实 Android 已改为 `code + adLoadState + finishPlayState`。

因此真实 APK 回调会被当前 H5 判为 `payload-invalid`。

### 扫码核销

`createCallbackInjectedObjectTransport` 当前是标准的一次性 Promise 语义：

```text
收到第一条匹配 callbackId 的 callback
  -> parse
  -> resolve/reject
  -> 删除 pending
```

`scan.ts` 当前把第一条 `data.text` 直接解析成 `NativeScanCodeResult`，`ScanVerify.tsx` 随后进入 `/card/verify/confirm`。

这与已经确认的真实核销流程冲突：

- 第一条扫码成功回调只是 Native 事务中间态；
- H5 此时不应恢复业务交互，也不应提前进入“确认核销”；
- 必须等 Native 设备流程最终成功/失败后，H5 才重新接管。

现有 `/card/verify/confirm` 的“即将核销 / 确认核销”是旧流程产物；在 Native 已完成机器调货后，不得再作为一次前置确认重复执行。最终成功后的 H5 展示应进入既有核销结果/后续交互路径，具体 UI 只复用现有能力，不在本卡内重新设计页面。

## 目标

### A. 激励广告结果归一

在 H5 Bridge adapter 内把当前 Native envelope 归一为稳定业务语义。

页面层继续只消费 H5 业务结果，不直接依赖：

- `adLoadState`
- `finishPlayState`
- Native 广告 SDK 细节

目标业务语义保持：

```ts
type NativeRewardAdStatus =
  | 'completed'
  | 'closed'
  | 'failed'
  | 'no_fill'
```

其中当前 Native：

- `code = 0` -> `completed`
- `code = 1` -> `closed`
- `code = 7` -> `no_fill`
- `code = 5 | 6` -> `failed`

迁移期旧宿主如果仍返回既有 `status` 字段，可以继续兼容，但不得要求 Native 恢复旧字段。若同一结果中存在当前 numeric `code`，以 Native code 为最终事实；legacy `status` 仅在 numeric code 缺失时参与兼容解析。

### B. 扫码核销事务等待

为 `scanCode` 建立 capability-specific 的两阶段 callback 生命周期：

```text
第一次 code=0 扫码结果
  -> 记录中间态
  -> 保持 callbackId pending
  -> 不 resolve

第二次同 callbackId
  -> code=0: 事务成功
  -> 非 0: 事务失败
  -> settle
  -> 清理 pending
```

约束：

- 不把所有 callback capability 改成多阶段；
- 拍照、相册、复制、openApp、广告等既有一次性 callback 语义保持不变；
- H5 业务页面不感知 callbackId；
- H5 原实例在 Native 页面切换期间保持原上下文；
- Native 最终回调返回后才恢复 H5 后续交互；
- 超时与异常清理仍必须可控，不能遗留 pending；
- H037 沿用既有 injected callback 的 120 秒 transport timeout，并验证该既有超时会清理 Android scan pending；本卡不重定义 caller 自定义 timeout 的传递 / cancellation 语义。

### C. H5 后续交互收口

- Native 最终成功后，不再进入旧“即将核销 / 再确认一次”的前置确认路径；
- 使用现有 H5 核销完成反馈能力承接成功结果；
- Native 最终失败后由 H5 展示可恢复失败状态，并允许用户按既有交互重新发起；
- 不在本卡重新设计卡包、结果页或新的业务流程。

## 范围

允许修改：

- `src/services/nativeBridgeTransport.ts`：仅在确有必要时增加支持 capability-specific 多阶段 callback 的最小能力；
- `src/services/nativeBridge/capabilities/scan.ts`；
- `src/services/nativeBridge/capabilities/rewardAd.ts`；
- `src/services/nativeBridge/types.ts`；
- 与上述能力直接相关的 façade / test；
- `ScanVerify.tsx` 与核销结果承接的最小业务接线；
- H031 / H033 / Native Bridge 契约文档的事实同步。

## 不做

- 不修改 Android / iOS Native 代码；
- 不要求 Native 调整内部 Activity、EventBus、广告 SDK、扫码 SDK 或设备启动流程；
- 不向 Native 指定“应该使用哪个 API / SDK 方法”；
- 不处理扫码码制、`scanType` 内部识别策略等 Native 实现问题；
- 不处理 WebView origin 白名单等其它宿主治理议题；
- 不重构与本卡无关的 Bridge capability；
- 不顺手清理 legacy / Native reference 页面；
- 不凭 Android 当前实现虚构 iOS 已完成相同行为；iOS 仍以真机实现与联调证据为准。

## 关键设计约束

### 1. Native 行为是宿主事实，H5 负责适配

已经确认的 Native 运行行为进入 H5 adapter，由 H5 将平台细节归一成稳定业务语义。

不得为了保持 H5 旧 parser 简单而反向要求 Native 改协议。

### 2. 广告完成判定属于 Native

H5 只消费 Native 最终结果。

`code = 0` 已由 Native 表示完整观看条件满足，H5 不自行根据时长、关闭动作或 SDK event 重新判定。

### 3. 扫码核销是一段事务，不是普通 scanner API

`scanCode` 在当前业务里的完成条件是“Native 托管的扫码 + 设备流程结束”，不是“已经识别出二维码字符串”。

因此扫码正文是事务上下文，不是 H5 恢复控制权的完成信号。

### 4. 多阶段语义不得污染通用 transport

如果需要扩展 transport，必须以显式 capability 配置 / 专用 transport 表达，不得让其它一次性 callback capability 默认进入多阶段模式。

## 验收标准

- [ ] 当前 Android 激励广告 `code + adLoadState + finishPlayState` 回调可被 H5 正确归一；
- [ ] `code=0` 时 H5 才进入补签后续；未完整观看、失败、超时、无填充均不误发补签；
- [ ] 旧 `status` 结果在迁移期仍可兼容；
- [ ] 扫码第一阶段 `code=0 + text` 不 settle H5 Promise；
- [ ] 同一 `callbackId` 的设备最终成功回调才完成 H5 调用；
- [ ] 设备最终失败回调能回到 H5 可恢复错误状态；
- [ ] 扫码取消 / 权限拒绝 / 扫码前失败不会错误等待第二阶段；
- [ ] Native 页面切换后回到原 H5 实例，pending callback 仍能正确关联；
- [ ] 最终成功后不重复进入“即将核销 / 确认核销”旧前置确认；
- [ ] 其它 callback capability 的一次性 Promise 行为无回归；
- [ ] Bridge Lab 能复现广告与扫码两条真实 callback 序列；
- [ ] 单元测试覆盖扫码两阶段成功、第二阶段失败、首阶段取消/权限失败、超时清理；
- [ ] 单元测试覆盖广告当前 Native envelope 与旧 status 兼容；
- [ ] `npm run typecheck`、`npm run lint`、相关 Vitest / E2E 通过；
- [ ] Android 真机 smoke 通过后再把本卡升级为 Accepted；iOS 未有实证前不宣称已验收。

## 当前施工基线

- H5：`dev@3e970a4d9751f2083e99399fc84ce6fc93035962`
- Native Android mirror：`upstream/gitee/master@a8ac84694d2f69e0c1bfa10619fdc3810845a337`
- 施工分支：`feat/h037-native-bridge-transaction-alignment`

## 产出

- 本卡；
- H5 Bridge adapter / transport 的最小协议收口；
- 对应自动化回归；
- H031 / H033 / Bridge 契约事实更新；
- Android 真机联调记录。

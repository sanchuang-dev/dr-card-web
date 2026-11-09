# H037｜真实 Native 事务回调对齐设计证据

> 本文件是 H037 的设计依据，不是实现结果。  
> H037 的代码施工、测试与验收必须能回溯到这里记录的已确认事实；未在本文件确认的 Native 内部行为不得由 H5 自行推断。

## 1. 证据基线

| 类别 | 证据 | 用途 |
|---|---|---|
| 用户 / 产品确认 | 2026-09-29 当前联调确认 | 定义扫码核销与激励广告的业务责任边界 |
| Android 实现 | `sanchuang-dev/dr-card-android` `upstream/gitee/master@a8ac84694d2f69e0c1bfa10619fdc3810845a337` | 验证当前宿主实际 callback 链路与 payload |
| H5 实现 | `dangjingtao/dr-card-ui` `dev@3e970a4d9751f2083e99399fc84ce6fc93035962` | 确认当前 H5 contract / transport 与真实宿主行为的差异 |
| 历史 H5 任务 | H031、H033 及对应 evidence | 解释旧 target contract 从何而来，以及为什么需要由 H037 覆盖旧假设 |

## 2. 用户确认的业务设计

### D-H037-01｜扫码核销由 Native 托管完整设备事务

2026-09-29 用户明确补充：

- 场景是**体验券扫码核销**；
- H5 发起扫码以后，Native 不只是返回扫码字符串；
- Native 需要继续完成机器调货 / 设备启动；
- 完整 Native 流程结束后，回到**原来的 Web 端实例**；
- Native 再通知 H5 最终成功或失败；
- 从最终结果开始，后续交互重新由 H5 接管。

因此，H037 的设计基线不是：

```text
H5 -> 扫到码 -> H5 继续核销
```

而是：

```text
H5 原实例
  -> Native 扫码
  -> Native 设备流程 / 机器调货
  -> Native 最终成功或失败
  -> 回到原 H5 实例
  -> H5 接管后续交互
```

**设计含义：**

1. “扫到码”不是 H5 恢复控制权的完成信号；
2. H5 必须保留原实例中的业务上下文；
3. Native 最终结果之前，H5 不得提前执行旧的二次确认核销流程；
4. Native 最终结果之后，后续 UI / 业务仍归 H5。

### D-H037-02｜激励广告完成判定归 Native，H5 只消费结果

2026-09-29 用户提供的联调背景明确：

- Native 负责判断广告是否完整观看 / 满足时长；
- 即使用户最终主动点击关闭，只要 Native 已判定满足完整观看条件，仍应视为成功；
- `code = 0` 表示 Native 已确认广告流程满足条件；
- H5 收到最终结果后再继续补签等业务；
- Native 当前同时回填广告加载状态与完播状态。

**设计含义：**

1. H5 不重新计算广告观看时长；
2. H5 不以“是否点关闭”自行推翻 Native 最终判断；
3. Native SDK 的细粒度字段停留在 Bridge adapter，不扩散到页面业务；
4. Checkin 只消费稳定的 H5 业务语义。

### D-H037-03｜H5 负责适配，不反向规定 Native 内部实现

用户明确约束：

- H5 团队不能替 Native 修改其内部代码；
- 不因 H5 旧协议与真实宿主不一致，就要求 Native 按 H5 旧实现回退；
- 跨团队只确认“输入 / 输出 / 业务完成语义”，不向 Native 指定 SDK、Activity、EventBus 或内部实现方式。

**设计含义：**

H037 的施工对象只在 H5 仓库。Native 代码在本卡中作为**宿主事实证据**，不是待修改对象。

## 3. Android 当前实现证据

证据基线：

```text
sanchuang-dev/dr-card-android
upstream/gitee/master@a8ac84694d2f69e0c1bfa10619fdc3810845a337
```

### E-H037-A01｜扫码 callbackId 被带入设备流程

`H5ScanHelper`：

- 从 H5 入参读取 `callbackId`；
- 扫码成功后保存原始扫码文本；
- 查询设备；
- 启动 `BleGoodsDetailActivity` 时携带：
  - `from_h5_scan`
  - `h5_callback_id`
  - `h5_scan_text`
  - `h5_scan_type`

这证明 callback correlation 被刻意跨 Activity 保留，不是单次 scanner return。

### E-H037-A02｜扫码成功后当前会先产生一次中间 callback

`H5ScanHelper.handleScanFinish()` 当前在识别到有效扫码文本后：

1. 组装 `data.text / data.scanType`；
2. `callbackScan(0, "ok", data)`；
3. 继续执行 `requestDeviceDetailAndJump(deviceCode)`。

因此当前 Android 存在：

```text
第一次 code=0 callback
发生于设备流程之前
```

它不能被 H5 解释为整段体验券核销事务已经结束。

### E-H037-A03｜设备流程结束后使用同一 callbackId 回传终态

`BleGoodsDetailActivity.notifyH5StartResult()`：

- 仅在 `fromH5Scan` 成立时工作；
- 使用进入 Activity 时携带的原 `h5CallbackId`；
- 通过 `H5BridgeCallbackEvent` 回传；
- 成功使用 `code=0`；
- 失败使用 `code=5`（message 保留具体失败信息）；
- `h5StartCallbackSent` 保证设备终态只发送一次。

成功终态当前仍携带 `text / scanType`，因此**仅凭 payload 字段不能区分“第一次扫码成功”和“第二次设备成功”**。

### E-H037-A04｜最终事件回到原 H5 Bridge 消费者

`H5BridgeCallbackEvent` 注释明确其用途是：

> H5 扫码启动售货机后的结果回传（仅 ShiDeLiWebActivity 消费）

`H5ScanHelper.onH5BridgeCallbackEvent()` 校验 callbackId 后，再调用 `jsCallback.callbackToJs(...)`。

该实现与 D-H037-01 的“回到原 H5 实例后通知最终结果”业务设计一致。

### E-H037-A05｜激励广告当前真实结果不是旧 status 字符串

`H5RewardAdHelper.finishCallback()` 当前返回：

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

当前代码语义：

- 完播后关闭：`code=0`
- 未完播关闭：`code=1`
- 普通加载失败：`code=5`
- timeout：`code=6`
- no fill：`code=7`

`onADVideoPlayComplete` / `onADReward` 会把 `finishPlayState` 置为 1；`onADClose` 再据此决定 `code=0` 或 `code=1`。

这与 D-H037-02 的产品确认一致：**是否完成由 Native 最终判断，H5 不重复判定。**

## 4. H5 当前实现证据

证据基线：

```text
dangjingtao/dr-card-ui
dev@3e970a4d9751f2083e99399fc84ce6fc93035962
```

### E-H037-H01｜通用 callback transport 当前是一次性 Promise

`src/services/nativeBridgeTransport.ts` 的 `createCallbackInjectedObjectTransport`：

```text
callbackId 命中 pending
  -> handlePayload
  -> finish
  -> pending.delete(callbackId)
  -> resolve / reject
```

因此它默认假设：**一个 callbackId 只需要一条终态 callback**。

这个默认值对其它普通异步能力仍合理，H037 不得全局破坏。

### E-H037-H02｜scan.ts 当前把第一条扫码成功直接当终态

`src/services/nativeBridge/capabilities/scan.ts` 当前：

- 从 `data.text` 读取扫码正文；
- `code=0` 即返回 `{ code: text }`；
- 配合一次性 callback transport，第一条扫码成功就 settle。

这与 E-H037-A02 / A03 的两阶段 Android 事务冲突。

### E-H037-H03｜ScanVerify 当前收到第一条结果就进入旧确认页

`src/pages/ScanVerify.tsx` 当前：

```ts
const result = await scanCode({ scanType: 'all' })
navigate('/card/verify/confirm', {
  state: { nativeScanCode: result.code }
})
```

而 `ConfirmVerify.tsx` 仍展示：

- “即将核销此券”
- “请与门店店员核对”
- “确认核销”

在 D-H037-01 已确认“Native 已完成机器调货后才交还 H5”的前提下，这条旧流程会形成**Native 已完成后 H5 再确认一次**的语义重复。

H037 只负责收口现有流程，不重新设计新的业务页面。

### E-H037-H04｜rewardAd.ts 当前仍依赖旧 status contract

`src/services/nativeBridge/capabilities/rewardAd.ts` 当前只接受：

```text
completed | closed | failed | no_fill
```

并从 `status` / `data.status` 读取。

当前 Android 已按 E-H037-A05 返回 `code + adLoadState + finishPlayState`，因此真实宿主结果会被 H5 判为非法 payload。

## 5. 设计结论与证据映射

| H037 设计结论 | 主要证据 |
|---|---|
| 广告 `code=0` 在 H5 归一为 completed | D-H037-02 + E-H037-A05 |
| H5 不自行重算广告完播 | D-H037-02 + D-H037-03 |
| 扫码第一条成功 callback 不能 settle | D-H037-01 + E-H037-A02 + E-H037-H01/H02 |
| 设备最终 callback 才结束扫码核销事务 | D-H037-01 + E-H037-A03/A04 |
| scanCode 需要 capability-specific 多阶段语义 | E-H037-A02/A03 + E-H037-H01 |
| 不改变其它 callback capability 的一次性默认行为 | E-H037-H01 + D-H037-03 |
| Native 最终成功后不能再执行旧“即将核销→确认核销”前置链 | D-H037-01 + E-H037-H03 |
| Native 内部实现不属于 H037 修改范围 | D-H037-03 |

## 6. 尚未确认 / 禁止推断

以下内容本证据文件**没有确认**，H037 不得自行定稿：

- iOS 是否已经实现与 Android 完全相同的扫码两阶段行为；
- iOS 当前广告 payload 是否与 Android 完全一致；
- Native SDK 内部扫码码制策略；
- `scanType=all` 的 Native 实际识别范围；
- Android Activity / EventBus / SDK 内部实现是否需要调整；
- 设备最终结果之后是否需要新增全新 UI；
- 真机返回时序在所有异常场景下是否都与静态源码完全一致。

这些内容只能通过后续 Native 明确回填或真机 smoke 补证。

## 7. H037 施工门槛

开始实现前必须满足：

- [x] 用户业务流程已确认；
- [x] Android 当前源码链路已核对；
- [x] H5 当前 dev 行为已核对；
- [x] 旧 H031 / H033 contract 与新宿主事实的冲突已定位；
- [ ] H037 实现完成后补自动化证据；
- [ ] Android 真机 smoke 后补运行证据；
- [ ] iOS 未有实证前保持“待验证”。



## 2026-11-09｜E-H037-A06 Android non-device QR callback observed in App WebView

A user-provided Android App WebView Bridge Lab capture shows:

- callback endpoint: `window.androidBridgeCallback(callbackId, payload)`;
- `pendingMatched: true` for the active scan invocation;
- first callback count: 1;
- envelope: `code: 0`, `message: "ok"`;
- payload data contains `text`, `scanType: "qr"`, and `isDevice: false`.

The screenshot's `terminal: false` is the then-current H5 diagnostic classification, not a field in the Native payload. The H5 classifier had not yet learned to treat the explicit non-device flag as recognition completion. PR #293 adds that distinction: non-device recognition settles immediately; device transactions retain the existing same-callbackId two-stage wait. The QR text and UUID are intentionally omitted from this evidence record.

This capture is evidence for the non-device branch only. It does not prove the device/coupon path, iOS parity, or the complete buddy relationship transaction.

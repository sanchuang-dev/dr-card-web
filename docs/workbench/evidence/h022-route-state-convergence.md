# H022｜重复路由与状态实现收敛证据

## 结论

本卡盘点范围限定为 **active formal H5**。Native reference / legacy 与当时 deferred 的商城路由不参与施工。后续 `/mall` 主入口已通过 D-082/D-084 转为 active；商城详情与购物车仍 deferred。本卡记录保留盘点时范围。

当前正式 H5 已有大量“状态驱动单实现”的正确做法，本卡不为了减少文件数量强行合并具有不同产品语义的步骤页；只对确有“多 URL / 同实现”关系的入口做显式工程收口，并加回归门禁。

## 盘点结果

### A. 合法多 URL，共用同一实现

| URL | 产品语义 | H022 处理 |
| --- | --- | --- |
| `/membership` | 会员中心标准入口 | `implementationKey: membership` |
| `/dearseed/membership` | 诗得丽专栏内会员中心入口 | 与 `/membership` 共用 `membership` 实现 |
| `/claim/success` | 活动领取成功反馈 | `implementationKey: claim-success` + `campaign` variant |
| `/onboarding/success` | 完善信息后的领取成功反馈 | 与上者共用 `claim-success` 实现，仅用 `onboarding` variant 切换文案 |

路由 URL 与 deep-link 继续保留；差异只留在 route metadata，router 不再为这些 URL 复制 path-level 页面映射。

### B. 已经是“单路由 + 状态”的功能，保持现状并纳入门禁

- `/card/share?state=success`：转赠前后态共用 `CardShare`。
- `/card/verify/confirm?state=done|repeat`：确认 / 已核销 / 重复核销共用 `ConfirmVerify`。
- `/orders?state=completed|ongoing|aftersale|empty`：列表分类与空态共用 `Orders`。
- `/address?state=empty`：地址列表与空态共用 `Address`。
- `/address/new?state=invalid`：新增 / 编辑 / 校验态共用 `AddressNew`。
- `/service/chat/human?state=queuing|connected`：排队 / 已接入共用 `ServiceHuman`。
- 其它既有 fixture state / overlay 继续按同一原则保留，不新增“状态专用页面”。

## 明确保留为独立页面的路由

以下不是“为了展示状态复制页面”，而是不同业务步骤 / 信息层级，因此 H022 不合并：

- `/luck` → `/luck/result`：抽取动作与结果步骤。
- `/exchange` → `/exchange/result`：兑换列表 / 确认链路与终态结果。
- `/card/verify`、`/card/verify/password`、`/card/verify/confirm`：扫码、密码核销、确认核销是不同交互步骤。
- `/notifications` → `/notifications/:id`：列表与单条详情。
- `/orders` → `/orders/:id`：列表与订单详情。
- `/membership` → `/membership/levels`：会员首页与等级说明页。

## 自动证据

- `npm run verify:h022`
  - 校验 membership 两个 URL 使用同一 implementation key；
  - 校验 claim success 两个 URL 使用同一 implementation key，仅 variant 不同；
  - 校验代表性的 state family 仍登记在单一路由；
  - 校验 router 不重新出现上述四个 URL 的重复 path-level JSX 页面映射。
- Formal H5 Playwright：
  - 两个 membership URL 的页面内容一致；
  - 两个 claim-success URL 都命中同一成功反馈实现，并按 variant 输出不同文案；
  - `/card/share` default / success 与 `/service/chat/human` queuing / connected 均在原 URL 上切换状态。

## 边界

H022 不改变业务规则、视觉设计、API 契约或 Native Bridge；没有依据的“相似页面”不因代码长得像就强行合并。

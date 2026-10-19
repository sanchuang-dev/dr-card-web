# H5 接口总索引与通用约定

> 本文件是全站接口接入的公共前置说明。各页面接入文档只写「本页特有」的入参与出参，通用部分（响应体结构、`code` 判断、登录态请求头、分页与排序写法）一律引用本文，不重复描述。
>
> 权威数据源：`docs/api/dearseed-api.md`（FastAdmin OpenAPI 整理版）+ `docs/api/dearseed-openapi.json`（原始快照，抓取于 2026-09-16）。
> OpenAPI 快照只覆盖后端自动生成的 CRUD 六件套，**不含**部分已实测可用的业务端点（如 `signrecords/status`、`signactivity/list`、`userpoints/stat`），这些以后端实测为准，记录在各页面接入文档中。

## 0. 通用约定

### 0.1 响应体信封

所有接口共用同一层信封。**2026-09-28 起成功码统一为 `0`**（兼容原生）。

成功：

```json
{ "code": 0, "msg": "success", "status": "succ", "data": {} }
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `code` | `number` | 恒为 `0` |
| `msg` | `string` | 恒为 `"success"` |
| `status` | `string` | 恒为 `"succ"` |
| `data` | `any` | 业务数据；列表类接口默认 `[]`，**不是 `null`** |

失败结构与成功**不同**：字段名是 `message`（不是 `msg`），且没有 `status` 字段。

```json
{ "code": 500, "message": "\"配置标题\" is required", "data": [] }
```

### 0.2 `code` 判断规则

- **只看 `code` 判成败，不看 HTTP 状态码。** 参数缺失 / 格式错误可能是 HTTP 200 + `code:500`。
- `code === 0` 成功；其余为失败，失败文案优先取 `message`（部分实测端点返回 `msg`），无则用 service 层传入的 `fallbackMessage`。
- 401 表示未登录 / token 失效：HTTP 401 + `{"code":401,"message":"请先登录","data":[]}`。
- 业务校验失败（如重复签到）：HTTP 400 + `{"code":400,"message":"今日已签到","data":[]}`。
- 少数端点**不读取登录用户身份**，因此不要求 `Authorization` 头（如 `GET /api/coupons/index`），以各页面接入文档的「登录」列为准。

前端统一走 `src/services/contracts/apiEnvelope.ts` 的 `parseApiEnvelope(payload, schema, { contract, fallbackMessage })`，业务 service 不各自发明判断逻辑。

### 0.3 登录态请求头

- 需要登录的接口在文档中标注「✅ 是」。
- 认证头口径（2026-09-28 对 7002 实测修正）：**`Authorization: Bearer <accessToken>`**；旧的 `token` 请求头口径**已失效**（返回 401）。
- 请求头由全局 auth session provider 注入，业务 service 不单独附 `token` 头；401 由 `httpClient` 重试 + 页面 AuthGate 统一处理。
- 只返回当前登录用户自身数据的接口，**不传也不接受 `user_id`** —— 传了也会被登录用户覆盖。

### 0.4 分页写法

- 入参：`page`（默认 `1`，小于 1 会被夹到 `1`）、`pageSize`（默认 `15`，上限 `100`；`select` 为 100/500）。

出参（`index` 类分页列表）：

```json
{
  "code": 0,
  "msg": "success",
  "status": "succ",
  "data": {
    "data": [],
    "current_page": 1,
    "per_page": 15,
    "total": 0,
    "last_page": 1
  }
}
```

- 列表数组在 `data.data`，**嵌套两层**；分页信息与它同级。
- `last_page = max(ceil(total / per_page), 1)`，空结果时是 `1` 不是 `0`。
- 例外：部分业务端点返回**裸数组**（如 `GET /api/signactivity/list`），不在 `data.data` 里，以各页面接入文档为准。

### 0.5 排序写法

- 自定义排序：`orderBy[字段]=ASC|DESC`，URL 中需编码为 `orderBy%5B字段%5D`。
- 不传时默认 `id DESC`（即最新在前），多数展示场景无需传。

### 0.6 时间格式

- 字符串时间为 `"YYYY-MM-DD HH:mm:ss"`（北京时间）。
- `delete_time` 类软删字段恒定 `null`，前端忽略、不参与渲染。

## 1. 已实测可用的业务端点（索引）

以下端点由各页面接入文档记录真实契约（字段结构以实测为准，不以后端 CRUD 文档的「文档未定义字段结构」为准）。

| 能力 | 方法 / 路径 | 登录 | 分页 | 记录文档 |
| --- | --- | --- | --- | --- |
| 个人资料（头像 / 昵称 / 等级 / 券数量） | `GET /api/user/profile` | 是 | 否 | `engineering/profile-page-api-integration.md` |
| 修改个人资料 | `POST /api/user/update` | 是 | 否 | `engineering/profile-page-api-integration.md` |
| 优惠券列表（券模板，可兑换的券） | `GET /api/coupons/index` | 否（不读取登录用户身份） | 是 | `engineering/profile-page-api-integration.md` |
| 泡泡值统计（可用 / 累计收入 / 累计消耗） | `GET /api/userpoints/stat` | 是 | 否 | `engineering/points-page-api-integration.md` |
| 泡泡值明细列表（全部 / 收入 / 消费） | `GET /api/userpoints/index` | 是 | 是 | `engineering/points-page-api-integration.md` |
| 签到活动列表 / 任务区签到进度（最大签到天数 / 已签到天数） | `GET /api/signactivity/list` | 是 | 否（裸数组） | `engineering/points-page-api-integration.md` |
| 今日签到状态及可得泡泡值 | `GET /api/signrecords/status` | 是 | 否 | `engineering/checkin-api-integration.md` |
| 今天签到 | `POST /api/signrecords/add` | 是 | 否 | `engineering/checkin-api-integration.md` |
| 本月签到记录（`range=month`） | `GET /api/signrecords/index` | 是 | 否（裸数组） | `engineering/checkin-api-integration.md` |
| 补签 | `POST /api/signrecords/makeup` | 是 | 否 | `engineering/checkin-api-integration.md` |
| 优惠卡转赠 | `POST /api/coupons/give` | 是 | 否 | `engineering/coupon-transfer-api-integration.md` |

> `POST /api/signrecords/makeup` 已纳入最新《签到页面接口文档》；补签前仍必须先通过 Native 激励广告闸门，详见 `engineering/checkin-api-integration.md` §3、§5.1、§6。

> 后端 CRUD 自动生成的 `index/add/detail/update/delete/select` 六件套见 `docs/api/dearseed-api.md`；其中 `add/update/delete` 属后台管理，H5 原则上不直接调用。


## 2026-10-09 后台新增 API 的历史核对快照

[后台新增接口、DTO 差异与产品合同审计（2026-10-09 静态快照）](./engineering/backend-api-delta-2026-10-09.md)

- **仅确认后端源码**：`API/master@7e1f710` 当时的 Friends、通知、客服 SSE/Socket、券分类与兑换接口形状；真实部署与授权负向测试另行验收。
- **H5 晚间已合入 dev**：通知 #128、券分类 #132、搭子 #133/#134/#139、客服 #141/#147 等实现；不能沿用快照中的“未实施”作为现状。
- **不可合并解释的阻塞**：第三方发券、好友关系安全/状态历史、扫码分流、真人坐席、App WebView 等必须根据对应 Issue 和真实环境证据判定，不因源代码存在就宣布可用。


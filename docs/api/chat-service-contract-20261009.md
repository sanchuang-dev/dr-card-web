# H5 客服接口与实时消息合同

> **更新日期：2026-10-24。** 本文记录 H5 当前接入应遵守的移动端接口合同，重点补充 SSE 错误处理、转人工前的 Socket 连接顺序，以及 Socket.IO 默认命名空间与 Engine.IO transport path 的区别。若后端部署版本与本文不一致，应由前后端联调确认并同步修订文档，不要仅凭旧 OpenAPI 快照推断运行时行为。

## 1. 通用认证与身份安全

- 所有以下 HTTP 接口均使用 `Authorization: Bearer <accessToken>`。
- Socket.IO 握手通过 `auth: { token: accessToken }` 传递 token；不要把 token 放在 URL 或 query string。
- H5 不传 `user_id` 或 `sender_id`，用户身份由服务端根据 token 确定。
- Socket 鉴权失败时，服务端可能先发送 `error` 再断开；前端应进入未授权状态并停止无限重连。token 更新后，使用新 token 重建 socket。

## 2. 发送消息：SSE

`POST /api/chatmessages/add`

请求头：

```http
Authorization: Bearer <accessToken>
Accept: text/event-stream
Content-Type: application/json
```

请求体示例：

```json
{ "content": "我想咨询一下订单" }
```

- 使用 `fetch` 发起 POST 并读取 SSE 流；不要使用只适合 GET 的原生 `EventSource`。
- 不需要提交对话历史、`user_id` 或 `sender_id`。
- 识别以 `data:` 开头的 SSE 行；忽略注释/心跳行（例如 `: ok`）以及其他非 `data:` 行。
- 流内事件：
  - `text`：AI 回复的增量文本。
  - `human`：对话已进入人工服务模式。
  - `done`：本次生成结束；AI 消息的 `message_id` 可能存在。
  - `error`：流内业务错误，应解析并向用户显示可理解的错误信息。
- 在 SSE 流开始前，认证或参数校验失败可能返回普通 JSON，而非 `text/event-stream`。客户端必须先检查 HTTP 状态及响应内容类型，并兼容解析普通 JSON 错误，不能将其误判为 SSE 数据。

## 3. 转人工

`POST /api/chatmessages/transfer`

请求体（可选）：

```json
{ "content": "最近一条用户消息（可选）" }
```

- 调用转人工接口前，先确保 Socket.IO 已连接；连接未成功时不要先提交转人工请求。
- 成功响应的业务数据应满足 `data.mode === "human"`。
- 转人工接口负责切换服务模式；人工坐席的后续回复通过 Socket.IO 的 `chat:message` 事件接收。用户发送消息仍走 HTTP，不通过 Socket.IO 发送。

## 4. 接收人工消息：Socket.IO

### 4.1 Namespace 与 transport path 是两个概念

客户端连接后端注册的默认 **`/` namespace**，并通过 `path` 指定 Engine.IO transport path：

```ts
io('https://api.example.com', {
  auth: { token: accessToken },
  // Engine.IO transport path；它与上面的 namespace URL 不同
  path: '/socket.io/',
})
```

- 后端源码 `API/src/app/api/socket/ChatSocket.ts` 注册的是默认 `/` namespace，因此客户端 URL 不应追加 `/socket.io`。
- `path` 才是 Engine.IO HTTP/WebSocket transport path，默认常见值为 `/socket.io/`；若部署环境配置了反向代理路径，应按环境配置单独设置。
- `/socket.io` 常见地是 transport path，并不自动代表 Socket.IO namespace；只有后端明确注册 `io.of('/socket.io')` 时才应将它作为 namespace。
- 只监听 `chat:message` 接收人工坐席消息；客户端发送消息仍使用 HTTP API。

### 4.2 消息格式、排序与去重

`chat:message` 推送记录包含服务端消息标识 `id`、`user_id`、`sender_id`、`content`、`msg_type`、`create_time` 等字段。

- Socket 推送中的 `create_time` 是秒级时间戳；历史接口中的 `create_time` 可能是字符串。
- 消息以服务端 `id` 进行排序和去重；合并历史记录与实时推送时不能重复展示同一条消息。
- Socket 断线期间的消息不会自动重放。每次成功重连后，应重新调用历史接口补齐离线期间遗漏的消息。
- token 失效时不要无限重试；刷新 token 后应销毁旧连接并用新 token 创建连接。

## 5. 拉取历史消息

`GET /api/chatmessages/index?page=1&pageSize=15`

- 使用 Bearer token。
- 消息列表位于 `data.data`；接口按 `id` 倒序返回，前端合并后按消息 ID 排序显示。
- 历史数据包含用户、客服及系统消息；与 Socket 推送按 `id` 去重。
- 建立连接后的首次加载，以及每次成功重连后，都应拉取历史以补齐可能遗漏的消息。

## 6. 推荐流程

1. 页面加载后获取历史消息，并建立 Socket.IO 默认 `/` namespace 连接，transport path 使用环境配置（通常为 `/socket.io/`）。
2. 用户发送内容时，调用 `POST /api/chatmessages/add` 并消费 SSE。
3. 当用户选择转人工时，先确认 Socket 已连接，再调用 `POST /api/chatmessages/transfer`。
4. 收到 `chat:message` 后按消息 `id` 去重并更新会话列表。
5. Socket 成功重连后重新拉取 `GET /api/chatmessages/index`，补齐断线期间未收到的消息。
6. 对 SSE 流开始前的 JSON 错误、流内 `error` 事件及 Socket 鉴权失败分别处理，避免把连接成功误认为业务消息链路正常。

## 7. 验收边界

自动化测试可验证 默认 namespace、transport path、token 传递、消息去重和错误处理逻辑；它不能证明目标测试环境已经部署匹配的后端，也不能替代真实坐席联调。上线/验收前应在目标环境使用授权账号完成 AI SSE 回复、转人工、坐席回复推送、断线重连补历史及 Android/iOS WebView 验证。
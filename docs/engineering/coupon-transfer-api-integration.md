# 优惠卡转赠接口接入

## 1. 契约

`POST /api/coupons/give`

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "log_id": 1001,
  "friend_id": 2
}
```

- `log_id`：本人未使用优惠卡记录 ID，来自 `POST /api/coupons/MyCoupons`（`type=unused`）的 `data.data[].id`。
- `friend_id`：接收方用户 ID，来自好友列表 `GET /api/friends/index` 的 `friend.id`。
- 赠送方身份由服务端按登录态取得；H5 不传 `user_id` / `mobile`，接收方手机号由服务端查询。

成功：

```json
{
  "code": 0,
  "msg": "success",
  "status": "succ",
  "data": { "log_id": 1001, "friend_id": 2 }
}
```

## 2. 前端边界

- 页面：`src/pages/CardShare.tsx`
- Service：`src/services/couponGift.ts`
- Mock：`src/mocks/handlers/couponGift.ts`

页面只调用 `giveCoupon({ logId, friendId })`，不拼接 URL、不读取用户身份，也不在失败时退回 Mock。

## 3. 页面状态

- `idle`：加载当前登录用户的真实搭子，单选接收人。
- `submitting`：按钮进入「正在转赠…」，禁用搜索与重复提交。
- `success`：仅在接口 `code === 0` 且返回结构通过契约校验后展示；成功后「查看我的卡包」重新进入卡包并重新请求 `MyCoupons`。
- `error`：优先展示后端原话（如「该优惠卡不属于您」「对方未绑定手机号，无法赠送」）；网络、超时、契约异常使用可重试文案。

历史 `/card/share?state=success` 不代表转赠成功，页面不会仅凭 URL 展示成功态。

## 4. Mock 规则

preview/dev Mock 复用同一 service 与 MSW handler，使用数值演示好友 ID（9001–9004）和 `MY_COUPONS_RECORDS_MOCK`。成功后从 Mock 未使用列表移除对应券，便于验证卡包刷新；成功页明确标注「仅模拟接口成功，未真实转出卡券」。

## 5. 验证

- Service：`src/services/couponGift.test.ts`
- 页面：`src/pages/CardShare.test.tsx`
- E2E：`tests/e2e/formal-h5.spec.ts` 中卡券转赠流程

`test` / `prod` 的真实 App WebView、登录态与卡博士上游返回仍需在对应环境验收；浏览器 Mock 成功不等于线上已验收。

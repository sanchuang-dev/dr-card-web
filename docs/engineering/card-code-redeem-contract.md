# 兑换码换卡券｜H5 ↔ 后台现行协议（2026-10-14）

> 本文件记录 H5 当前协议。10-12 旧版仅传 code 并返回本地用户卡券四字段回执，已被新协议替代。仅修改 H5，不修改后台；真机和实际到账留给 test 验收。

## 1. 交互

输入原始兑换码（至少 10 字符）→ 全屏选择适用片区 → 确认后请求发券 → 成功页或错误反馈。

- 选择页复用 ProjectSelectScreen，但顶部展示原始兑换码；核兑之前没有券详情，不虚构未知券名称、金额、图片和泡泡值。
- 项目列表每页 15 条；无关键词使用 GET /api/couponskbs/index；搜索使用 POST /api/coupons/getProjects，请求 shop_name / page / pageSize。
- 选中项目的 id 独立保存：后续搜索无关词、加载下一页或无结果，均不得清除已选状态。
- 选择项目不发券，只有确认按钮触发核兑；后端最终决定片区和兑换码是否适配。
- code 原样保留，不去空格，不改大小写；登录身份由 HTTP 鉴权提供。

## 2. 用户核兑接口

POST /api/cardredemptioncodes/redeem
Authorization: Bearer accessToken

请求 JSON：
{"code":"ABC123456789","project_id":123}

成功 JSON：
{"code":0,"data":{"coupons_id":7}}

- 严格检查业务 code = 0 和成功响应的 coupons_id 正整数。
- 旧版 user_card_id / card_id / card_name / card_sn 不再是响应字段，不得继续在成功页展示旧名称或伪造卡券编号。
- 业务失败展示服务端 message；401 走现有身份处理。网络失败或超时不模拟成功；超时结果未知，提示先去卡包查看。
- 确认时锁定输入的 code，提交中禁止重复调用，失败可保留片区选择供用户处理。

## 3. 兑换后卡包

新协议兑换成功后可从 /card 查看第三方券，读取 POST /api/coupons/MyCoupons；coupons_id 为券模板标识，不能用作单张券的序列号、核销号或转赠 ID。

历史 GET /api/usercards/index 的 source=60 本地卡券读取保留作为存量兼容，不再将新核兑结果假定为本地 source=60 卡券。两个读取源各自独立，不虚构到账。

## 4. 验收边界

Vitest/Playwright/PR CI 负责前端请求体、项目搜索分页、已选项保持、失败及成功结果验证。只有在 test App WebView + 真实 API + 登录状态下，才能验证实际兑换码、第三方发券到账和卡包回显。没有实际验收不能宣称闭环已通过。

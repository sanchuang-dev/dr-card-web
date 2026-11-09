# AGENTS.md

本文件是 `sanchuang-dev/dr-card-web` 仓库的全局智能体施工指南，适用于在本仓库内工作的 AI 编码、设计与测试智能体。

## 1. 项目定位

- 本项目是 **卡博士原生 App 内嵌的 H5 前端工程**，不是独立 App，也不再只是高保真 UI Demo。
- UI 仍是正式交付物：视觉与交互结论必须稳定，不能因为接 API / JSBridge 而随意漂移。
- 项目允许在浏览器独立预览，但生产运行环境是 App WebView。
- 不臆造宿主能力。只有 App 实际提供并已确认的能力才能进入正式 JSBridge 契约。

长期分支固定为：

```text
preview → dev → test → prod
```

- `preview`：UI 真相、视觉施工、交互状态、预览验收；Cloudflare Pages 预览入口。
- `dev`：H5 正式开发；API、Mock/API 切换、业务状态、JSBridge、鉴权、错误处理等工程集成。
- `test`：App WebView、真接口、JSBridge、设备环境、回归与业务验收。
- `prod`：正式 H5 发布真相源。
- 历史 `main` 暂时仅作为旧入口和历史基线保留。

正常晋级只允许相邻方向：`preview → dev`、`dev → test`、`test → prod`，原则上通过 Pull Request 完成。详细规则见 `docs/workflow/branch-strategy.md`。

下游临时业务实现不得整分支反向覆盖 `preview`。若下游形成新的产品 / UI 决策，应把该决策作为独立变更同步回 `preview`。

## 2. 技术基线

- Vite
- React 18
- TypeScript
- React Router
- Tailwind CSS
- Lucide React
- Com Design 金色 / 橙色语义 Token

施工前优先复用现有结构：

- `src/components/ui/`
- `src/components/mobile/`
- `src/components/card/`
- `src/layouts/`
- `src/pages/`

正式开发新增的数据与宿主边界应遵循 `docs/engineering/coding-standards.md`，不要让页面同时承担 UI、接口、Mock 和原生桥接职责。

## 3. H5 工程边界

### 3.1 页面层

页面负责：

- UI 组合；
- 页面级交互；
- 展示业务状态；
- 调用统一 service / bridge 接口。

页面不应：

- 直接散落调用 `window.xxx` 原生对象；
- 直接写临时 fetch 代替正式数据层；
- 为了等后台而把不可维护的假数据硬塞进组件；
- 用 Mock 成功掩盖真实 API / Bridge 不可用。

### 3.2 数据层

业务数据必须允许 `mock | api` 两种模式，并通过统一 service / repository 边界暴露给页面。

要求：

- 页面调用方式在 Mock 与真实 API 间保持一致；
- Mock 用于独立开发、视觉验收、状态覆盖和故障复现；
- Mock 数据必须明确可识别，不能伪装成真实线上结果；
- `prod` 不得以 Mock 作为真实业务兜底。

### 3.3 JSBridge 层

H5 与原生 App 的交互必须集中到 Bridge adapter / protocol 层。

统一处理：

- 能力检测；
- 参数与返回值类型；
- 调用成功 / 失败；
- 超时；
- 不支持能力；
- App 版本差异；
- 浏览器 Mock / 合理 Web fallback。

禁止页面各自发明 Bridge 协议。浏览器 Mock 只能模拟已确认协议，不得据此推断原生 App 存在某项能力。

宿主身份（当前是浏览器还是原生 WebView）同样必须经 `src/services/nativeBridge.ts` 的宿主查询获得，页面、入口与提示组件不得自行读取 `window.androidBridge` / `window.iosBridge`，也不得用 UA 或环境变量猜宿主。

`test` / `prod` 只承载真实 API + Native Bridge 集成，其合法运行容器是 App WebView（H036）。浏览器独立预览由 `preview` / `dev` + Mock 承担。

### 3.4 Native 参考路由 / legacy 范围

仓库中存在一组主要提供给 Native 同事参考的页面与路由。它们 **原则上不属于当前 H5 团队的施工、重构、API 接入、Mock、路由动画或业务验收范围**。

当前明确包括：

- `/legacy-home` 及其后代路由；
- `/legacy-service` 及其后代路由；
- `/legacy-profile` 及其后代路由；
- 虽然路径本身不带 `legacy`，但路由归属明确属于上述 Native 参考链路的页面，例如当前 `/device/*`、`/vending/*`。

范围判断 **以路由归属 / owner 和产品职责为准，不以路径字符串是否包含 `legacy` 为唯一判断条件**。

规则：

- 不主动修改、重构或“顺手优化”这些页面；
- 不把这些页面纳入 H5 的常规 UI 还原、service/API、Mock、JSBridge、路由动画施工；
- 不把这些页面纳入 H5 业务验收或 `test` CI 的业务通过标准；
- 不因其代码陈旧而删除，保留其作为 Native 参考与历史证据的价值；
- 如果共享底层代码影响正式 H5 的构建或运行，只做解决当前 H5 问题所需的最小兼容修改；
- 如果未来某个页面正式转交 H5 负责，必须先由用户 / 产品明确把该页面从 Native 参考范围中转正，再按 `preview → dev → test → prod` 正常流程施工。

一句话：**正式 H5 路由是施工面；Native 参考 / legacy 路由默认只看、不动、不验。**

## 4. 设计系统

- 项目使用 Com Design 金色 / 橙色体系 Token。
- Tailwind 已映射项目语义 Token；优先使用现有 Token 和语义类，不另起颜色系统。
- 可以复用已经迁入的 Com Design 组件与移动端公共组件。
- 品牌艺术素材、特殊会员卡、IP 插画等应优先忠实还原，不为组件统一抹掉品牌特征。
- 禁止把页面做成游戏 UI 或廉价促销金色堆叠。

当前设计基线见 `docs/design/design-baseline.md`。

## 5. 视觉与需求事实源

### 5.1 Mockplus / `preview` 是 UI 事实源

Mockplus 原型和已确认的 `preview` 页面实现共同构成当前 UI 真相。

原型语言文档位于：

- `docs/prototype/README.md`
- `docs/prototype/01-entry-and-home.md`
- `docs/prototype/02-membership-and-checkin.md`
- `docs/prototype/03-partner-and-invite.md`
- `docs/prototype/04-mall-card-order.md`
- `docs/prototype/05-account-message-service.md`
- `docs/prototype/06-deferred-and-legacy.md`
- `docs/prototype/07-page-index.md`

需要核对具体布局、状态和交互时，优先回到已确认原型与 `preview`。

### 5.2 「不靠谱的设计历史」只是证据材料

`不靠谱的设计历史/` 保存历史设计证据，不是当前规范。

规则：

1. 只有历史稿有依据时，不自行定稿关键产品 / UI 结论；
2. 与当前原型冲突时，明确记录冲突，不自行选边；
3. 可借鉴局部设计，但未经确认不得整页照搬；
4. 不因“清理仓库”删除历史设计、截图或验收证据。

## 6. 页面与组件施工原则

- 移动端优先，主要视觉基准为 375 × 812。
- 优先保证信息层级、布局、间距、状态、主操作位置和品牌视觉。
- 页面要适应 WebView 与常见移动浏览器差异，但不能为桌面适配破坏手机视觉。
- 图标优先使用 Lucide；品牌 / IP 素材使用项目正式资产。
- 空态、加载态、成功态、错误态、禁用态等必须按需求覆盖。
- 先查现有组件，再新增；可复用模式沉淀到组件层，一次性品牌艺术画面不强行泛化。
- 不随意修改业务文案或产品逻辑；发现冲突要记录并提出。

## 7. App WebView 注意事项

正式实现时需要主动考虑：

- 安全区 / 状态栏 / Home Indicator；
- Android / iOS WebView 差异；
- 键盘弹起与输入框遮挡；
- 页面返回与宿主返回行为；
- 页面生命周期与重新进入；
- 缓存与 H5 更新；
- 网络弱 / 断网 / 超时；
- Bridge 尚未注入或当前 App 版本不支持能力。

不得仅凭桌面浏览器表现判断 App 内可用。

## 8. Mock 规则

后台未完成不是 H5 停工理由，Mock 是正式开发能力。

建议环境语义：

```text
VITE_DATA_MODE=mock|api
VITE_BRIDGE_MODE=mock|native
VITE_API_BASE_URL=...
```

具体变量名以仓库最终实现为准；未实现前文档不能假装已经存在。

Mock 规则：

- Mock 与真实实现使用相同业务接口；
- 允许覆盖成功、空态、错误、超时、无权限等状态；
- Bridge Mock 只覆盖已确认原生协议；
- `test` 原则上优先真实 API + 真实 WebView / Bridge；
- `prod` 禁止 Mock 业务兜底。

## 9. 台账与证据

`docs/workbench/` 的任务、决策、证据和验收治理规范继续保留。

- 已验收历史卡不得为了新需求被静默改写；
- 新需求、修复或工程接入应留下可追踪记录；
- 智能体自检不能替代用户 / 业务验收；
- 历史 UI 任务的归档或删除方案尚未最终确认，未经明确决定不得批量删除。

## 10. 修改边界

- 只修改当前任务需要的文件；
- 不顺手重构无关代码；
- 不删除历史设计、原型资料、截图或验收材料，除非任务明确要求；
- 不把下游临时实现反向污染 UI 真相；
- 不把浏览器 mock 结果写成“真实 App 已支持”。

## 11. 提交前检查

按任务范围至少执行相关检查：

```bash
npm run typecheck
npm run build
```

涉及交互 / 路由的任务应运行对应 E2E；涉及 App 宿主能力的任务必须记录 WebView / Bridge 验证情况。纯文档变更无需为了形式强行修改业务代码。

提交信息应直接说明施工内容，避免 `update`、`fix stuff` 一类无意义提交。

## 12. 测试与发布门槛

验收不是单一“CI 绿灯”。正式发布至少区分：

```text
浏览器 H5
→ App WebView
→ JSBridge / 真接口
→ test 业务验收
→ prod
```

测试细则见 `docs/testing/test-plan.md`。

## 13. 决策优先级

发生冲突时：

1. 用户在当前任务中的明确确认；
2. 已确认的当前 Mockplus 原型与 `preview` 页面结论；
3. `docs/prototype/` 原型语言；
4. 项目当前实际使用的 Com Design Token / 公共组件约束；
5. 已验收实现；
6. `不靠谱的设计历史/`；
7. 智能体自己的推断。

第 6、7 项不能越级替代前面的事实源。

---

一句话原则：**UI 在 `preview` 做准，H5 能力在 `dev` 接稳，真实 App 环境在 `test` 验明，只有通过验收的版本才进 `prod`。**

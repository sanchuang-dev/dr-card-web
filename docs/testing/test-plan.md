# 卡博士 App 内嵌 H5 测试与验收方案

> 适用仓库：`sanchuang-dev/dr-card-web`
>
> 适用主链路：`preview → dev → test → prod`
>
> 本文定义卡博士 H5 的测试分层、环境组合、Mock 策略、WebView / JSBridge 验收、自动化边界、晋级门槛与证据要求。

---

## 1. 目标

`dr-card-web`（npm 包名仍为 `dr-card-ui`）是 **卡博士 App 内嵌 H5 前端**。它既需要在浏览器中独立开发和预览，也需要最终运行在 Android / iOS App WebView 中，并与真实业务 API、Native JSBridge 协作。

因此，本项目不能用“浏览器打开正常”代替完整验收。

测试的核心目标是回答四个问题：

1. H5 自己是否正确；
2. H5 与真实后端是否正确；
3. H5 在真实 App WebView 中是否正确；
4. H5 与已确认的 Native 能力协作是否正确。

核心原则：

> 浏览器可用 ≠ App WebView 可用。
>
> Mock 可用 ≠ 真接口可用。
>
> Bridge Mock 可用 ≠ Native Bridge 已支持。
>
> CI 绿灯 ≠ 业务验收通过。
>
> 自动化通过 ≠ 用户已经接受产品结果。

---

## 2. 本计划不负责什么

本文不负责：

- 发明尚未确认的后端字段或业务协议；
- 发明尚未确认的 Native Bridge 能力；
- 替代产品 / UI 验收；
- 把历史 UI 任务自动改写为真实 App 集成通过；
- 用覆盖率数字代替关键业务路径验证。

涉及支付、充值、核销、设备启动、身份认证等高影响能力时，以最终真实协议和业务规则为准增加专项测试。

---

## 3. 测试模型：四个独立维度

测试记录必须明确当前组合，不允许只写“测试通过”。

### 3.1 运行容器

```text
Browser
App WebView
```

### 3.2 数据来源

```text
Mock API
Real API
```

### 3.3 宿主能力来源

```text
Mock Bridge
Native Bridge
```

### 3.4 平台

```text
Desktop Browser
Mobile Browser
Android App WebView
iOS App WebView
```

一个完整测试结果应能表达为：

```text
App WebView + Real API + Native Bridge + Android 14
```

而不是模糊记录为：

```text
Android 已测
```

---

## 4. 环境与数据源约定

分支职责和数据来源是两个维度，不直接等同。

### 4.1 `preview`

职责：**UI 真相源**。

Cloudflare Pages 在线预览默认使用稳定 Mock / fixture，保证 UI 可独立验收。

适合验证：

- 页面视觉；
- 状态覆盖；
- 响应式布局；
- UI 交互；
- 可重复截图。

不作为：

- 真实 API 联调证据；
- Native Bridge 验收证据；
- App WebView 验收证据。

### 4.2 `dev`

职责：**正式 H5 开发与工程集成**。

本地开发允许：

```text
Mock API
Real API
```

开发者可以按当前任务切换数据来源。

但 **Cloudflare 上的 `dev` 在线部署固定使用 Mock 数据**，作为当前工程实现的稳定在线演示 / 开发验收入口。

因此：

```text
Local dev → Mock / Real API 可选
CF dev    → Mock 固定
```

Cloudflare `dev` 不提供普通用户可操作的“切真实 API”入口，避免环境语义漂移。

### 4.3 `test`

职责：**真实 App WebView 集成、系统测试、回归与业务验收**。

默认：

```text
Real API
Native Bridge（涉及宿主能力时）
App WebView
```

Mock 只能用于：

- 故障复现；
- 明确的异常场景；
- 尚未具备真实依赖时的局部隔离测试。

Mock 结果不能替代真实集成结论。

`test` 的合法运行容器是 **App WebView**。浏览器打开 `test` 产物不是有效验收场景，而是被明确拒绝的环境组合。

H036（已落地）：`test` 产物在非原生宿主下不进入应用，改为展示"请在卡博士 App 内打开"提示。浏览器侧产物自检（加载、资源、SPA fallback）由 `preview` / `dev` 的 Mock 构建承担。

这与 `test` 的浏览器 gate 不矛盾：CI 用浏览器容器验证的是"产物可加载、可被自动化接管"，不是业务正确性。

### 4.4 `prod`

职责：**正式发布真相源**。

要求：

```text
Real API
Native Bridge（涉及宿主能力时）
```

生产业务不得依赖 Mock API 或 Mock Bridge 兜底。

与 `test` 相同，`prod` 的合法运行容器是 App WebView；非原生宿主下同样只展示"请在卡博士 App 内打开"提示（H036）。

如果生产构建未来加入 Mock 支持开关，应设置构建级保护，避免误把 Mock 模式发布到生产。

---

## 5. Mock 总体方案

### 5.1 当前决定

当前阶段使用 **MSW（Mock Service Worker）** 作为 H5 API Mock 方案。

当前 **不建设独立 Mock Server**，也不为了 Mock 专门增加 Cloudflare Pages Functions / Worker 后端。

原因：

- 当前 Mock 的主要消费者是本 H5；
- 本地开发需要快速切场景；
- Cloudflare `dev` 只需要稳定在线 Mock 展示；
- 没有必要提前维护第二套服务器、部署和接口生命周期。

只有未来出现以下明确需求时，再评估独立 Mock Server：

- Native App 也要直接请求同一套 Mock API；
- Postman / 自动化 / 多个前端需要共享真实 HTTP Mock 地址；
- Mock 需要维护复杂服务端状态机；
- 团队需要独立于 H5 发布周期维护 Mock 后端。

这属于未来需求升级，不是当前方案缺口。

### 5.2 MSW 工作边界

MSW 拦截 H5 正常发出的网络请求。

页面和 service 不应知道当前请求最终由 MSW 还是后端响应。

正确关系：

```text
Page / Hook
    ↓
Service
    ↓
Axios
    ↓
网络请求
    ↓
MSW（Mock 模式）或 Real API（API 模式）
```

禁止：

```text
Page → if mock → mockData
     → else    → service
```

Mock 不应该形成第二套页面业务实现。

### 5.3 Mock 与 Bridge Mock 分离

API Mock 和 JSBridge Mock 是两套不同能力：

```text
API Mock     → MSW
Bridge Mock  → bridge adapter 的浏览器实现
```

两者不得混成一个“万能 Mock 层”。

Mock Bridge 只能模拟 **已经确认存在或已经定义协议的 Native 能力**，不得为了让页面能跑而凭空发明宿主接口。

---

## 6. Mock 数据设计规范

### 6.1 fixture 与 handler 分离

推荐目标结构：

```text
src/
  mocks/
    browser.ts
    fixtures/
      user.ts
      member.ts
      card.ts
    handlers/
      user.ts
      member.ts
      card.ts
```

职责：

- `fixtures/`：稳定数据样本；
- `handlers/`：HTTP 行为、参数判断、状态码、延迟、异常；
- `browser.ts`：浏览器 MSW 启动入口。

实际目录以最终工程落地为准，但职责不得混乱。

### 6.2 同一个接口允许根据参数返回不同结果

Mock 应尽量遵循真实业务参数。

例如：

```text
GET /api/cards?status=active
GET /api/cards?status=expired
```

可以返回不同数据集合。

同样可以根据以下输入决定返回结果：

- path params；
- query params；
- request body；
- headers；
- 已确认的认证上下文。

### 6.3 场景参数

为了覆盖测试边界，可以保留明确的 Mock-only 场景控制方式，例如：

```text
mockScenario=empty
mockScenario=error
mockScenario=slow
```

但场景参数只用于异常和边界测试，不应该替代真实业务参数。

原则：

```text
真实业务参数 → 决定正常业务结果
Mock 场景参数 → 触发异常 / 边界结果
```

### 6.4 最低场景集

关键接口至少应能够稳定复现：

- success；
- empty；
- unauthorized；
- forbidden（如果业务存在）；
- 业务错误；
- 4xx；
- 500；
- slow；
- timeout / network failure；
- 边界数据；
- 字段异常（用于容错测试时）。

不是每个接口都需要机械复制全部场景，应按业务风险选择。

### 6.5 Mock 数据要求

Mock 数据必须：

- 可重复；
- 可定位；
- 不包含真实用户敏感信息；
- 尽量符合真实契约；
- 不为了 UI 好看而长期偏离真实字段含义；
- 不把随机数据作为关键截图 / 回归的唯一来源。

真实 API 契约稳定后，Mock 返回结构应尽量受同一套 TypeScript / Zod / OpenAPI 契约约束。

---

## 7. 测试层级与工具职责

### 7.1 静态工程检查

当前已有：

- TypeScript typecheck；
- 图片资源校验；
- Vite build；
- dev / production build；
- 基础 smoke；
- SPA fallback 检查。

它们用于发现：

- 类型错误；
- 构建失败；
- 丢失资源；
- 路由 fallback 问题；
- 基础运行问题。

这属于最低工程门槛，不是业务验收。

### 7.2 单元 / 逻辑测试

计划补充：

```text
Vitest
React Testing Library
```

当前仓库尚未安装，因此本文将其定义为 **已确定方向、待工程落地**，不是现有能力。

优先测试：

- service 数据转换；
- Zod schema；
- Zustand store 中有业务意义的状态转换；
- storage adapter；
- JSBridge adapter；
- 参数构造 / 错误映射；
- 纯函数工具。

不追求为了覆盖率而给简单 JSX 或第三方库补无价值测试。

### 7.3 浏览器 E2E

当前使用 **Playwright**。

重点覆盖：

- 核心路由；
- 关键业务流程；
- 页面状态；
- 表单；
- Mock 场景；
- 刷新 / SPA fallback；
- 关键资源加载。

Playwright 可以验证 H5 在 Browser 中的完整行为，但不能替代真实 App WebView / Native Bridge 测试。

### 7.4 真实 App 手工 / 场景测试

目前最关键的 App 集成验收仍需要目标 Android / iOS 环境。

自动化无法可靠代替：

- App 宿主生命周期；
- WebView 差异；
- Native Bridge 注入；
- 软键盘行为；
- 系统返回；
- 安全区；
- Native 页面与 H5 页面切换；
- App 版本兼容。

---

## 8. 浏览器 H5 测试

### 8.1 路由

检查：

- 首页和关键业务页可进入；
- 目标 URL 可直接访问；
- 刷新不白屏；
- 浏览器前进 / 后退符合页面语义；
- 非法参数有明确处理；
- 缺失必要参数时不进入不可控状态；
- SPA fallback 正常。

### 8.2 页面状态

按业务实际覆盖：

- loading；
- normal；
- empty；
- error；
- slow；
- timeout；
- unauthorized；
- disabled / unavailable；
- 长文案；
- 极小 / 极大数值；
- 缺失可选字段。

### 8.3 基础交互

检查：

- 点击区域可用；
- Tab / Drawer / Dialog 等状态正确；
- 表单输入、校验、提交；
- 提交中状态；
- 防重复提交；
- 错误提示可理解；
- 操作完成后数据状态真实变化，而不是只改变视觉高亮；
- 返回页面时状态是否按产品预期恢复。

### 8.4 资源

检查：

- 图片、图标、字体等静态资源路径正确；
- production build 下资源可加载；
- 不出现指向本地绝对路径的资源；
- 不出现阻塞性的 console error；
- 缺失资源不会导致核心流程失效。

---

## 9. App WebView 测试

Browser 通过之后，涉及 App 使用的功能必须进入真实 WebView 验证。

### 9.1 设备覆盖原则

采用 **代表性设备 / 系统版本** 策略，不追求穷举所有机型。

优先级：

1. 公司已有真机；
2. 当前主流 / 关键目标系统版本；
3. 已知问题机型或系统；
4. 模拟器补充缺口。

真机负责真实交互和宿主行为，模拟器不替代关键 Native 集成验收。

每次发布不要求机械跑完所有历史设备，但关键业务应至少覆盖目标 Android 和 iOS 环境；具体矩阵随真实用户分布和公司设备池调整。

### 9.2 安全区与布局

检查：

- 顶部状态栏 / 刘海 / Dynamic Island 等安全区；
- 底部 Home Indicator；
- 固定按钮不被遮挡；
- 页面高度计算；
- 横竖屏策略；
- WebView 是否出现异常缩放；
- 系统字体放大对关键页面的影响（如 App 允许继承）。

### 9.3 键盘与输入

检查：

- 键盘弹起不遮挡当前输入项；
- 主操作按钮仍可访问；
- 长表单能滚动到当前字段；
- 键盘收起后布局恢复；
- Android / iOS 输入行为差异；
- 密码 / 数字 / 普通文本键盘类型符合实际业务要求；
- 输入法切换不导致永久错位。

### 9.4 滚动

检查：

- 主页面滚动；
- 固定头部 / 底部；
- 嵌套滚动；
- 弹层打开时背景滚动；
- iOS 回弹；
- 长列表；
- 页面返回后滚动位置是否符合产品预期。

### 9.5 返回与生命周期

检查：

- H5 内部返回；
- App 系统返回；
- Android 系统返回键；
- WebView 关闭；
- App 切后台 / 回前台；
- Native 页面跳转后回到 H5；
- H5 页面重新创建；
- 页面恢复时数据刷新 / 保留行为。

具体行为以最终宿主协议为准，本文不假设 Native 一定提供某种方法。

### 9.6 缓存与版本

检查：

- 当前 WebView 实际加载哪个 H5 版本可以定位；
- 发布后是否存在旧资源缓存；
- HTML 与静态资源是否出现版本错配；
- 重启 App / 重新打开 WebView 后版本是否一致；
- 出现问题时能够根据 H5 commit / deployment 追踪。

---

## 10. 真实 API 测试

### 10.1 基础场景

至少关注：

- 正常返回；
- 空数据；
- 参数错误；
- 未登录；
- 登录过期；
- 无权限；
- 业务错误；
- 4xx；
- 5xx；
- 网络断开；
- 超时；
- 慢请求；
- 返回字段缺失；
- 返回字段类型异常；
- 重复请求；
- 页面离开后请求返回。

### 10.2 前端请求边界

已确定的工程原则：

> 凡是 H5 能稳定、合规、安全地直接请求的业务接口，由 H5 自己请求。

普通业务 HTTP 不通过 Native 代理。

即：

```text
H5 → Axios / service → Backend API
```

而不是：

```text
H5 → JSBridge → Native → Backend API
```

只有后续确认存在设备凭证、特殊网络、安全策略等明确约束时，才允许例外，并需单独记录原因与测试方案。

### 10.3 副作用接口

涉及以下类型时，需要根据真实协议补充专项测试：

- 支付；
- 充值；
- 核销；
- 兑换；
- 设备启动；
- 重要资料提交；
- 其他不可简单撤销的行为。

至少应考虑：

- 重复点击；
- 重复请求；
- 请求超时但服务端已成功；
- 用户返回 / 关闭页面；
- 失败后的恢复；
- 结果确认。

具体幂等方案由后端契约决定，前端测试计划不提前虚构实现。

---

## 11. JSBridge 测试

Bridge 的职责只覆盖 **宿主 / 设备 / Native 能力**。

HTTP 请求默认不属于 Bridge。

### 11.1 每项能力的最低验证

对于已经确认的 Bridge 能力，检查：

- Bridge 是否已注入；
- capability detection 是否准确；
- 参数是否按协议传递；
- 成功结果；
- Native 返回失败；
- 用户取消（如果协议定义）；
- 超时；
- 能力不存在；
- App 版本不支持；
- 连续调用；
- 重复点击；
- 页面退出后 callback 返回；
- Bridge 注入晚于 H5 初始化；
- Android / iOS 协议差异。

### 11.2 Bridge Mock

Browser Mock 必须通过与真实 Bridge 相同的 H5 上层接口调用。

例如页面只认：

```text
bridge.scan(...)
```

而不是页面自己判断：

```text
if browser → fakeScan()
if app     → nativeScan()
```

测试记录必须明确：

```text
BRIDGE_MODE = mock
```

Mock Bridge 通过不能标记为 Native 集成完成。

### 11.3 能力矩阵模板

| Bridge 能力 | Browser Mock | Android Native | iOS Native | 最低 App 版本 | 失败 / fallback | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| `<confirmed-capability>` | 待填 | 待验证 | 待验证 | 待确认 | 待确认 | Draft |

只填写真实确认的能力，不提前造表。

---

## 12. 状态管理、存储和 Hooks 的测试边界

### 12.1 Zustand

已确定：客户端全局状态优先 Zustand。

测试重点不是 Zustand 本身，而是：

- 有业务意义的状态转换；
- reset 行为；
- 用户切换；
- 跨页面流程状态；
- 异常后恢复。

后端数据不默认复制进 Zustand，因此不要为重复缓存结构制造额外测试面。

### 12.2 storage adapter

页面不直接操作 `localStorage` / `sessionStorage`。

测试 adapter：

- get / set / remove；
- JSON 序列化异常；
- 缺失 key；
- 版本升级；
- 存储不可用；
- 敏感数据未被错误持久化。

普通规则：

```text
localStorage   → 少量非敏感持久数据
sessionStorage → 一次 WebView 会话数据
IndexedDB      → 有明确大量数据 / 离线需求后再引入
```

敏感长期凭证、支付密码等不进入普通 H5 Web Storage。

### 12.3 Hooks

React 原生 Hooks + 自定义业务 Hooks 为主，通用场景可按需使用 ahooks。

测试业务 Hook 时优先验证：

- 输入 / 输出契约；
- loading / success / error；
- 卸载后的异步回调；
- 与 service / store / bridge 的边界。

不要测试第三方 Hook 库内部实现。

---

## 13. 表单和运行时数据校验

已确定方向：

```text
React Hook Form + Zod
```

复杂表单重点覆盖：

- 初始值；
- 必填；
- 格式；
- 边界长度；
- 联动字段；
- submit 中重复点击；
- 后端业务错误；
- 表单回填；
- 页面返回后的数据策略。

Zod 适合用于外部数据边界，包括：

- API response；
- Mock response；
- Bridge response；
- 表单 payload；
- 必要的存储恢复数据。

不是所有内部对象都需要机械做 runtime parse，应优先守住外部输入边界。

---

## 14. 错误测试

目标错误体系：统一 `AppError` / 错误归一层 + React Error Boundary。

至少区分：

```text
Network Error
HTTP Error
Business Error
Validation Error
Bridge Error
Unexpected UI Error
```

测试重点：

- 用户看到的错误信息是否可理解；
- 开发日志是否保留可定位信息；
- 错误是否导致整个 App 白屏；
- 是否错误地吞掉关键失败；
- 是否出现失败后 UI 仍显示成功；
- 页面重试是否真正重新执行请求。

未来如接入 Sentry，应作为线上诊断能力补充，而不是替代测试。

---

## 15. 网络与弱网场景

由于 H5 运行在 App WebView，关键流程需要考虑真实移动网络。

建议按业务风险验证：

- Wi-Fi / 蜂窝切换；
- 短暂断网；
- 高延迟；
- 请求超时；
- 请求返回顺序变化；
- 用户快速返回；
- App 退到后台期间请求完成。

Mock 的 `slow` / `timeout` 用于稳定复现 UI 行为；最终关键流程仍需要真实网络环境抽查。

---

## 16. 自动化测试策略

### 16.1 当前已具备

当前 `package.json` 已有：

```text
Playwright
npm run test:e2e
npm run test:e2e:ui
npm run typecheck
npm run build
npm run build:dev
npm run build:prod
```

### 16.2 已确定、待落地

后续补：

```text
MSW
Vitest
React Testing Library
```

不要在依赖尚未安装时把这些测试写成 CI 必过项。

### 16.3 自动化优先级

优先自动化：

1. 高频回归核心流程；
2. 容易因改动破坏的公共 service / store / adapter；
3. Mock 的关键异常场景；
4. 关键路由；
5. 无需真机即可稳定复现的问题。

低优先级：

- 纯静态页面的无意义 DOM 断言；
- 为覆盖率而覆盖第三方库；
- 极易变化但业务价值低的视觉细节选择器。

### 16.4 覆盖率

覆盖率是观察指标，不作为单一 KPI。

如果未来设置覆盖率门槛，应按模块风险设置，而不是为了达到总百分比制造测试。

---

## 17. CI 门禁

CI 最低负责确认：

- install 成功；
- typecheck；
- image verification；
- dev / prod build；
- smoke；
- SPA fallback；
- 已接入的稳定自动化测试。

CI 不负责宣称：

- 真机 WebView 已通过；
- Native Bridge 已通过；
- 真实业务 API 已通过；
- 产品负责人已经验收。

---

## 18. `dev → test` 晋级门槛

进入 `test` 前至少确认：

- 本次范围明确；
- 对应 H5 commit SHA 可定位；
- typecheck 通过；
- build 通过；
- 与本次变更相关的自动化已运行，或记录不适用原因；
- 核心 Browser 流程通过；
- 已知阻塞问题已记录；
- 当前数据模式明确；
- 当前 Bridge 模式明确；
- 需要真实 API 的功能已有可测试接口；
- 尚未确认的 Native 能力没有被描述成“已完成”。

Cloudflare `dev` 的 Mock 页面通过，可以作为开发阶段证据，但不能单独作为进入生产的依据。

---

## 19. `test → prod` 发布门槛

进入 `prod` 前至少确认：

- 发布范围明确；
- H5 commit SHA 明确；
- App version / build 可定位；
- 部署产物可定位；
- CI 基础门槛通过；
- 关键业务路径在目标 App WebView 中通过；
- 本次涉及的真实 API 已完成联调；
- 本次涉及的 Native Bridge 已在对应目标平台验证；
- Mock 没有作为真实业务兜底；
- 无未接受的 P0 / P1；
- P2 / P3 有明确记录和接受结论；
- 已知限制有记录。

某层确实不适用时，必须写：

```text
N/A + 原因
```

不能留空后默认算通过。

---

## 20. 缺陷等级

### P0 Blocker

- 无法启动；
- 核心流程完全不可用；
- 造成严重数据 / 资金 / 安全风险；
- 无法继续验收。

### P1 Major

- 核心业务错误；
- 重要 API / Bridge 能力不可用；
- 主流程高概率失败；
- 用户容易进入不可恢复状态。

### P2 Normal

- 非核心功能或部分场景错误；
- 存在明确替代路径；
- 对主流程影响有限。

### P3 Minor

- 轻微视觉；
- 文案；
- 较低影响体验问题。

严重性按照 **业务影响** 判断，不按开发修复难度判断。

---

## 21. 验收证据

正式 App 联调 / 发布候选至少记录：

```text
H5 branch:
H5 commit SHA:
H5 build / deployment:
App version / build:
Platform: Android | iOS
Device:
OS version:
Runtime: Browser | App WebView
API environment:
DATA_MODE: mock | api
BRIDGE_MODE: mock | native
Test scope:
Critical scenarios:
Result: PASS | FAIL | BLOCKED
Known issues:
Evidence links / screenshots:
Tester:
Date:
```

如果 App / Bridge 暂无正式版本号，记录当时可追踪的 build、commit 或其他真实标识，不虚构编号。

---

## 22. 场景记录模板

单个关键场景可以记录为：

```text
Scenario:
Preconditions:
Environment:
Device / OS:
H5 commit:
API mode:
Bridge mode:
Steps:
Expected:
Actual:
Result:
Evidence:
Issue / Task:
```

不要求所有小测试都写长文档；关键发布路径、失败案例和需要跨团队确认的结果必须可追踪。

---

## 23. 推荐发布冒烟集

每个 release candidate 至少跑一轮与本次发布相关的核心冒烟。

通用冒烟建议包括：

- App 打开 H5；
- H5 首屏正常渲染；
- 核心路由可进入；
- 真实登录 / 身份上下文可用（协议确定后）；
- 一个主要查询流程；
- 一个主要提交流程；
- 一个错误 / 弱网恢复场景；
- 本次新增 Bridge 能力；
- Android 返回；
- iOS 返回 / 关闭；
- App 后台 → 前台恢复；
- 当前 H5 版本可定位。

具体业务冒烟项随产品功能增加，不在本计划中提前虚构业务名称。

---

## 24. 与台账系统的关系

`docs/workbench/` 负责：

- 需求；
- 任务；
- 决策；
- 缺陷；
- 验收证据；
- 用户最终接受。

本文负责：

> 一个 H5 实现从工程和集成角度验证到什么程度，才有资格晋级。

两者关系：

- UI 历史任务已验收，不自动等于 API / WebView / Bridge 已验收；
- CI 通过不自动等于用户接受；
- 测试证据应链接回对应任务 / 缺陷；
- 只有用户明确确认，任务才可以进入最终 Accepted 状态。

旧 UI 任务的归档 / 保留方式仍按后续台账治理决定，本文不改写其历史状态。

---

## 25. 当前实施状态

截至本文本次更新，方案与代码现状必须分开看。

### 已存在

- Playwright E2E 基础；
- typecheck；
- image asset verification；
- dev / prod build；
- smoke / SPA fallback 基础检查；
- `preview → dev → test → prod` 分支治理文档。

### 已确定但尚需工程落地 / 核实

- Axios 统一 HTTP client；
- service layer；
- Zustand；
- storage adapter；
- React/custom hooks + ahooks；
- Zod；
- React Hook Form；
- MSW；
- JSBridge adapter + Mock Bridge；
- Vitest；
- React Testing Library；
- 统一错误体系；
- OpenAPI 类型 / 契约生成（后端提供契约后）。

不得因为本文写下目标方案，就把尚未进入 `package.json` / 源码的能力描述成已经完成。

---

## 26. 最终测试原则摘要

```text
UI 真相        → preview
正式开发       → dev
App 集成验收   → test
正式发布       → prod

Local dev API  → Mock / Real 可选
CF dev API     → Mock 固定
test API       → Real 为主
prod API       → Real

API Mock       → MSW
Bridge Mock    → 独立 bridge adapter mock
Mock Server    → 当前不建设

HTTP           → H5 自己请求
Native 能力    → JSBridge

Browser PASS   ≠ WebView PASS
Mock PASS      ≠ Real API PASS
Mock Bridge    ≠ Native Bridge PASS
CI PASS        ≠ Product Accepted
```

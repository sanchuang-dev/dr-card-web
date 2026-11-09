# 卡博士 H5 分支与发布节奏

`dr-card-web` 已从高保真 UI 工程进入正式 **App 内嵌 H5 前端**阶段（npm 包名暂保留为 `dr-card-ui`）。长期分支固定为：

```text
preview → dev → test → prod
```

四条分支不是同义备份，而是四个不同职责的事实层。

## 1. `preview` — UI 真相

`preview` 是卡博士 UI 的实现真相源，也是视觉施工与移动端预览验收入口。

适合进入 `preview` 的内容：

- 页面视觉、布局、交互状态与响应式表现；
- Com Design Token、公共 UI 组件和品牌素材；
- 经确认的 Mockplus 原型还原与 UI 修订；
- 与 UI 验收直接相关的 fixture、截图和验证脚本。

规则：

- UI 施工默认从 `preview` 开始；
- `dev` / `test` / `prod` 中出现的临时业务实现不得反向覆盖已确认 UI；
- 如果下游实现形成新的产品或 UI 决策，应把该决策作为独立变更同步回 `preview`，而不是整分支反向合并；
- `preview` 可使用稳定 fixture / mock 完成独立视觉验收，但这些数据不代表真实后台契约。

## 2. `dev` — H5 正式开发与工程集成

`dev` 接收已经确认可进入开发阶段的 `preview` 变更，承载正式 H5 业务实现。

典型内容包括：

- API / service / repository 数据层；
- `mock | api` 数据源切换；
- JSBridge adapter / protocol 与浏览器 Mock；
- 鉴权、路由、状态管理、错误处理；
- 与后端、设备、宿主 App、第三方服务的开发联调；
- 不改变既定 UI 结论的工程实现。

规则：

- 页面不直接散落调用宿主原生对象；
- 页面不直接绑定某一套临时 Mock 结构；
- Mock 与真实 API / Bridge 应通过统一业务接口暴露；
- 不臆造宿主 App 能力；
- `dev` 不替代 `preview` 成为视觉事实源。

## 3. `test` — App 内嵌联调与验收

`test` 只接收准备进入系统测试、App WebView 联调、回归或业务验收的 `dev` 版本。

测试至少区分：

```text
浏览器 H5
App WebView
真实 API
JSBridge / 宿主能力
```

规则：

- 不在 `test` 上进行常规功能开发；
- 测试发现的问题优先回到 `dev` 修复，再重新晋级；
- 紧急测试修复若必须发生在 `test`，应尽快同步回 `dev`；
- CI 通过只证明自动化检查通过，不等于 App 内嵌验收通过；
- 进入 `prod` 前应记录至少包括：H5 commit、App 版本 / 构建、测试平台、关键 Bridge / API 验证结果、已知问题。

详细测试契约见 `docs/testing/test-plan.md`。

## 4. `prod` — 正式 H5 发布

`prod` 是生产 H5 发布真相源，只接收已经通过 `test` 验收的版本。

规则：

- 禁止日常开发直接提交到 `prod`；
- 禁止 `preview` 或 `dev` 跳级进入 `prod`；
- `prod` 不得依赖 Mock 数据或 Mock Bridge 作为真实业务兜底；
- 生产热修复必须保留清晰记录，并同步回上游对应分支，防止后续发布丢失。

## 5. 晋级规则

正常晋级路径只有：

```text
preview → dev
dev     → test
test    → prod
```

每次跨阶段晋级原则上通过 Pull Request 完成，并满足目标阶段的检查与验收。

禁止把四条长期分支当作并行开发分支，也不要通过整分支反向合并把下游临时实现倒灌到上游。

## 6. 临时分支

功能、实验、修复可以使用短期分支：

```text
feature/*
fix/*
experiment/*
docs/*
```

短期分支应从其目标阶段的事实源创建，并在合并或放弃后删除。

JSBridge 独立验证可以使用 `experiment/jsbridge-*` 一类分支。现有 `jsbrigge-test` / `bridge` 属历史实验线，未经检查其差异与目的，不应强制重置或删除。

## 7. Mock 与环境关系

Mock 是开发能力，不是发布环境。

推荐语义：

```text
DATA_MODE   = mock | api
BRIDGE_MODE = mock | native
```

- `preview`：通常使用稳定 Mock / fixture 保障 UI 可独立运行；
- `dev`：允许 Mock 与真实实现切换；
- `test`：原则上以真实 API + App WebView / Native Bridge 为主，Mock 只用于故障复现和明确测试场景；
- `prod`：不得用 Mock 掩盖真实依赖失败。

## 8. `main` 的过渡状态

仓库历史上的 `main` 暂时保留，用作旧入口与历史基线，不再承担新的开发、测试或生产职责。

待四层流程稳定、部署入口和默认分支完成迁移后，再单独决定是否归档或删除 `main`。迁移完成前不要继续向 `main` 施工。

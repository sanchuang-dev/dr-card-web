# 卡博士项目工作台

这里管理项目施工过程中的需求、任务、决策、证据与验收记录。

项目已经从 UI 高保真阶段进入 **App 内嵌 H5 正式开发阶段**，工作台的治理原则继续保留：

```text
需求 → 决策 → 任务 → 实现 → 验证 → 用户 / 业务验收 → 历史记录
```

## 工作台负责什么

- 保存已经确认的需求与决策依据；
- 把实现工作拆成可验收任务；
- 记录阻塞、依赖与变更；
- 保存必要的截图、提交号、测试结果与已知差异；
- 防止新需求静默改写已经验收的历史结论。

工作台不是简单 TODO 列表，也不是用任务状态替代 Git 分支或测试环境。

## 当前项目阶段

长期工程链路为：

```text
preview → dev → test → prod
```

截至 2026-09-22，项目当前进入 **页面级精修 + 原生 H5 联调阶段**。后端尚未开始，真实 backend base URL、认证方式和业务 API 契约仍未进入实施；相关页面可以继续基于已确认事实和明确标识的 Mock 进行精修与联调准备，但不得把 Mock 或浏览器结果写成真实后端 / Native 已接通。

后续正式开发任务除了 UI / 交互证据外，还可能需要记录：

- Mock / API 数据模式；
- API 联调状态；
- JSBridge 协议与真实宿主验证；
- App WebView / 平台验证；
- H5 commit SHA 与 App build 的对应关系；
- 测试与发布结论。

工程测试门槛见 [`../testing/test-plan.md`](../testing/test-plan.md)，代码边界见 [`../engineering/coding-standards.md`](../engineering/coding-standards.md)。

## 当前目录

```text
workbench/
├── README.md
├── task-ledger.md
├── tasks/                  # 当前 H5 工程任务
├── archive/
│   └── ui-phase/           # 已冻结的 UI 阶段台账
├── decisions/
├── acceptance/
├── evidence/
├── evidence-matrix.md
└── route-table.md
```

## 状态与验收规范

正式任务状态规则以 [`task-ledger.md`](./task-ledger.md) 为准。

重要原则：

- 一个明确目标对应可追踪任务；
- 大任务拆成可以验证的小任务；
- 设计 / 产品问题先记录决策，再编码；
- 任务完成必须有与风险相匹配的验证方式；
- 智能体自审不能替代用户或业务验收；
- 已验收历史任务不因后续需求变化而被静默重写；
- 单张任务卡只验本卡建立的能力，不把历史全页面复验塞进局部工程卡。

## UI 阶段归档

原 T001–T052、R 系列等 UI / 高保真阶段任务已冻结归档至 [`archive/ui-phase/`](./archive/ui-phase/)。历史文件保持原内容，不重新编号、不修饰旧状态，也不因当前工程规则变化而改写旧结论。

相关 `evidence/`、`acceptance/`、`decisions/`、验收报告与证据矩阵继续保留在原位置，作为可追溯历史材料。

从本阶段开始：

- `tasks/` 只承载当前 App 内嵌 H5 工程任务；
- `legacy` / Native reference 页面默认不进入正式 H5 施工、重构与业务验收；
- `/mall` 当前作为 iframe + SSO 容器纳入 active formal-H5 工程范围；商城页面内容、SSO 与 App WebView 仍待联调验收。`/mall/goods/:id`、`/mall/cart` 子路由仍 deferred；
- 新任务不得依赖历史 UI 卡的编号状态作为当前产品事实源。

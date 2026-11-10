# 卡博士 App 内嵌 H5

`dr-card-web`（内部 npm 包名仍为 `dr-card-ui`）是 **卡博士原生 App 内嵌的 H5 前端工程**。项目最初用于高保真 UI 施工，目前已经进入正式工程开发阶段：继续保留 Mockplus / `preview` 作为 UI 真相，同时在 `dev` 接入真实 API、业务状态和 JSBridge，并通过 App WebView 联调后进入生产。

## 分支节奏

长期分支固定为：

```text
preview → dev → test → prod
```

- `preview`：UI 真相、视觉施工、交互状态和预览验收。
- `dev`：H5 正式开发；API、业务状态、Mock/API 切换、JSBridge 与宿主能力集成。
- `test`：App WebView / JSBridge / API 联调、回归与业务验收。
- `prod`：正式 H5 发布真相源。

正常晋级只走相邻方向，并原则上通过 Pull Request 完成。历史 `main` 暂时仅作为旧入口与历史基线保留。

详细规则见 [`docs/workflow/branch-strategy.md`](./docs/workflow/branch-strategy.md)。

## 技术栈

- Vite
- React 18
- TypeScript
- React Router
- Tailwind CSS
- Lucide React
- Com Design 金色 / 橙色语义 Token

## 运行模式

正式开发必须把“页面”和“数据/宿主实现”分开。页面不应因为后台尚未完成而直接内嵌临时假数据，也不应直接散落调用原生对象。

工程按两个独立维度切换：

```text
业务数据：mock | api
宿主能力：mock | native
```

- **API Mock**：后台未就绪时支持独立开发、视觉验收和错误场景验证。
- **JSBridge Mock**：浏览器环境下模拟已经确认的宿主协议；不得臆造 App 不存在的能力。
- `prod` 不允许用 Mock 数据作为真实业务兜底。

具体工程约束见 [`docs/engineering/coding-standards.md`](./docs/engineering/coding-standards.md)。

## 设计事实源

UI 仍然是正式交付的一部分，而不是工程接入后的次要事项。

事实优先级：

1. 当前任务中用户明确确认的结论；
2. 已确认的 Mockplus 原型与 `preview` 页面实现；
3. [`docs/prototype/`](./docs/prototype/) 原型语言；
4. Com Design Token / 公共组件约束；
5. 已验收页面实现；
6. [`不靠谱的设计历史/`](./不靠谱的设计历史/) 历史参考；
7. 实现者自己的推断。

当前设计基线见 [`docs/design/design-baseline.md`](./docs/design/design-baseline.md)。历史详细原型整理仍保留在 [`设计文档.md`](./设计文档.md)，不因项目工程化而删除。

## 测试与发布

浏览器能打开、CI 绿灯都不等于可以发布。正式 H5 至少需要区分：

```text
浏览器 H5 → App WebView → JSBridge / 真接口 → test 验收 → prod
```

测试计划见 [`docs/testing/test-plan.md`](./docs/testing/test-plan.md)。

## 台账系统

`docs/workbench/` 继续保留需求、设计决策、任务、证据和验收的治理规范。历史 UI 任务的归档 / 清理方式尚未最终决定，因此当前不擅自删除或改写历史验收记录。

智能体自检通过不等于用户验收通过。

## 常用检查

```bash
npm run typecheck
npm run build
npm run test:e2e
```

按任务实际范围执行对应检查；纯文档变更无需为了形式强行修改业务代码。

# AI Review 约定

本仓库允许多 AI reviewer 并存，但自动 review 与自动改代码必须分开。

## 当前角色

- Codex Review：仓库已有的 PR 自动 reviewer，继续保留。
- OpenCode Review：第二 reviewer，只读审查 PR，不自动提交代码。
- 人工 / 产品验收：AI review 不能替代用户 `Accepted`。

## OpenCode 自动 Review

工作流：`.github/workflows/opencode-review.yml`

触发：

- 目标分支为 `dev` 的 PR；
- `opened` / `reopened` / `ready_for_review`；
- Ready 状态下后续 `synchronize` 更新；
- Draft PR 不运行。

并发策略：同一个 PR 只保留最新一次 review run，旧 run 自动取消，避免重复花费。

权限：

- `contents: read`
- `pull-requests: write`（仅用于发表 review）

不授予 `contents: write`，因此自动 review 不具备向仓库提交代码的权限。

## Provider / Model

默认模型：`opencode-go/kimi-k3`

默认凭据：GitHub Actions secret `OPENCODE_API_KEY`。

也预留以下 provider secret：

- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `OPENROUTER_API_KEY`

如果希望换模型，在 GitHub Actions repository variable 中设置：

`OPENCODE_REVIEW_MODEL=<provider>/<model>`

例如换到其它 provider 时，只修改 variable 并补对应 secret，不需要重写 review workflow。

如果没有配置任何支持的 provider secret，OpenCode job 会明确显示 skipped notice，但不会让正常 CI 失败。

## Review 原则

OpenCode 必须先遵守根目录 `AGENTS.md`，并重点检查：

- 正确性与真实回归；
- formal H5 / Native reference 边界；
- 环境、路由、状态、数据安全问题；
- 会造成 CI 假通过或假失败的问题；
- 与当前已确认工程契约冲突的问题。

默认忽略：

- 单纯代码风格意见；
- 无收益的大规模重构；
- legacy / Native reference 内部卫生（除非本 PR 修改它或污染 formal H5）；
- 商城运行行为（仅当 PR 明确施工时 review；`/mall` 已是 active formal-H5 路由，但非商城行为改动不因此扩大审查范围）；
- 为覆盖率数字补测试；
- 重新验收历史 UI；
- 自行发明 backend / auth / JSBridge 协议。

## 自动 Review 与自动施工

自动 PR review 永远保持只读。

未来若启用 `/oc` / `/opencode` 修改代码能力，应使用独立 workflow，并显式授予写权限；不要把写权限塞进自动 review workflow。

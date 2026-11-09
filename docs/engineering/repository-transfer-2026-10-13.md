# 2026-10-13 · GitHub 仓库所有权转移验收记录

> 当前仓库：`sanchuang-dev/dr-card-web`；来源：`dangjingtao/dr-card-ui`。原生 GitHub Transfer + 同时重命名，不是新建仓库或复制历史。

## 已有只读证据（转移后）

- GitHub 仓库 ID 未变：`1341342340`；目标 owner 为 `sanchuang-dev`；当前连接可管理员访问。
- 分支提交保持不变：`main@aec60b6e`、`preview@4df9cf0e`、`dev@2605a6e9`、`test@25ebe33c`、`prod@7895d1c4`。
- Issue #82 / #171、未合并 PR #198 均可在新路径读取；七个 Workflow YAML 仍在。
- 旧 GitHub 仓库地址经 API 解析到新 owner；现有历史 Issue/PR 链接由 GitHub 重定向。历史审计快照保留当时仓库名称，**不要全量改写历史证据**。
- 公网只读探测：`https://kbs.3cgroup.cn/kbs-web/{dev,test,prod/last}/` 分别 HTTP 200；`https://test.dr-card-ui.pages.dev/` HTTP 200。
- `/kbs-web/test/build-meta.json` 仍是迁移前已成功发布的 `test@25ebe33ca26334ac94f731ebd4dacf921daf0be9`、Run `38235724425.1`。**这证明旧站未中断，但不证明迁移后新运行能部署。**

## 尚需实际验证的切换门槛

- [ ] 在新 owner 的 PR 上观察 GitHub Build/Test gate 是否真实运行成功，不能仅看转移前历史 Actions。
- [ ] 在新 owner 的 PR 上观察 OpenCode / Codex / 其他审查 App 的授权与执行；不把 Review skipped 视为 PASS。
- [ ] Cloudflare Git 集成是否会对新仓库、新 PR 产生构建/检查；若失效，由有权限者重新授权或绑定，旧 Cloudflare 项目和域名不删除。
- [ ] 新 owner 的 `oss-ui` / `oss-dev` / `oss-test` / `oss-production` GitHub Environments、Secrets、Variables 的可用性，经**受控新分支提交/部署**验证；不读取/输出密钥明文，也不以旧成功 Run 代替。
- [ ] 新 owner 上的 `dev` 非生产 OSS push 成功后，核对公开 `build-meta.json` SHA 与 readback；`test` 仅在正常晋级后验证。
- [ ] 生产发布、Health Gate、历史与回滚链路独立验证；未经明确授权不向 `prod` 推送。
- [ ] 协作成员检查本地 Git `origin` 或自动化里的旧 repository slug。GitHub 会重定向，但建议主动改为 `https://github.com/sanchuang-dev/dr-card-web.git`；不自动修改其他人的工作区。

## 保持不变的边界

- `preview` 是独立 UI 事实源，不要求与 `dev/test/prod` 同 SHA；只按既定晋级规则操作。
- OSS Bucket `kbs-sdl`、固定 URL `kbs.3cgroup.cn/kbs-web/`、Cloudflare 项目地址、原 App WebView 地址不随仓库更名改变。
- 不删旧 OSS 目录，不改 Git 历史，不重新建 Issue/PR，不重置任一分支。

本记录用于迁移验收与后续追踪；尚未逐项勾选的外部部署/授权行为不得表述为已通过。

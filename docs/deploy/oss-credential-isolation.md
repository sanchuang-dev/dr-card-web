# OSS 发布密钥环境隔离 · 2026-10-13

关联：[OPS #209](https://github.com/sanchuang-dev/dr-card-web/issues/209)、[发布验收 #171](https://github.com/sanchuang-dev/dr-card-web/issues/171)。

## 当前事实与完成度

- GitHub Environment 分支准入已经直接设置并读回：`oss-ui: preview`、`oss-dev: dev`、`oss-test: test`、`oss-production: prod`。
- **尚未完成真实密钥隔离。** `oss-ui/dev/test` 目前没有各自独立 RAM AccessKey 的 Environment Secrets；仓库级 `OSS_ACCESS_KEY_ID/OSS_ACCESS_KEY_SECRET` 仍存在。生产环境有自己的同名 Secrets。
- GitHub 的同名 Secret 查找顺序是 **Environment > Repository > Organization**。所以给环境新增同名 Secret 后会优先使用它，但在删除仓库级 Secret 前仍可能出现意外 fallback。不得仅凭 job 的 Environment 名称宣称密钥隔离完成。
- 迁移到 `sanchuang-dev/dr-card-web` 后的 OSS `dev` 推送已经成功过（Run [#38337673847](https://github.com/sanchuang-dev/dr-card-web/actions/runs/38337673847)，41 文件校验），但这次使用的仍可能是仓库级密钥；它不是 RAM 范围隔离的证明。

## 三套非生产 RAM 身份（不得共用同一 AccessKey）

| GitHub Environment | 唯一分支 | RAM 用户建议名 | 唯一允许的 OSS 对象前缀 | 示例权限策略 |
| --- | --- | --- | --- | --- |
| `oss-ui` | `preview` | `kbs-web-ui-deployer` | `kbs-sdl/kbs-web/ui/*` | [oss-ui.json](./ram-policies/oss-ui.json) |
| `oss-dev` | `dev` | `kbs-web-dev-deployer` | `kbs-sdl/kbs-web/dev/*` | [oss-dev.json](./ram-policies/oss-dev.json) |
| `oss-test` | `test` | `kbs-web-test-deployer` | `kbs-sdl/kbs-web/test/*` | [oss-test.json](./ram-policies/oss-test.json) |

建议用专用 RAM 用户，**仅关联本表对应的自定义策略**，不关联 `AliyunOSSFullAccess` 等广泛授权。每个身份签发一个独立 AccessKey。策略只授予该前缀 `ListObjects`（限制 Prefix 条件）、`GetObject`、`PutObject`；默认**没有** `DeleteObject` 和跨环境权限。阿里云 RAM 官方示例：[基于 RAM Policy 控制 OSS 访问](https://help.aliyun.com/zh/oss/user-guide/access-control-base-on-ram-policy)。

> 以上示例基于当前 `scripts/deploy-oss-web-nonprod.mjs` 的上传与逐文件下载验证。首次真实部署时如果因缺少其它非破坏性 Action 失败，依据实际 OSS 错误做最小增补，不直接授予全 Bucket 写权限。单独确认 RAM 用户未获得继承的宽权限。

## 无中断切换顺序

1. 阿里云 RAM 管理员创建三套独立身份与策略；分别生成 AccessKey，不把密钥写到 Issue、PR、日志、仓库、`.env.*` 或 `VITE_*`。
2. 分别进入 [GitHub Environments](https://github.com/sanchuang-dev/dr-card-web/settings/environments) 的 `oss-ui` / `oss-dev` / `oss-test`，写入 **Environment secrets**（不是 Variables）：
   - `OSS_ACCESS_KEY_ID`
   - `OSS_ACCESS_KEY_SECRET`
3. 用匹配分支的受控 push（`preview`、`dev`、`test`）完成各环境 OSS 文件读回与公司域名 `build-meta.json` SHA 验证；这些 push 会真发布，请按正常晋级纪律安排，**不得为了验证直接推送生产**。
4. 在 RAM 权限验证中确保：`dev` 密钥不能读/写 `test` 或 `prod` 等其它前缀，`test` 和 `ui` 同理；不得做有破坏性的“拒绝性测试”。
5. 所有新凭据验证通过且确认没有旧密钥依赖或在途 workflow 后，删除**仓库级** `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET`，让凭据只能来自各自环境；再次受控部署复验。
6. 检查旧仓库级密钥对应的阿里云 RAM AK 是否仍被其它系统依赖；确认迁移后由云账号管理员禁用/轮换旧 AK。**仅从 GitHub 删除 Secret 不等于 RAM AK 失效。**

## 生产与非敏感变量

- `oss-production` 已有独立同名 Environment Secrets，且只允许 `prod` 分支。其 RAM 身份还需核验最小权限和历史/回滚实际需要的 `DeleteObject` 边界；**本次不改生产 IAM、Secrets、触发规则或历史数据**。
- `OSS_API_BASE_URL`、`OSS_PUBLIC_ORIGIN`、`OSS_PROD_API_BASE_URL`、`OSS_PROD_PUBLIC_ORIGIN`、`VITE_API_BASE_URL` 是前端构建可见 URL；应当保留为 GitHub Variables（不是 Secrets），并检查目标环境和继承优先级。
- `OSS_PUBLIC_ORIGIN` 在仓库和 `oss-test` 的环境列表中没有单独看到，但历史 test 部署成功；可能由**组织级 Variables** 提供。当前组织级读取被 403 拒绝，在有组织管理权限者核实前，不要用旧 Cloudflare 域名覆盖它。
- `CLOUDFLARE_API_TOKEN`、`OPENCODE_API_KEY` 等供应商令牌仍为 Secrets；`CLOUDFLARE_ACCOUNT_ID` 只是账号标识，保留 Secret 也不影响安全。

**状态：GitHub 环境分支隔离已完成；RAM 独立 AK 签发、Environment Secrets 配置、跨前缀权限验证与仓库级旧 Secret 退役均未完成。**

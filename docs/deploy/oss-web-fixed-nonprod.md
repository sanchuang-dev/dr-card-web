# KBS Web OSS 固定路径（#168 非生产施工）

> **后续更新（#170）**：本文关于「prod 仅构建、不得发布」是 #168 施工当时的阶段性边界，不再是当前规则。生产固定入口已由 #170 工作流管理，允许 prod push 或从选定分支手动发布；无需额外开关、强制 HTTPS 或正式生产 API 前置。详见 `docs/deploy/oss-prod-health-gate.md`。本页其余非生产约束仍保持。

上层设计 #167，后续生产历史/回滚 #169、发布 Healthcheck #170。本文只定义 `ui/dev/test` 的实现与公司权限交接；**不激活正式生产 `prod/last`**。

## 固定前缀

Bucket `kbs-sdl`（`cn-guangzhou`）：

| Git 分支 | OSS 目录 | 构建目标 | 数据 / 宿主 |
| --- | --- | --- | --- |
| `preview` | `kbs-web/ui/` | `preview` | Mock / Disabled |
| `dev` | `kbs-web/dev/` | `dev` | 默认 Mock / Disabled |
| `test` | `kbs-web/test/` | `test` | API 模式 / Native；API 连通性单独验收 |
| `prod` | `kbs-web/prod/last/` | `prod` | **仅构建验证，暂不接入新部署** |

示例：`http://kbs.3cgroup.cn/kbs-web/ui/` 等需要公司端将 URL 精确映射到上述对象前缀，且服务器对 SPA 路由做对应目录的 fallback，不能把静态资源 404 伪装成 HTML。优先启用 HTTPS。当前属于待公司验证的**目标地址**，不能用 CI 成功代替公网真实页面验证。

在 `scripts/build-h5.mjs` 以 `H5_OSS_ARTIFACT=1 OSS_WEB_TARGET=ui|dev|test|prod` **显式**触发前缀构建，内部自动注入固定 basename 与 `build-meta.json.ossWeb`。新固定路径构建使用绝对资源前缀（如 `/kbs-web/ui/assets/`），确保 SPA 多级路由直接刷新后资源仍从环境根目录加载。旧 OSS 不可变发布包继续使用 `./assets/`；Cloudflare 仍用 `/assets/`，三种模式互不改变。旧 `h5/releases/<sha>/<run>/` 生产 OSS 工作流不受影响。

## GitHub 环境准备（必须由仓库/云账号管理员完成）

**#171 更新**：非生产推送会实际尝试上传；取消 `OSS_WEB_NONPROD_ENABLED` 开关。缺少 OSS 凭据时部署作业明确失败，不能用 CI 打包成功代替真实发布。当前可由 Repository secrets 统一提供 OSS AK；`oss-ui/dev/test` Environment 继续承载环境边界，未来如需更强 RAM 隔离，可用同名 Environment secrets 覆盖。发布脚本不做对象删除。

首次执行自动部署前，在 GitHub Settings → Environments 创建：

- `oss-ui`：只允许 `preview` 分支；
- `oss-dev`：只允许 `dev` 分支；
- `oss-test`：只允许 `test` 分支。

当前可以使用 Repository-level OSS 凭据完成非生产固定目录发布；代码仍强制 `preview→ui`、`dev→dev`、`test→test`，且不执行删除。若后续需要云侧最小权限隔离，再为三个 Environment 配置同名、仅限各自前缀的 RAM 凭据即可，无需改变工作流。

| GitHub 参数 | 类型 | 要求 |
| --- | --- | --- |
| `OSS_ACCESS_KEY_ID` | Repository 或 Environment Secret | OSS 写/读凭据；Environment 同名值可覆盖仓库级值 |
| `OSS_ACCESS_KEY_SECRET` | Repository 或 Environment Secret | 对应密钥，不进入源代码、`VITE_*` 或公开日志 |

缺少 OSS 凭据时部署作业**明确失败**。测试 API / 邀请 Origin 不再作为静态包上传前置：固定目录可以先落 OSS 并完成人工页面验证，`build-meta.json` 会如实记录 API / Origin 是否配置；真实业务连通性继续在 #171 单独验收。项目原有 `Build` 与 CF 部署工作流继续保留。

## CI / 发布流程

工作流 `.github/workflows/oss-web-nonprod.yml`：

1. PR 上无密钥的包测试分别生成 `ui/dev/test/prod` 四种固定路径构建，逐个校验 JS/CSS 和 Router basename、runtime 模式与 Mock Worker。
2. 各非生产分支 push 后，仅构建**对应**的目标，成功才进入受该 GitHub Environment 管理的部署作业。 `prod` 根本不在部署触发列表中。
3. 真实部署核对分支 SHA、目标前缀和密钥；如分支有新提交、旧 CI 重跑，拒绝切入口。
4. 上传/读回验证每一个文件（包括静态资源）；`build-meta.json` 在最后阶段写入，`index.html` **最后写入**。已有前一版的入口与元数据在更新中断时尽力恢复；无旧版对象则不假装有历史可回滚。
5. **不执行 OSS delete / rm**，不改其他环境，不修改 Bucket ACL。旧带哈希资源暂时保留，保护已打开旧 HTML 的用户；后续非生产无引用资源的安全清理须有缓存窗口和真实验证，不能先清空。
6. 公司域名的 TLS、代理、API/Bridge 及前缀可访问性必须在实际测试中确认。

## 边界与待确认项目

- **本卡未重写生产流程**：现有 `oss-production.yml` 仍写旧不可变版本目录；#169/#170 联合接入并完成安全门禁前不得切换 `prod/last`。
- 现有 Cloudflare 构建及站点仍按原配置运行。
- OSS 上原 `h5/releases/`、`_ci-smoke/` 等文件不动，无任何批量删除。
- UI/Dev 的 Mock Service Worker URL 随 Router basename 解析，Cloudflare 根路径不变；Test 不允许 Mock。
- 固定入口更新按对象顺序，不是多文件原子事务。若使用 CDN 缓存、灰度回滚、长时在用资源，需按 #171 真人验收记录范围与风险。
- 实际账号权限、各环境 Secret、HTTPS/反向代理映射、真实环境访问/JSBridge 属外部前置条件（#80）；缺失即保持待验收，不声称已上生产。

# 卡博士生产 H5：OSS 发布准备

## 事实与边界

- 前端仓库：`sanchuang-dev/dr-card-web`。
- OSS Bucket：`kbs-sdl`，地域：`cn-guangzhou`，API Endpoint：`https://oss-cn-guangzhou.aliyuncs.com`。
- 构建：`npm run build:prod`，构建产物：`dist/`。
- 发布来源：仅 `prod` 分支。晋级沿用 `preview → dev → test → prod`，不得跳级。
- OSS 默认域名 `https://kbs-sdl.oss-cn-guangzhou.aliyuncs.com` **只能当存储 API / 文件入口，不能当正式 H5 页面入口**；阿里云默认域名访问 HTML 会触发强制下载。
- 当前工作流只将构建产物上传到 `oss://kbs-sdl/h5/releases/<SHA>/<run-id>.<run-attempt>/`，每次运行使用独立目录、不覆盖已有版本、不删除文件、**不会切换 App 的线上入口**。
- `VITE_BUDDY_PUBLIC_ORIGIN` 用于二维码公开入口，不能填 OSS 默认域名；需要另有可正常打开 HTML 的 HTTPS 网站域名。

## GitHub CI 工作流

`.github/workflows/oss-production.yml`：

1. 所有针对 `dev/test/prod` 的 PR 均使用 `example.invalid` **仅校验生产包生成**，不访问云端，也不读云端密钥。
2. `prod` 更新后，先验证生产包，再触发 `upload-oss`。
3. `upload-oss` 需要 `oss-production` Environment 配置和授权，使用正式环境变量重新构建。
4. 上传到按 SHA 和 CI Run Attempt 唯一标识的隔离目录后，用 `ossutil stat` 检查首页文件和构建元数据。
5. 不自动执行 `ossutil rm`，也不变更 Bucket ACL、CDN、DNS 或 App 配置。

此阶段的 CI 绿灯只代表构建和上传链路通过；**不是** App WebView、真实 API、JSBridge 或产品上线验收。

## 云账号/仓库管理员配置

在 GitHub 仓库 `Settings → Environments` 新建 `oss-production`，建议配置 Required reviewers，将 Environment 限制为 `prod` 分支。

在该 Environment 设置：

| 类型 | 名称 | 值 |
| --- | --- | --- |
| Secret | `OSS_ACCESS_KEY_ID` | 公司 RAM 用户的 AccessKey ID |
| Secret | `OSS_ACCESS_KEY_SECRET` | 对应 AccessKey Secret，不得贴入 Issue/PR/聊天 |
| Variable | `OSS_PROD_API_BASE_URL` | 正式后端 HTTPS API 地址 |
| Variable | `OSS_PROD_PUBLIC_ORIGIN` | 未来可在浏览器/WebView 正常加载的正式 HTTPS 站点 Origin |

凭证只需访问 `kbs-sdl` 指定的 `h5/releases/*` 前缀；推荐独立 RAM 最小权限或 OIDC 临时凭证。**不要使用阿里云主账号密钥，也不要将凭证放进任何 `VITE_*` 变量。**

完成配置后，按原有 `test → prod` 验收晋级触发 OSS 上传；此工作流不会作为线上生效/域名切换按钮。正式网站仍需独立规划可浏览 HTML 的访问域名和 SPA 路由策略。

## 后续上线门槛

- 确定正式可用域名、HTTPS、内地备案、可用的 SPA fallback。
- 生产 API 的 CORS、鉴权与 App 白名单已适配该域名。
- CDN/OSS 资源缓存与哈希资源发布方式已验证，原子发布/回滚方案已确定。
- Android/iOS 真机 WebView + Native Bridge + 真实接口验收记录齐全。
- 不能以 GitHub CI 测试绿灯替代真机/业务验收。

阿里云参考：
- https://help.aliyun.com/zh/oss/developer-reference/ossutil-overview/
- https://help.aliyun.com/zh/oss/developer-reference/upload-objects-6
- https://help.aliyun.com/zh/oss/user-guide/regions-and-endpoints

## 已知限制：广州 Bucket 的默认公网 Endpoint

阿里云于 2025-03-20 生效的策略可能限制**新开通 OSS 服务的用户**通过内地 Bucket 默认公网域名执行数据类 API（含上传）；老 OSS 用户不受此限制。仅凭拥有 Bucket 和 AccessKey 无法确定账号是否受限。
如果 CI 中上传返回 `PublicEndpointForbidden`，应由公司管理员按官方方案配置自定义 OSS API 域名或授权可用的企业部署接入方式；**不要**绕过政策或把临时测试地址当成正式域名。详见 https://www.alibabacloud.com/zh/notice/oss_update_notice_policy_change_in_calling_data_api_operations_via_the_default_public_domain_name_45a

当前上传地址只是企业对象存储，不是用户可浏览的 H5 页面 URL；不能把默认 Bucket 域名填入 `OSS_PROD_PUBLIC_ORIGIN`。

## 2026-10-09 OSS 连通性验证（不属于上线）

本阶段用户明确只想验证 GitHub Actions 能否使用公司凭证访问广州 Bucket，不要求 OSS 默认域名直接渲染 H5。
公开 Origin 暂时填写 `https://kbs-sdl.oss-cn-guangzhou.aliyuncs.com` 不影响**独立连通性探针**，但生产流水线保留默认域名的上线拦截。

专用工作流 `.github/workflows/oss-connection-smoke.yml` 仅在文件首次随正常晋级进入 `prod` 或之后被修改时触发，调用 `oss-production` Environment 中已配置的两项 Secret，把一小段证明文本写入 `h5/releases/_ci-smoke/<run-id>.<attempt>/proof.txt`，执行 stat 和读回字节比较。不会部署任何业务 H5 文件、修改域名、清空 Bucket、晋级 `prod`。

由于此次探针在 `prod` 分支运行，GitHub Environment 保持 **仅允许 `prod`** 即可，不需要临时开放 `dev`；已知之前一次从 `dev` 触发的探针在启动前失败。`test` 仍只做构建和真实 App 验收，不读取生产凭证。正常晋级依旧需要 `dev → test → prod`，不为了执行探针跳级。

可能遇到的 `PublicEndpointForbidden` 是 OSS 内地公共 Endpoint 使用限制，应走公司云账号官方支持的接入方案，不能把错误归因于前端或擅自改到个人账户。

本轮使用 OSS 默认域名作为临时 `OSS_PROD_PUBLIC_ORIGIN`，**正式生产上传**工作流仍会有意拒绝该域名；`OSS Connection Smoke` 成功表示凭证与 OSS 数据操作可用，不代表 H5 正式发版成功。若发行 CI 因域名被拒绝，须区分这是预期上线门禁，不应为使其变绿而篡改判定。

## 2026-10-10 后台静态站点版本目录白屏修复

后台提供的浏览器入口采用形如：
`http://kbs.3cgroup.cn/h5/releases/<sha>/<run-id>.<attempt>/`

此前 Vite 默认 `base: '/'`，会把 `index.html` 的 JS/CSS 引到 `/assets/...`，忽略版本前缀，浏览器出现 HTML 200 但 JS/CSS 请求 404、空白页面。

OSS Release Pipeline 现专属注入：

- `H5_OSS_ARTIFACT=1`：Vite 构建为 `base: './'`，index 的资源路径为 `./assets/...`；其他 Cloudflare、test、dev 构建维持根路径行为；
- `VITE_ROUTER_BASENAME=/h5/releases/<sha>/<run-id>.<attempt>`：React Router 匹配、内部导航落在对应的隔离发布目录；
- PR CI 与实际上传 CI 均验证资源引用与 basename。每次发布继续创建独立 SHA/Run 目录，不覆盖原制品。

**部署端必须配合：**

1. 建议 `https://kbs.3cgroup.cn` 提供有效 TLS 证书。原生 WebView 对明文 HTTP 可能存在安全策略限制；H5 和 API 应尽量都是 HTTPS。
2. URL 使用单斜杠 `/h5/releases/...`；后台提供的 `//h5/` 多余斜杠可能导致代理层路由差异。
3. 所有 `/h5/releases/<sha>/<run>/assets/*` 需要正确回源到该目录的 JS/CSS，类型分别为 JS 和 CSS。服务端**只针对该版本前缀**配置 history fallback 到对应 `index.html`，保证刷新二级 H5 路由不 404；不可把 CSS/JS 缺失时也错误地 fallback 成 HTML。
4. `test/prod` H5 还有 **Native Host Gate**，裸浏览器即使资源加载成功，可能显示“请在 App 内使用”之类提示；此为运行时预期，不等于空白页面修复失败。
5. 本次只修复构建路径/路由基址，不意味着真实 API、邀请二维码公开页面和 WebView 已全部通过验收。

# 原生 WebView · OSS 静态入口直达协议

卡博士 H5 在 OSS 上以固定静态对象 `index.html` 作为 WebView 初次加载入口；深层 BrowserRouter 路由不是 OSS 对象，不能直接作为网络初始 URL。

## 入口示例

- 生产人工客服：`https://kbs.3cgroup.cn/kbs-web/prod/last/index.html?redirect=%2Fservice%2Fchat%2Fhuman`
- 生产普通首页：`https://kbs.3cgroup.cn/kbs-web/prod/last/index.html`
- 其它环境：将 `/kbs-web/prod/last/` 替换为同环境的 `/kbs-web/test/`、`/kbs-web/dev/` 等前缀。

## 规则

- 参数名为 `redirect`（准确拼写），值为 URL 编码的 **H5 内部绝对业务路由路径**，如 `/service/chat/human`，可附带该业务页的查询参数和 hash。
- 不带参数时，`/index.html` 是正常首页入口，不执行任何导航；传统根路径 `/` 同样不受影响。
- 有有效参数时，根路径和 `/index.html` 在 React Router 初始 loader 阶段执行 replace。首页组件不挂载，也不增加返回历史记录。
- 拒绝完整外部 URL、跨环境前缀、根目录、未知路由、Native 参考、延期页面和 Debug 页面。无效参数不跳转。
- `test/prod` 的 Native WebView 宿主门禁在 Router 启动之前执行，不会被参数绕过。
- Router 跳转后地址为 Browser History 真实业务路径，页面刷新、进程恢复重新请求深层路径时，仍要求 CDN/网关按环境配置 SPA rewrite（见 #80/#171）；原生每次新开 WebView 应使用静态入口 URL。
- 入口跳转只保证 H5 路由可达，不代表人工客服的真实 Socket/API 已完成业务验收。

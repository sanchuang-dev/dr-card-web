import type { LucideIcon } from 'lucide-react'
import { CircleDot, Headset, Home, QrCode, UserRound } from 'lucide-react'

/**
 * T004 路由注册表（单一事实源）
 * -------------------------------------------------------------
 * 把 60 个实施节点映射到「路由 + fixture 状态 / overlay」。
 * 业务页视觉由 T005–T013 各自完成；本注册表只负责路径、节点、入口、
 * 返回目标、状态参数与任务卡归属，保证每个节点可复现定位。
 *
 * 主导航决策（2026-08-21 用户确认，记录于 docs/workbench/route-table.md）：
 * - 保留底部 Tab：首页 / 卡包 / 兑换 / 我的（用户确认"不靠谱的设计历史"中的
 *   Tab 结构为可靠参考，主入口为 APP 首页）。
 * - 根路由 `/` = APP 首页；`/dearseed` = 独立的诗得丽专栏。
 * - H5 商城（#17/#48/#49）承载为 WebView 边界页。
 * - 2026-08-28 用户确认：底部 Tab `/mall` 文案由「服务」改为「商城」；会员中心重新作为
 *   「我的 → 快捷服务」入口开放，`/membership` 恢复挂载既有会员中心页面，不新建页面。
 * - T021（2026-08-27 需求变更 §2）：根路由 `/` 由「卡博士 APP 首页」改为「极地种子品牌专栏」
 *   首页，删除金刚区并迁入 `/checkin` 打卡内容；`/dearseed` 仍保留为已验收的独立专栏页，
 *   不修改 T005 历史结论。`/` 新增的新人体验券状态与弹层是需求新增内容，摹客原型无对应
 *   artboard，故 node 占位 0（未决口径见 fixtures 的 NEWCOMER_COUPON_RULE_STATUS）。
 */

export type OverlayType = 'dialog' | 'sheet'
export type RouteLeadingAction = 'auto' | 'back' | 'close' | 'none'
export type RouteImplementationKey = 'membership' | 'claim-success'
export type RouteImplementationVariant = 'campaign' | 'onboarding'

export interface RouteState {
  /** URL `?state=` 取值 */
  key: string
  /** 对应摹客节点 */
  node: number
  /** 状态说明 */
  label: string
}

export interface RouteOverlay {
  /** URL `?overlay=` 取值 */
  key: string
  /** 对应摹客节点 */
  node: number
  label: string
  type: OverlayType
}

export interface RouteMeta {
  path: string
  /** 是否一级 Tab（显示底部导航） */
  tab?: boolean
  /** 一级 Tab 从左到右顺序 */
  tabOrder?: number
  /** 是否为中间凸起的主操作 */
  tabFab?: boolean
  /** Tab 标签 */
  label?: string
  icon?: LucideIcon
  /** TopAppBar / 页面标题 */
  title: string
  /** 标题栏模式；默认二级页为 back */
  titleBar?: 'plain' | 'back' | 'hidden'
  /** 标题栏展示文案与页面业务标题不同时单独指定 */
  titleBarTitle?: string
  /**
   * App 标题栏左侧动作。
   * auto：active formal H5 一级 Tab → close；二级 back 标题栏 → back；plain/hidden → none。
   * close 只表达“退出当前 WebView”意图，真实宿主能力仍由 JSBridge adapter 决定。
   */
  leadingAction?: RouteLeadingAction
  /** 标题栏右侧动作 */
  titleBarAction?: 'settings' | 'notifications'
  /** H022：合法多 URL 共用同一页面实现时使用，不用复制页面组件。 */
  implementationKey?: RouteImplementationKey
  /** 同一实现允许的轻量内容分支；不得用它承载另一套页面实现。 */
  implementationVariant?: RouteImplementationVariant
  /** 本路由承载的实施节点 */
  nodes: number[]
  /** 所属任务卡 */
  task: string
  /** 入口描述 */
  entry?: string
  /** 返回目标 */
  returnTo?: string
  /** 返回按钮跳转路径（不传则走 history.back） */
  backTo?: string
  /** 确定性 fixture 状态（`?state=`） */
  states?: RouteState[]
  /** 可复现弹层（`?overlay=`） */
  overlays?: RouteOverlay[]
  /** 边界类型：H5 WebView 边界页 */
  boundary?: 'webview'
  /** 该路径不再承载自身页面，直接重定向到目标路径（`replace`） */
  redirectTo?: string
  /** 页面归属说明 */
  owner?: string
}

export const ROUTES: RouteMeta[] = [
  /* ────────── 一级 Tab：以 reference/首页.html 的五项 TabBar 为准 ────────── */
  {
    path: '/',
    tab: true,
    tabOrder: 1,
    label: '首页',
    icon: Home,
    /* T021：需求 §2.1–§2.2 要求根首页改为「极地种子品牌专栏」并删除金刚区 */
    title: '极地种子品牌专栏',
    titleBar: 'plain',
    titleBarTitle: '极地种子品牌专栏',
    /* T021 为需求变更新增内容，摹客原型无对应 artboard，故节点留空、下列状态/弹层 node 占位 0 */
    nodes: [],
    task: 'T021',
    entry: 'APP 主入口',
    returnTo: '—（根首页）',
    /*
     * 首页新人券演示弹窗已关闭。正式券数需等待 APP 用户信息与跨后台用户识别接口，
     * `?newcomer=off` 仅保留为历史取证兼容参数，不代表线上业务开关。
     */
    states: [
      { key: 'coupon-1', node: 0, label: '新人券-1 张' },
      { key: 'coupon-2', node: 0, label: '新人券-2 张' },
    ],
    overlays: [
      { key: 'newcomer-coupon', node: 0, label: '新人体验券弹窗', type: 'dialog' },
      { key: 'coupon-success', node: 0, label: '体验券领取成功', type: 'dialog' },
      /* 打卡内容随 CheckinBoard 迁入后，补签这个主要操作也在首页自持反馈（需求 §2.3），节点沿用 /checkin 的 #22 */
      { key: 'make-up-success', node: 22, label: '补打卡成功弹窗', type: 'dialog' },
    ],
    owner: '极地种子品牌专栏首页（T021 改造；打卡内容与 /checkin 共用 CheckinBoard；新人券演示弹窗暂时关闭）',
  },
  {
    path: '/legacy-home',
    title: '首页',
    titleBar: 'hidden',
    titleBarTitle: '首页',
    nodes: [],
    task: 'T033',
    entry: '卡博士APP首页（四金刚区：淋浴/洗烘/饮水/吹风）',
    returnTo: '—（独立入口）',
    owner: '卡博士APP首页（T033；原 legacy-home 设计，四金刚区跳转设备列表）',
  },
  {
    path: '/legacy-home/scan',
    title: '扫一扫',
    titleBar: 'hidden',
    nodes: [],
    task: 'T033',
    entry: '历史首页-扫一扫；设备列表-立即扫码',
    returnTo: '历史首页 / 设备列表',
    owner: '历史首页独立扫码页，与 /card/verify 券码核销链路不共用；T033 设备服务扫码复用此页',
  },

  /* ────────────────────────── T036 四大设备功能页面 ────────────────────────── */
  {
    path: '/device/:type',
    title: '设备列表',
    titleBar: 'hidden',
    nodes: [],
    task: 'T036',
    entry: '首页四金刚区 → 淋浴/洗烘/饮水/吹风 设备列表',
    returnTo: '卡博士APP首页',
    owner: '设备列表页（T036；四套设备共用列表组件，按 type 切换主题色与设备数据）',
  },
  {
    path: '/device/connecting',
    title: '设备详情',
    titleBar: 'hidden',
    nodes: [],
    task: 'T036',
    entry: '设备列表 → 设备详情（连接中态）',
    returnTo: '设备列表',
    owner: '设备详情页（T036；金额选择、启动流程、结算、紧急停止、保修悬浮球）',
  },
  {
    path: '/device/success',
    title: '设备详情',
    titleBar: 'hidden',
    nodes: [],
    task: 'T036',
    entry: '设备详情 → 启动成功态',
    returnTo: '设备列表',
    owner: '设备详情页（T036；启动成功 / 结算展示态）',
  },
  /* T042：自助售货机扫码购买页 */
  {
    path: '/vending/buy',
    title: '扫码购买',
    titleBar: 'back',
    backTo: '/legacy-home',
    nodes: [],
    task: 'T042',
    entry: '扫码自助售货机 / 设备列表 → 扫码购买 / 首页扫一扫 → 模拟购买洗发水',
    returnTo: '卡博士APP首页',
    owner: '自助售货机购买页（T042；3款洗发水 + 数量 + 优惠券自动抵扣 + 去结算）',
  },
  {
    path: '/vending/order',
    title: '确认订单',
    titleBar: 'back',
    nodes: [],
    task: 'T042',
    entry: '购买页 → 去结算',
    returnTo: '购买页',
    owner: '售货机订单确认页（T042；金额明细 + 微信/支付宝选择 + 出货中/成功弹窗）',
  },

  /* ────────────────────────── T034 卡博士服务中心 ────────────────────────── */
  {
    path: '/legacy-service',
    title: '服务中心',
    titleBar: 'hidden',
    nodes: [],
    task: 'T034',
    entry: '底部 Tab「服务」',
    returnTo: '—（一级 Tab）',
    owner: '卡博士服务中心首页（T034；设备报修/意见反馈/热门问题）',
  },
  {
    path: '/legacy-service/repair/projects',
    title: '设备报修项目',
    titleBar: 'hidden',
    nodes: [],
    task: 'T034',
    entry: '服务中心-设备报修',
    returnTo: '服务中心',
    owner: '设备报修项目列表（T034）',
  },
  {
    path: '/legacy-service/repair/form',
    title: '报修',
    titleBar: 'hidden',
    nodes: [],
    task: 'T034',
    entry: '报修项目-报修按钮',
    returnTo: '报修项目列表',
    owner: '报修表单页（T034；设备编号/位置/故障现象/详情/电话/提交）',
  },
  {
    path: '/legacy-service/feedback',
    title: '意见反馈',
    titleBar: 'hidden',
    nodes: [],
    task: 'T034',
    entry: '服务中心-意见反馈',
    returnTo: '服务中心',
    owner: '意见反馈页（T034；文本框+提交）',
  },

  /* ────────────────────────── T035 卡博士个人中心 ────────────────────────── */
  {
    path: '/legacy-profile',
    title: '我的',
    titleBar: 'hidden',
    nodes: [],
    task: 'T035',
    entry: '底部 Tab「我的」',
    returnTo: '—（一级 Tab）',
    owner: '卡博士个人中心首页（T035；头像+订单五宫格+快捷功能四宫格）',
  },
  {
    path: '/legacy-profile/info',
    title: '个人信息',
    titleBar: 'hidden',
    nodes: [],
    task: 'T035',
    entry: '个人中心-头像/昵称',
    returnTo: '个人中心',
    owner: '个人信息页（T035；二维码+账号+头像/用户名/昵称/姓名/手机/邮箱）',
  },
  {
    path: '/legacy-profile/nickname',
    title: '修改昵称',
    titleBar: 'hidden',
    nodes: [],
    task: 'T035',
    entry: '个人信息-昵称',
    returnTo: '个人信息',
    owner: '修改昵称页（T035）',
  },
  {
    path: '/legacy-profile/email',
    title: '绑定邮箱',
    titleBar: 'hidden',
    nodes: [],
    task: 'T035',
    entry: '个人信息-邮箱',
    returnTo: '个人信息',
    owner: '绑定邮箱页（T035；邮箱+验证码+获取验证码+绑定）',
  },
  {
    path: '/legacy-profile/phone',
    title: '绑定手机',
    titleBar: 'hidden',
    nodes: [],
    task: 'T035',
    entry: '个人信息-手机',
    returnTo: '个人信息',
    owner: '绑定手机页（T035；手机号+验证码+密码+绑定）',
  },
  {
    path: '/legacy-profile/settings',
    title: '设置',
    titleBar: 'hidden',
    nodes: [],
    task: 'T035',
    entry: '个人中心-设置齿轮',
    returnTo: '个人中心',
    owner: '设置页（T035；退款/退款记录/支付配置/修改密码/在线设备/协议/隐私/注销+退出登录）',
  },
  {
    path: '/legacy-profile/orders',
    title: '订单',
    titleBar: 'hidden',
    nodes: [],
    task: 'T035',
    entry: '个人中心-我的订单',
    returnTo: '个人中心',
    owner: '订单列表页（T035；六 Tab 切换 + 订单卡片 + 空状态）',
  },
  {
    path: '/legacy-profile/receipts',
    title: '我的小票',
    titleBar: 'hidden',
    nodes: [],
    task: 'T035',
    entry: '个人中心-我的小票',
    returnTo: '个人中心',
    owner: '我的小票列表（T035；年月筛选 + 小票卡片列表）',
  },
  {
    path: '/legacy-profile/receipts/:id',
    title: '小票详情',
    titleBar: 'hidden',
    nodes: [],
    task: 'T035',
    entry: '我的小票-详情',
    returnTo: '我的小票',
    owner: '小票详情页（T035；小票头部 + 消费明细 + 支付详情）',
  },
  {
    path: '/legacy-profile/devices/:type',
    title: '设备列表',
    titleBar: 'hidden',
    nodes: [],
    task: 'T035',
    entry: '个人中心-常用设备/收藏设备',
    returnTo: '个人中心',
    owner: '常用设备/收藏设备列表（T035；设备卡片 + 状态标签 + 收藏星标）',
  },

  /* ────────────────────────── T026 注册登录与个人信息 ────────────────────────── */
  {
    path: '/legacy-profile/avatar-edit',
    title: '修改头像',
    titleBar: 'hidden',
    nodes: [],
    task: 'T026',
    entry: '个人信息-头像',
    returnTo: '个人信息',
    owner: '修改头像页（T026；9 宫格预置头像 + 相册/拍照 + 28×28 预览 + 淡金保存）',
  },
  {
    path: '/legacy-profile/phone-change',
    title: '换绑手机号',
    titleBar: 'hidden',
    nodes: [],
    task: 'T026',
    entry: '个人信息-手机',
    returnTo: '个人信息',
    owner: '换绑手机号流程页（T026；三步式：原号验证 → 新号验证 → 换绑成功）',
  },
  {
    path: '/legacy-profile/login',
    title: '登录',
    titleBar: 'hidden',
    nodes: [],
    task: 'T037',
    entry: '个人中心-设置-退出登录 / 未登录状态',
    returnTo: '个人中心',
    owner: '登录页（T037；卡博士淡金色风格：账号 + 密码 + 二次确认密码 + 睁眼/闭眼切换 + 5 次错误显示图形验证码 + 微信授权 + 登录后弹窗引导绑定学校/专业/学号）',
  },
  {
    path: '/legacy-profile/edit',
    title: '编辑资料',
    titleBar: 'hidden',
    nodes: [],
    task: 'T026',
    entry: '个人信息-头像 / 真实姓名',
    returnTo: '个人信息',
    owner: '编辑资料页（T026；合一编辑 头像 / 昵称 / 真实姓名，含 9 宫格头像选择 + 字长度校验 + 加载态 + 保存回写 store）',
  },
  {
    path: '/legacy-profile/bind-school',
    title: '绑定学校信息',
    titleBar: 'hidden',
    nodes: [],
    task: 'T037',
    entry: '登录页绑定引导弹窗-去绑定',
    returnTo: '个人中心',
    owner: '绑定学校信息页（T037；卡博士淡金色风格：学校选择 + 学院输入 + 学号校验，保存回写 userInfoStore 后跳 /legacy-profile）',
  },
  {
    path: '/legacy-profile/register',
    title: '注册账号',
    titleBar: 'hidden',
    nodes: [],
    task: 'T037',
    entry: '登录页底部「还没有账号？请注册」',
    returnTo: '登录',
    owner: '注册账号页（T037；卡博士淡金色风格：手机号 + 验证码 + 密码 + 二次确认密码；注册成功后 isRegistered=true 并弹窗引导绑定学校/专业/学号）',
  },
  {
    path: '/legacy-profile/forgot-password',
    title: '忘记密码',
    titleBar: 'hidden',
    nodes: [],
    task: 'T037',
    entry: '登录页「忘记密码？」入口',
    returnTo: '登录',
    owner: '忘记密码页（T037；卡博士淡金色风格：手机号 + 短信验证码（演示固定 123456）+ 图形验证码（固定显示）+ 新密码 + 确认新密码，两个密码框均带小眼睛明密文切换；提交后弹窗"修改成功"并自动返回登录页）',
  },
  {
    path: '/legacy-profile/machine-pin',
    title: '消费密码',
    titleBar: 'hidden',
    nodes: [],
    task: 'T039',
    entry: '「我的」-消费密码',
    returnTo: '我的',
    owner: '设置消费密码页（T039；卡博士淡金色风格：内部 phase 状态机 set/verify/menu/change/delete + 当前密码首尾掩码 + 6 格方框输入 + 修改走二步式 + 删除直清空 + 右下角原型状态切换按钮；写入 userInfoStore.pin）',
  },
  {
    path: '/legacy-profile/scratch-card',
    title: '刮刮充值卡',
    titleBar: 'hidden',
    nodes: [],
    task: 'T038',
    entry: '「我的」-刮刮充值卡',
    returnTo: '我的',
    owner: '刮刮充值卡页（T038；卡博士淡金色风格：顶部金色渐变 + 10位充值码输入 + 扫码按钮 + 金渐变充值按钮 + 充值成功弹窗；扫码跳 /legacy-home/scan 后 2s 回弹弹窗；mock 校验 10 位数字）',
  },

  /* ────────────────────────── T031 卡券与优惠卡 ────────────────────────── */
  {
    path: '/legacy-profile/my-cards',
    title: '我的卡',
    titleBar: 'hidden',
    nodes: [],
    task: 'T031',
    entry: '「我的」-我的卡',
    returnTo: '我的',
    owner: '我的卡页（T031；「+ 绑定卡」按钮 + 列表空态，对齐原小程序）',
  },
  {
    path: '/legacy-profile/coupons',
    title: '优惠卡列表',
    titleBar: 'hidden',
    nodes: [],
    task: 'T031',
    entry: '「我的」-优惠卡',
    returnTo: '我的',
    owner: '优惠卡列表页（T031；三 Tab：未使用 / 已使用 / 已过期，对齐原小程序）',
  },

  /* ────────────────────────── T041 领款机反扫码充值 ────────────────────────── */
  {
    path: '/legacy-profile/pickup-machine',
    title: '领款机充值',
    titleBar: 'hidden',
    nodes: [],
    task: 'T041',
    entry: '「我的」-领款机充值',
    returnTo: '我的',
    owner: '领款机反扫码充值页（T041；mock 二维码 + 当前卡信息 + 三步操作说明；「我的」宫格第 8 项由报修替换而来；二维码内容 B-050 等业务接口到位后再换签名串）',
  },

  /* ────────────────────────── T025 积分商城与泡泡值体系统一 ────────────────────────── */
  {
    path: '/signin',
    title: '每日签到',
    titleBar: 'hidden',
    nodes: [],
    task: 'T025',
    entry: '首页-福袋悬浮按钮',
    returnTo: '首页',
    owner: '每日签到/薅羊毛主页（T025；淡金+红色+北极熊IP，广告mock，积分与泡泡值打通）',
  },
  {
    path: '/signin/detail',
    title: '积分明细',
    titleBar: 'hidden',
    nodes: [],
    task: 'T025',
    entry: '签到页-积分余额卡 / 积分明细入口',
    returnTo: '签到页',
    owner: '积分明细（卡博士版；与泡泡值共用 pointsStore，文案叫"积分"）',
  },

  /* ────────────────────────── T028 客服中心与退款 ────────────────────────── */
  {
    path: '/legacy-profile/customer-service',
    title: '客服中心',
    titleBar: 'hidden',
    nodes: [],
    task: 'T028',
    entry: '设置-在线客服（已跳转至诗得丽 /service/chat，本页面保留不再被业务入口使用）',
    returnTo: '设置',
    owner: '客服中心页（T028；当前业务入口（卡博士服务页 / 我的设置）均改跳诗得丽品牌专栏的 /service/chat；本页面作为过渡保留，地址栏直接访问仍可达）',
  },
  {
    path: '/legacy-profile/school-accounts',
    title: '我的小票',
    titleBar: 'hidden',
    nodes: [],
    task: 'T028',
    entry: '「我的」-我的小票',
    returnTo: '我的',
    owner: '学校账户列表页（T028；顶部淡金渐变：账号 + 总余额 + 小票记录；下方项目卡片：Building2 金色头像 + 项目名 + 小票余额/可退款金额/赠送金额 + 购买金色按钮 + 退款黑色按钮）',
  },
  {
    path: '/legacy-profile/recharge/:id',
    title: '充值',
    titleBar: 'hidden',
    nodes: [],
    task: 'T028',
    entry: '我的小票-项目卡-购买',
    returnTo: '我的小票',
    owner: '学校账户充值页（T028；金额选择 + 微信/支付宝支付，对应 RechargePage）',
  },
  {
    path: '/legacy-profile/school-refund/:id',
    title: '退款',
    titleBar: 'hidden',
    nodes: [],
    task: 'T028',
    entry: '我的小票-项目卡-退款',
    returnTo: '我的小票',
    owner: '学校账户退款页（T028；退款金额 + 退款原因 + 提交退款，对应 SchoolRefundPage）',
  },
  {
    path: '/legacy-profile/my-cards/:id',
    title: '卡详情',
    titleBar: 'hidden',
    nodes: [],
    task: 'T031',
    entry: '「我的」-我的卡-卡卡片',
    returnTo: '我的卡',
    owner: '卡详情页（T031 补充；卡信息列表 8 行：卡序号/卡所属项目/用户卡号/卡MAC/姓名/班级/学号/卡状态；姓名/班级/学号 可点击"修改"跳字段编辑；底部三操作：挂失/解挂 + 设置消费卡 → 充值退款页；点挂失/解挂 弹"您确定要…"确认框）',
  },
  {
    path: '/legacy-profile/my-cards/:id/topup',
    title: '充值/退款',
    titleBar: 'hidden',
    nodes: [],
    task: 'T029',
    entry: '卡详情页-「设置消费卡」或底部「去购买」',
    returnTo: '卡详情',
    owner: '卡的充值/退款页（T031 + T029；卡详情页"去购买"/"设置消费卡"入口，金额选择 + 微信/支付宝支付）',
  },
  {
    path: '/legacy-profile/my-cards/:id/topup/success',
    title: '充值成功',
    titleBar: 'hidden',
    nodes: [],
    task: 'T029',
    entry: '充值页支付成功',
    returnTo: '卡详情',
    owner: '充值成功反馈页（T029；绿勾 + 金额 + 支付方式 + 完成/查看充值记录）',
  },
  {
    path: '/legacy-profile/my-cards/:id/topup/fail',
    title: '充值失败',
    titleBar: 'hidden',
    nodes: [],
    task: 'T029',
    entry: '充值页支付失败 / mock 失败触发器',
    returnTo: '卡详情',
    owner: '充值失败反馈页（T029；红叉 + 失败原因 + 重新充值/返回卡详情）',
  },
  {
    path: '/legacy-profile/my-cards/:id/topup-records',
    title: '充值记录',
    titleBar: 'hidden',
    nodes: [],
    task: 'T029',
    entry: '卡详情-充值记录 / 充值成功页-查看充值记录',
    returnTo: '卡详情',
    owner: '充值记录列表（T029；顶部余额卡 + 流水列表：成功绿/失败红/进行中灰 + 金额 + 时间 + 支付方式）',
  },
  {
    path: '/legacy-profile/my-cards/:id/refund-records',
    title: '退款记录',
    titleBar: 'hidden',
    nodes: [],
    task: 'T029',
    entry: '卡详情-退款记录',
    returnTo: '卡详情',
    owner: '退款记录列表（T029；顶部余额卡 + 流水列表：红色 -¥ 退款 + 时间 + 退款渠道）',
  },
  {
    path: '/card',
    title: '卡包',
    titleBarTitle: '卡包',
    titleBar: 'back',
    nodes: [54, 62, 63, 64],
    task: 'T009',
    entry: '底部 Tab「卡包」；我的-卡包',
    returnTo: '底部 Tab；我的',
    states: [
      { key: 'available', node: 62, label: '卡包-可用' },
      { key: 'used', node: 63, label: '卡包-已使用' },
      { key: 'expired', node: 64, label: '卡包-已过期' },
    ],
    overlays: [{ key: 'use', node: 62, label: '使用方式选择', type: 'sheet' }],
    owner: '卡包（T009；reference 标准页）',
  },
  {
    path: '/exchange',
    title: '洗护体验券专区',
    nodes: [18, 37, 38],
    task: 'T008',
    entry: '底部 Tab「兑换」；首页-兑换商城',
    returnTo: '底部 Tab；首页',
    states: [
      { key: 'sort-exchange', node: 37, label: '兑换量排行' },
      { key: 'sort-points', node: 38, label: '泡泡值排行' },
    ],
    overlays: [{ key: 'redeem', node: 39, label: '体验券兑换弹窗', type: 'sheet' }],
    owner: '洗护体验券专区（T008 施工；语义已从「兑换码页」纠正）',
  },
  {
    /* T051v2-rollback + v3｜用户 2026-09-10 仅要求把文字改为「会员中心」（Tab label + 页面 TitleBar），
     * 不改路由 / 跳转 / Settings。tab / tabOrder / icon / path / Settings 全部保持原状。 */
    path: '/profile',
    tab: true,
    tabOrder: 5,
    label: '会员中心',
    icon: UserRound,
    title: '会员中心',
    titleBarAction: 'notifications',
    nodes: [19, 20],
    task: 'T011',
    entry: '底部 Tab「会员中心」+ TitleBar「会员中心」；首页-个人区',
    returnTo: '底部 Tab；首页',
    overlays: [{ key: 'app-prompt', node: 20, label: 'APP 弹窗（能力引导）', type: 'dialog' }],
    owner: '我的（T011 已施工；T051v2-rollback+v3 改 Tab label + TitleBar 文案，不改路由 / 跳转）',
  },

  /* ────────────────────────── T005 专栏首页与新人流程 ────────────────────────── */
  {
    path: '/dearseed',
    title: '诗得丽专栏',
    titleBarTitle: 'DearSeed',
    titleBarAction: 'notifications',
    nodes: [2, 23],
    task: 'T005',
    entry: '卡博士首页-「诗得丽品牌专栏」',
    returnTo: '卡博士首页',
    states: [{ key: 'claimed', node: 23, label: '领取完专栏状态' }],
    overlays: [
      { key: 'reminder', node: 4, label: '每日打卡提示', type: 'dialog' },
      { key: 'newcomer', node: 12, label: '新人弹窗', type: 'dialog' },
      { key: 'app-guide', node: 13, label: '引导弹窗（APP 下载）', type: 'dialog' },
    ],
    owner: '诗得丽品牌专栏独立业务首页（用户 2026-08-24 确认与 APP 首页分离）',
  },
  {
    path: '/onboarding',
    title: '完善信息',
    nodes: [14, 24],
    task: 'T005',
    entry: '首页-新人弹窗「去完善信息」',
    returnTo: '诗得丽专栏首页',
    states: [{ key: 'student', node: 24, label: '完善信息（学生）' }],
    owner: '完善信息分步 onboarding（T005 施工）',
  },
  {
    path: '/onboarding/success',
    implementationKey: 'claim-success',
    implementationVariant: 'onboarding',
    title: '填写完成后领取成功',
    /* 原型是叠在专栏首页上的成功弹窗，非独立页面：标题栏与首页一致，不出返回箭头 */
    titleBar: 'plain',
    titleBarTitle: 'DearSeed',
    nodes: [25],
    task: 'T005',
    entry: '完善信息「确认信息」提交成功',
    returnTo: '诗得丽专栏首页',
    owner: '新人资料完成后的权益反馈（T005 施工）',
  },
  {
    path: '/claim/success',
    implementationKey: 'claim-success',
    implementationVariant: 'campaign',
    title: '领取成功',
    /* 同 #25：专栏背景 + 遮罩 + 居中弹窗，标题栏沿用专栏 */
    titleBar: 'plain',
    titleBarTitle: 'DearSeed',
    nodes: [15],
    task: 'T005',
    entry: '诗得丽专栏-本期活动达标领取',
    returnTo: '诗得丽专栏首页（已领取态）',
    owner: '活动卡券领取反馈（T005 施工）',
  },
  {
    path: '/cause',
    title: '公益板块',
    nodes: [],
    task: 'T021',
    entry: '首页-公益板块',
    returnTo: '首页',
    owner: '公益富文本承载页（当前空内容；未来由统一数据层请求富文本）',
  },
  {
    path: '/brand-culture',
    title: '极地种子品牌故事',
    nodes: [16],
    task: 'T005',
    entry: '首页-极地种子品牌故事；诗得丽专栏-「品牌文化」',
    returnTo: '来源页（首页或诗得丽专栏）',
    owner: '品牌故事富文本承载页（当前空内容；未来由统一数据层请求富文本）',
  },

  /* ────────────────────────── T006 会员、泡泡值、打卡与澡运 ────────────────────────── */
  {
    path: '/points',
    tab: true,
    tabOrder: 2,
    label: '泡泡',
    icon: CircleDot,
    /* T022：本页改为「资产 + 泡泡福利 + 任务占位」，纯流水明细拆到 /points/detail */
    title: '泡泡值',
    nodes: [5],
    task: 'T006',
    entry: '诗得丽专栏/我的-泡泡值余额；会员中心',
    returnTo: '诗得丽专栏首页 / 我的',
    owner: '泡泡值资产与任务占位（T006 施工；T022 改造）',
  },
  {
    path: '/points/detail',
    title: '泡泡值明细',
    nodes: [5],
    task: 'T022',
    entry: '泡泡值-资产卡「看明细」',
    returnTo: '泡泡值',
    states: [
      { key: 'income', node: 5, label: '泡泡值明细-仅收入' },
      { key: 'expense', node: 5, label: '泡泡值明细-仅消耗' },
      { key: 'empty', node: 5, label: '泡泡值明细-无记录' },
    ],
    owner: '泡泡值纯流水明细（T022 施工；仅 Tab + 列表 + 空态）',
  },
  {
    /* T051v2-rollback｜v2 升格为底部 Tab 5 的改动已回滚；本页保持既有入口，不参与 Tab 5。 */
    path: '/membership',
    implementationKey: 'membership',
    title: '会员中心',
    titleBarTitle: '会员中心',
    nodes: [6],
    task: 'T006',
    entry: '我的-快捷服务「会员中心」',
    returnTo: '我的',
    owner: '会员中心（既有 T006 页面；2026-08-28 恢复入口，不新增页面）',
  },
  /* T046｜诗得丽专栏内会员中心入口：复用既有 Membership 组件，保持 T051 联动路由 slug */
  {
    path: '/dearseed/membership',
    implementationKey: 'membership',
    title: '会员中心',
    titleBarTitle: '会员中心',
    nodes: [6],
    task: 'T046',
    entry: '诗得丽专栏首页-右上角头像；中部会员卡；快捷入口「会员空间」',
    returnTo: '诗得丽专栏首页',
    owner: '诗得丽专栏内会员中心（复用 /membership 既有页面，T046 路线入口）',
  },
  {
    path: '/membership/levels',
    title: '会员等级',
    nodes: [26],
    task: 'T006',
    entry: '会员中心-「查看等级」',
    returnTo: '会员中心',
    owner: '会员等级展示稿（T006 施工）',
  },
  {
    path: '/checkin',
    title: '打卡日历',
    titleBarTitle: '每日打卡',
    nodes: [21, 8, 4, 22],
    task: 'T006',
    entry: '诗得丽专栏-本期活动「打卡」；会员中心',
    returnTo: '诗得丽专栏首页 / 会员中心',
    states: [{ key: 'success', node: 8, label: '打卡成功' }],
    overlays: [
      { key: 'reminder', node: 4, label: '打卡提示弹窗', type: 'dialog' },
      { key: 'make-up-success', node: 22, label: '补打卡成功弹窗', type: 'dialog' },
    ],
    owner: '月度签到/补签（T006；H033 接 Native 激励广告完成信号）',
  },
  {
    path: '/luck',
    title: '今日澡运',
    nodes: [7],
    task: 'T006',
    entry: '诗得丽专栏-本期活动「今日澡运」；会员中心',
    returnTo: '诗得丽专栏首页 / 会员中心',
    states: [{ key: 'drawn', node: 7, label: '今日澡运-当天已抽过' }],
    owner: '每日抽签玩法（T006 施工）',
  },
  {
    path: '/luck/result',
    title: '抽取成功',
    titleBarTitle: '今日澡运',
    nodes: [41],
    task: 'T006',
    entry: '今日澡运-抽取',
    returnTo: '今日澡运 / 诗得丽专栏首页',
    states: [
      { key: 'great', node: 41, label: '抽取成功-大吉' },
      { key: 'good', node: 41, label: '抽取成功-中吉' },
      { key: 'minor', node: 41, label: '抽取成功-小吉' },
    ],
    owner: '抽签结果（T006 施工；确定性 fixture，去随机化）',
  },

  /* ────────────────────────── T007 搭子与邀请闭环 ────────────────────────── */
  {
    path: '/buddy',
    title: '洗头搭子',
    nodes: [27, 28],
    task: 'T007',
    entry: '首页/我的-绑定搭子',
    returnTo: '诗得丽专栏首页 / 我的',
    /* #28 原型画了 4 行完全相同的「小美」，属占位重复；multi 档仅为覆盖「多搭子」，
     * 不引入历史 T07 稿的 4 人 mock（B-004）。 */
    states: [
      { key: 'empty', node: 27, label: '搭子（无）' },
      { key: 'list', node: 28, label: '搭子（有）-单搭子' },
      { key: 'multi', node: 28, label: '搭子（有）-多搭子' },
    ],
    owner: '搭子空态/有态（T007 施工；默契值 #31 先不做，见 T014）',
  },
  {
    path: '/buddy/invite',
    title: '邀请搭子',
    nodes: [29],
    task: 'T007',
    entry: '搭子-二维码邀请',
    returnTo: '搭子',
    owner: '二维码邀请卡与保存海报（#102 一期删除复制链接）',
  },
  {
    path: '/buddy/invite/qrcode',
    title: '邀请搭子',
    nodes: [34, 35],
    task: 'T007',
    entry: '邀请搭子-保存海报（历史复制链接状态仅作原型回溯）',
    returnTo: '邀请搭子',
    /* ⚠️ 原型只画了保存成功（#34）与复制成功（#35）；两个 *-failed 是任务卡要求的
     * 可复现失败态，按 D-056 只能由 `?state=` 驱动，页面内真实操作恒定成功（B-005）。 */
    states: [
      { key: 'saved', node: 34, label: '二维码保存到本地（成功）' },
      { key: 'poster-failed', node: 34, label: '海报保存失败（仅 ?state= 复现）' },
      { key: 'link-copied', node: 35, label: '生成分享链接（复制成功）' },
      { key: 'link-failed', node: 35, label: '链接复制失败（仅 ?state= 复现）' },
    ],
    owner: '分享海报结果（一期移除复制链接入口；历史 link-* 仅用于原型追溯）',
  },
  {
    path: '/buddy/invite/phone',
    title: '手机号邀请',
    /* 摹客 #32 标题栏写的是「搜索搭子」，页面树名是「手机号邀请」；
     * 标题栏取原型实际文案，页面树名保留在 title 供索引与任务卡对齐。 */
    titleBarTitle: '搜索搭子',
    nodes: [32, 33],
    task: 'T007',
    entry: '搭子-手机号邀请',
    returnTo: '搭子',
    states: [
      { key: 'searching', node: 32, label: '搜索中' },
      { key: 'invitable', node: 32, label: '搜索结果-可邀请' },
      { key: 'not-found', node: 32, label: '搜索结果-未找到' },
      { key: 'invited', node: 32, label: '搜索结果-已邀请（重复邀请）' },
      { key: 'success', node: 33, label: '手机号邀请成功' },
    ],
    owner: '手机号搜索邀请（T007 施工；号码→结果为确定性映射，禁止随机）',
  },
  {
    path: '/buddy/invite/scan',
    title: '认识新搭子，请在 App 内扫码',
    nodes: [30],
    task: 'H034',
    /* #102 最终版：该路由只是微信/系统相机的公开引导页，无 Native 安装检测、
     * 不走外部邀请预览、深链打开 App 或安装后恢复绑定。 */
    entry: '微信扫描搭子邀请二维码',
    returnTo: '（外部承接，无应用内返回）',
    owner: '公开扫码提示页面（#102；外部不绑定；下载链接待官方提供）',
  },
  {
    path: '/buddy/accept',
    title: '接受邀请',
    /* 原型是诗得丽专栏首页背景 + 邀请弹窗，不出现二级返回栏。 */
    titleBar: 'plain',
    titleBarTitle: 'DearSeed',
    nodes: [36],
    task: 'T007',
    entry: 'App 内诗得丽扫一扫解析成功后/通知中心接受邀请',
    returnTo: '搭子（已绑定）',
    /* #102 一期修订：确认成为搭子 + 取消（与右上角关闭/返回同义）；
     * 未拿到后台邀请预览/确认 API 前，API 模式禁用假绑定。 */
    states: [
      { key: 'dismissed', node: 36, label: '取消（关闭弹窗）' },
    ],
    owner: '接受邀请确认（T007 施工）',
  },

  /* ────────────────────────── T008 洗护兑换与商城链路 ────────────────────────── */
  {
    path: '/mall',
    tab: true,
    tabOrder: 4,
    label: '商城',
    icon: Headset,
    title: '商城',
    titleBar: 'hidden',
    titleBarTitle: '商城',
    nodes: [17],
    task: 'T008',
    entry: '底部 Tab「商城」；首页头像；诗得丽专栏-「会员空间」/ 会员卡片；我的-「专属权益」；体验券使用弹窗-商品信息',
    returnTo: '诗得丽专栏首页',
    owner: '闪购便利 · 即时零售首页（原生页）',
  },
  {
    path: '/mall/goods/:id',
    title: '商品详情',
    nodes: [48],
    task: 'T008',
    boundary: 'webview',
    entry: 'H5 商城-商品',
    returnTo: 'H5 商城列表',
    owner: 'H5 商城商品详情（WebView 边界页）',
  },
  {
    path: '/mall/cart',
    title: '购物车',
    nodes: [49],
    task: 'T008',
    boundary: 'webview',
    entry: 'H5 商城-购物车入口',
    returnTo: 'H5 商城列表',
    owner: 'H5 商城购物车（WebView 边界页）',
  },
  {
    path: '/exchange/result',
    title: '存入卡包',
    nodes: [40],
    task: 'T008',
    entry: '洗护体验券专区-体验券兑换确认',
    returnTo: '洗护体验券专区',
    owner: '兑换成功入包反馈（T008 施工）',
  },

  /* ────────────────────────── T009 卡包、核销、转赠与兑换码 ────────────────────────── */
  {
    path: '/redeem',
    title: '兑换卡券',
    nodes: [68, 69],
    task: 'T009',
    entry: '我的-卡券兑换；卡包入口',
    returnTo: '我的 / 卡包',
    states: [
      { key: 'success', node: 69, label: '兑换成功' },
      { key: 'format', node: 68, label: '兑换失败-格式错误' },
      { key: 'invalid', node: 68, label: '兑换失败-兑换码无效' },
      { key: 'used', node: 68, label: '兑换失败-已被使用' },
      { key: 'network', node: 68, label: '兑换失败-网络异常' },
    ],
    owner: '兑换码输入（T009；2026-10-12 后台合同至少 10 位，原值提交，规则收在 REDEEM_CODE_RULE）',
  },
  {
    path: '/card/share',
    title: '选择转赠搭子',
    nodes: [65],
    task: 'T009',
    entry: '卡包-第三方可用券「转赠」按钮，须携带当前券 id',
    returnTo: '卡包',
    owner: '只读加载当前登录用户的真实搭子并单选；转赠接口尚未接入，不提供成功状态或写操作',
  },
  {
    path: '/card/verify',
    tab: true,
    tabOrder: 3,
    tabFab: true,
    label: '扫码',
    icon: QrCode,
    title: '扫码核销',
    titleBar: 'hidden',
    nodes: [67],
    task: 'T009',
    entry: '卡包-可用券「使用」',
    returnTo: '卡包',
    owner: '扫码核销（T009；reference 标准页）',
  },
  {
    path: '/card/verify/password',
    title: '消费密码核销',
    titleBarTitle: '消费密码核销',
    titleBar: 'back',
    nodes: [67],
    task: 'T009',
    entry: '卡包-使用-消费密码核销',
    returnTo: '卡包',
    owner: '6 位消费密码核销（T009；reference 标准页）',
  },
  {
    path: '/card/verify/confirm',
    title: '确认核销',
    titleBar: 'plain',
    titleBarTitle: '确认核销',
    nodes: [67],
    task: 'T009',
    entry: '扫码/密码核销确认',
    returnTo: '卡包',
    states: [
      { key: 'done', node: 67, label: '核销成功' },
      { key: 'repeat', node: 67, label: '重复核销拦截' },
    ],
    owner: '确认核销与核销结果（T009；reference 标准页；重复核销判定 ⚠️ 待确认）',
  },

  /* ────────────────────────── T010 地址与订单 ────────────────────────── */
  {
    path: '/address',
    title: '地址管理',
    titleBarTitle: '地址管理',
    titleBar: 'back',
    nodes: [55],
    task: 'T010',
    entry: '我的-地址管理；H5 商城地址',
    returnTo: '我的 / H5 商城',
    states: [{ key: 'empty', node: 55, label: '无收货地址' }],
    owner: '商城地址列表（T010；默认置顶 + 切换默认地址）',
  },
  {
    path: '/address/new',
    title: '添加新地址',
    titleBarTitle: '添加新地址',
    titleBar: 'back',
    nodes: [60],
    task: 'T010',
    entry: '地址管理-添加新地址 / 编辑（?id=）',
    returnTo: '地址管理',
    states: [{ key: 'invalid', node: 60, label: '必填校验未通过' }],
    owner: '新增与回填编辑收货地址（T010；编辑页与行政区划 ⚠️ 待确认 B-027，粘贴识别 ⚠️ 待确认 B-028）',
  },
  {
    path: '/orders',
    title: '订单管理',
    titleBarTitle: '订单管理',
    titleBar: 'back',
    nodes: [56],
    task: 'T010',
    entry: '我的-订单管理',
    returnTo: '我的',
    states: [
      { key: 'completed', node: 56, label: '已完成 Tab' },
      { key: 'ongoing', node: 56, label: '进行中 Tab' },
      { key: 'aftersale', node: 56, label: '售后中 Tab' },
      { key: 'empty', node: 56, label: '暂无订单' },
    ],
    owner: '商城订单列表（T010；四 Tab；订单状态全集 ⚠️ 待确认 B-029）',
  },
  {
    path: '/orders/:id',
    title: '订单详情',
    titleBarTitle: '订单详情',
    titleBar: 'back',
    nodes: [72],
    task: 'T010',
    entry: '订单管理-订单项',
    returnTo: '订单管理',
    owner: '单笔订单详情（T010；金额与运费规则 ⚠️ 待确认 B-030）',
  },

  /* ────────────────────────── T011 我的、设置与 APP 引导 ────────────────────────── */
  {
    path: '/settings',
    title: '资料设置',
    titleBarTitle: '资料设置',
    titleBar: 'back',
    nodes: [59, 61],
    task: 'T011',
    entry: '我的-资料区/头像',
    returnTo: '我的',
    overlays: [{ key: 'discard', node: 61, label: '放弃修改确认', type: 'dialog' }],
    owner: '资料修改闭环（T011；reference 标准页）',
  },

  /* ────────────────────────── T012 通知与消息详情 ────────────────────────── */
  {
    path: '/notifications',
    title: '通知',
    titleBarTitle: '通知',
    titleBar: 'back',
    nodes: [11, 42, 43],
    task: 'T012',
    entry: '首页/我的-通知入口',
    returnTo: '诗得丽专栏首页 / 我的',
    states: [{ key: 'unread', node: 42, label: '通知副本（未读数量）' }],
    overlays: [{ key: 'clear', node: 43, label: '清除消息确认', type: 'dialog' }],
    owner: '消息列表（T012；reference 标准页 4 Tab）',
  },
  {
    path: '/notifications/:id',
    title: '消息详情',
    titleBarTitle: '消息详情',
    titleBar: 'back',
    nodes: [44],
    task: 'T012',
    entry: '通知-消息项',
    returnTo: '通知列表',
    owner: '单条消息正文（T012；reference 标准页）',
  },

  /* ────────────────────────── T013 福利官、智能/人工客服 ────────────────────────── */
  {
    path: '/service/welfare-officer',
    title: '品牌福利官',
    nodes: [57],
    task: 'T013',
    entry: '我的-品牌福利官',
    returnTo: '我的',
    owner: '企业微信福利官（T013 施工）',
  },
  {
    path: '/service/chat',
    title: '智能客服',
    /* T013R3：壳层 TitleBar 接管「返回 + 智能客服」标题 + 右上「企微客服」pill */
    titleBar: 'back',
    nodes: [58, 71],
    task: 'T013',
    entry: '我的-客服中心',
    returnTo: '我的',
    states: [
      { key: 'conversation', node: 58, label: '有对话' },
      { key: 'failed', node: 58, label: '发送失败' },
    ],
    overlays: [{ key: 'request-human', node: 71, label: '请求人工客服', type: 'sheet' }],
    owner: 'AI 客服对话（T013 施工）',
  },
  {
    path: '/service/chat/human',
    title: '人工客服排队',
    nodes: [70],
    task: 'T013',
    entry: '智能客服-转人工',
    returnTo: '智能客服',
    states: [
      { key: 'queuing', node: 70, label: '排队中' },
      { key: 'connected', node: 70, label: '已接入' },
    ],
    owner: '排队中/已接入（T013 施工）',
  },
]

export const TAB_ROUTES = ROUTES.filter((route) => route.tab).sort(
  (a, b) => (a.tabOrder ?? Number.MAX_SAFE_INTEGER) - (b.tabOrder ?? Number.MAX_SAFE_INTEGER),
)

/**
 * 历史首页入口专用的三项底部导航：首页 / 服务 / 我的（仅首页可跳转，其余为视觉展示）。
 * 与主入口的五项 TabBar 并存，互不影响。
 */
export const LEGACY_TAB_ITEMS: { key: string; label: string; icon: LucideIcon; to?: string }[] = [
  { key: 'home', label: '首页', icon: Home, to: '/legacy-home' },
  { key: 'service', label: '服务', icon: Headset, to: '/legacy-service' },
  { key: 'profile', label: '我的', icon: UserRound, to: '/legacy-profile' },
]

/** 判断路径是否使用历史入口的三项底部导航（一级 Tab 自身） */
export function isLegacyTabPath(pathname: string): boolean {
  return (
    pathname === '/legacy-home' ||
    pathname === '/legacy-service' ||
    pathname === '/legacy-profile'
  )
}

/**
 * 判断路径是否命中一级 Tab（仅一级 Tab 自身显示底部导航）
 * 这里必须精确匹配：Tab 路由的子路径（如 /mall/goods/:id、/mall/cart、/card/verify/password、
 * /card/verify/confirm）都是二级页，按壳层约定不显示底部导航。
 * 注意 BottomNav 内部的高亮判定仍用前缀匹配，两者职责不同，不要合并。
 */
export function isTabPath(pathname: string): boolean {
  return TAB_ROUTES.some((route) => route.path === pathname)
}

/** 精确匹配；无则尝试 `:param` 动态路由匹配 */
export function findRouteByPathname(pathname: string): RouteMeta | undefined {
  const exact = ROUTES.find((route) => route.path === pathname)
  if (exact) return exact
  return ROUTES.find((route) => {
    if (!route.path.includes(':')) return false
    const segs = route.path.split('/')
    const parts = pathname.split('/')
    if (segs.length !== parts.length) return false
    return segs.every((seg, i) => seg.startsWith(':') || seg === parts[i])
  })
}

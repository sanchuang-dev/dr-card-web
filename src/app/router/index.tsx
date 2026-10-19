import { createBrowserRouter, Navigate } from 'react-router-dom'
import MobileLayout from '../../layouts/MobileLayout'
import Home from '../../pages/Home'
import LegacyHome from '../../pages/LegacyHome'
import LegacyScan from '../../pages/LegacyScan'
import DearseedColumn from '../../pages/DearseedColumn'
import Checkin from '../../pages/Checkin'
import Profile from '../../pages/Profile'
import Luck from '../../pages/Luck'
import DrawSuccess from '../../pages/DrawSuccess'
import Card from '../../pages/Card'
import CardShare from '../../pages/CardShare'
import ScanVerify from '../../pages/ScanVerify'
import ConfirmVerify from '../../pages/ConfirmVerify'
import PasswordVerify from '../../pages/PasswordVerify'
import Membership from '../../pages/Membership'
import MembershipLevels from '../../pages/MembershipLevels'
import Redeem from '../../pages/Redeem'
import Exchange from '../../pages/Exchange'
import ExchangeResult from '../../pages/ExchangeResult'
import Points from '../../pages/Points'
import PointsDetail from '../../pages/PointsDetail'
import Settings from '../../pages/Settings'
import Onboarding from '../../pages/Onboarding'
import ClaimSuccess from '../../pages/ClaimSuccess'
import BrandCulture from '../../pages/BrandCulture'
import WelfareOfficer from '../../pages/WelfareOfficer'
import ServiceChat from '../../pages/ServiceChat'
import ServiceHuman from '../../pages/ServiceHuman'
import Notifications from '../../pages/Notifications'
import NotificationDetail from '../../pages/NotificationDetail'
import Address from '../../pages/Address'
import AddressNew from '../../pages/AddressNew'
import Orders from '../../pages/Orders'
import OrderDetail from '../../pages/OrderDetail'
import Buddy from '../../pages/Buddy'
import BuddyInvite from '../../pages/BuddyInvite'
import BuddyShareResult from '../../pages/BuddyShareResult'
import BuddyPhoneInvite from '../../pages/BuddyPhoneInvite'
import BuddyScanLanding from '../../pages/BuddyScanLanding'
import BuddyAccept from '../../pages/BuddyAccept'
import Tokens from '../../pages/Tokens'
import NodeStub from '../../pages/NodeStub'
import WebViewBoundary from '../../pages/WebViewBoundary'
import DeviceListPage from '../../pages/DeviceListPage'
import DeviceDetailPage from '../../pages/DeviceDetailPage'
/* T042：自助售货机扫码购买页 */
import VendingBuyPage from '../../pages/VendingBuyPage'
import VendingOrderPage from '../../pages/VendingOrderPage'
import MallEmbedDemo from '../../pages/MallEmbedDemo'
import LegacyService from '../../pages/LegacyService'
import RepairProjects from '../../pages/RepairProjects'
import RepairForm from '../../pages/RepairForm'
import FeedbackPage from '../../pages/FeedbackPage'
import ProfileHome from '../../pages/legacy/ProfileHome'
import PersonalInfo from '../../pages/legacy/PersonalInfo'
import EditNickname from '../../pages/legacy/EditNickname'
import BindEmail from '../../pages/legacy/BindEmail'
import BindPhone from '../../pages/legacy/BindPhone'
import SettingsPage from '../../pages/legacy/SettingsPage'
import OrdersPage from '../../pages/legacy/OrdersPage'
import ReceiptsPage from '../../pages/legacy/ReceiptsPage'
import ReceiptDetailPage from '../../pages/legacy/ReceiptDetailPage'
import DeviceListSimplePage from '../../pages/legacy/DeviceListSimplePage'
import AvatarEditPage from '../../pages/legacy/AvatarEditPage'
import PhoneChangePage from '../../pages/legacy/PhoneChangePage'
import LoginPage from '../../pages/legacy/LoginPage'
import EditProfile from '../../pages/legacy/EditProfile'
import BindSchoolPage from '../../pages/legacy/BindSchoolPage'
import RegisterPage from '../../pages/legacy/RegisterPage'
import ForgotPasswordPage from '../../pages/legacy/ForgotPasswordPage'
import ConsumePinPage from '../../pages/legacy/ConsumePinPage'
import ScratchCardRechargePage from '../../pages/legacy/ScratchCardRechargePage'
import MyCardsPage from '../../pages/legacy/MyCardsPage'
import CouponsPage from '../../pages/legacy/CouponsPage'
import CardDetailPage from '../../pages/legacy/CardDetailPage'
import CardTopupPage from '../../pages/legacy/CardTopupPage'
import CardTopupSuccessPage from '../../pages/legacy/CardTopupSuccessPage'
import CardTopupFailPage from '../../pages/legacy/CardTopupFailPage'
import CardTopupRecordsPage from '../../pages/legacy/CardTopupRecordsPage'
import CardRefundRecordsPage from '../../pages/legacy/CardRefundRecordsPage'
import ScanBindCardPage from '../../pages/legacy/ScanBindCardPage'
import PickupMachineRechargePage from '../../pages/legacy/PickupMachineRechargePage'
import CustomerServicePage from '../../pages/legacy/CustomerServicePage'
import SchoolAccountListPage from '../../pages/legacy/SchoolAccountListPage'
import RechargePage from '../../pages/legacy/RechargePage'
import SchoolRefundPage from '../../pages/legacy/SchoolRefundPage'
import SignInPage from '../../pages/legacy/SignInPage'
import PointsPage from '../../pages/legacy/PointsPage'
import NotFound from '../../pages/NotFound'
import { ROUTES } from './routes'
import type { ReactElement } from 'react'

/** 已完成/进行中的定制页面（其余节点走确定性 NodeStub 或 WebView 边界页） */
const customPages: Record<string, ReactElement> = {
  '/': <Home />,
  '/legacy-home': <LegacyHome />,
  '/legacy-home/scan': <LegacyScan />,
  '/mall': <MallEmbedDemo />,
  '/dearseed': <DearseedColumn />,
  '/checkin': <Checkin />,
  /* 2026-08-28：恢复既有会员中心，由「我的 → 快捷服务」进入，不新建页面。 */
  '/membership': <Membership />,
  /* T046｜诗得丽专栏内会员中心入口：复用 Membership 组件 */
  '/dearseed/membership': <Membership />,
  '/profile': <Profile />,
  '/luck': <Luck />,
  '/luck/result': <DrawSuccess />,
  '/card': <Card />,
  /* T009：#65 选择接收人与 #66 转赠成功为同一条链路，用 ?state=success 切换 */
  '/card/share': <CardShare />,
  '/card/verify': <ScanVerify />,
  '/card/verify/confirm': <ConfirmVerify />,
  '/card/verify/password': <PasswordVerify />,
  '/membership/levels': <MembershipLevels />,
  '/redeem': <Redeem />,
  /* T008：#18/#37/#38 是同一列表的排序状态，#40 沿用兑换专区作为背景层 */
  '/exchange': <Exchange />,
  '/exchange/result': <ExchangeResult />,
  '/points': <Points />,
  /* T022：泡泡值页面承载资产/福利/任务占位，纯流水明细拆到 /points/detail */
  '/points/detail': <PointsDetail />,
  '/settings': <Settings />,
  '/onboarding': <Onboarding />,
  /* T005：#25 与 #15 在摹客中是同构弹窗，仅文案不同，共用 ClaimSuccess */
  '/onboarding/success': <ClaimSuccess source="onboarding" />,
  '/claim/success': <ClaimSuccess source="campaign" />,
  /* T005：#16 品牌文化按原型只铺长图，不加浮动 CTA（用户定案，B-001 关闭） */
  '/brand-culture': <BrandCulture />,
  '/service/welfare-officer': <WelfareOfficer />,
  /* T013：#58 智能客服承载 #71 弹层，#70 为转人工后的排队/接入两态 */
  '/service/chat': <ServiceChat />,
  '/service/chat/human': <ServiceHuman />,
  '/notifications': <Notifications />,
  '/notifications/:id': <NotificationDetail />,
  /* T010：#60 同时承载新增与 `?id=` 回填编辑（原型未单独画编辑页，见 B-027） */
  '/address': <Address />,
  '/address/new': <AddressNew />,
  '/orders': <Orders />,
  '/orders/:id': <OrderDetail />,
  /* T007：搭子与邀请闭环；#31 默契值明确先不做，不登记页面实现。 */
  '/buddy': <Buddy />,
  '/buddy/invite': <BuddyInvite />,
  '/buddy/invite/qrcode': <BuddyShareResult />,
  '/buddy/invite/phone': <BuddyPhoneInvite />,
  '/buddy/invite/scan': <BuddyScanLanding />,
  '/buddy/accept': <BuddyAccept />,

  /* T033/T034：卡博士设备服务 */
  '/device/:type': <DeviceListPage />,
  '/device/connecting': <DeviceDetailPage />,
  '/device/success': <DeviceDetailPage />,
  /* T042：自助售货机扫码购买页 */
  '/vending/buy': <VendingBuyPage />,
  '/vending/order': <VendingOrderPage />,

  /* T034：卡博士服务中心 */
  '/legacy-service': <LegacyService />,
  '/legacy-service/repair/projects': <RepairProjects />,
  '/legacy-service/repair/form': <RepairForm />,
  '/legacy-service/feedback': <FeedbackPage />,

  /* T035：卡博士个人中心 */
  '/legacy-profile': <ProfileHome />,
  '/legacy-profile/info': <PersonalInfo />,
  '/legacy-profile/nickname': <EditNickname />,
  '/legacy-profile/email': <BindEmail />,
  '/legacy-profile/phone': <BindPhone />,
  '/legacy-profile/settings': <SettingsPage />,
  '/legacy-profile/orders': <OrdersPage />,
  '/legacy-profile/receipts': <ReceiptsPage />,
  '/legacy-profile/receipts/:id': <ReceiptDetailPage />,
  '/legacy-profile/devices/:type': <DeviceListSimplePage />,

  /* T026：卡博士注册登录与个人信息 */
  '/legacy-profile/avatar-edit': <AvatarEditPage />,
  '/legacy-profile/phone-change': <PhoneChangePage />,
  '/legacy-profile/login': <LoginPage />,
  '/legacy-profile/edit': <EditProfile />,
  /* T037：登录后引导绑定学校/专业/学号 */
  '/legacy-profile/bind-school': <BindSchoolPage />,
  /* T037：注册账号（手机号 + 验证码 + 密码 + 二次确认） */
  '/legacy-profile/register': <RegisterPage />,
  /* T037：忘记密码（手机号 + 短信验证码（演示 123456）+ 图形验证码 + 新密码 + 确认密码） */
  '/legacy-profile/forgot-password': <ForgotPasswordPage />,
  /* T039：机器端消费密码（手机尾号 + 6 位消费密码领取/核销） */
  '/legacy-profile/machine-pin': <ConsumePinPage />,
  /* T038：刮刮充值卡补全 */
  '/legacy-profile/scratch-card': <ScratchCardRechargePage />,

  /* T031：卡券与优惠卡 */
  '/legacy-profile/my-cards': <MyCardsPage />,
  '/legacy-profile/coupons': <CouponsPage />,

  /* T031：我的卡补充：卡详情 / 字段编辑 / 充值退款 */
  '/legacy-profile/my-cards/:id': <CardDetailPage />,
  '/legacy-profile/my-cards/:id/topup': <CardTopupPage />,
  '/legacy-profile/my-cards/:id/topup/success': <CardTopupSuccessPage />,
  '/legacy-profile/my-cards/:id/topup/fail': <CardTopupFailPage />,
  '/legacy-profile/my-cards/:id/topup-records': <CardTopupRecordsPage />,
  '/legacy-profile/my-cards/:id/refund-records': <CardRefundRecordsPage />,
  '/legacy-profile/my-cards/scan-bind': <ScanBindCardPage />,

  /* T041：领款机反扫码充值 */
  '/legacy-profile/pickup-machine': <PickupMachineRechargePage />,

  /* T028：客服中心与学校账户退款 */
  '/legacy-profile/customer-service': <CustomerServicePage />,
  '/legacy-profile/school-accounts': <SchoolAccountListPage />,
  '/legacy-profile/recharge/:id': <RechargePage />,
  '/legacy-profile/school-refund/:id': <SchoolRefundPage />,

  /* T025：积分商城与泡泡值体系统一（卡博士"福袋"入口） */
  '/signin': <SignInPage />,
  '/signin/detail': <PointsPage />,
}

const routerBasename = import.meta.env.BASE_URL === '/' ? '/' : import.meta.env.BASE_URL.replace(/\/$/, '')

export const router = createBrowserRouter([
  {
    element: <MobileLayout />,
    children: [
      ...ROUTES.map((route) => {
        let element: ReactElement = <NodeStub />
        /* redirectTo 仍用于明确退役并重定向的历史路径，优先级高于定制页。 */
        if (route.redirectTo) element = <Navigate to={route.redirectTo} replace />
        else if (customPages[route.path]) element = customPages[route.path]
        else if (route.boundary === 'webview') element = <WebViewBoundary />
        return { path: route.path, element }
      }),
      /* T002 品牌 Token 展示页（工程参照页，不属于业务节点，不进入业务导航） */
      { path: '/tokens', element: <Tokens /> },
      { path: '/draw-success', element: <Navigate to="/luck/result" replace /> },
      { path: '*', element: <NotFound /> },
    ],
  },
], { basename: routerBasename })

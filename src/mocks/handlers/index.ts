import { buddyPhoneHandlers } from './buddyPhone'
import { checkinHandlers } from './checkin'
import { chatMessageHandlers } from './chatMessages'
import { couponCategoryHandlers } from './couponCategories'
import { couponGiftHandlers } from './couponGift'
import { exchangeHandlers } from './exchange'
import { homeHandlers } from './home'
import { networkProbeHandler } from './networkProbe'
import { noticeHandlers } from './notices'
import { memberGradesHandlers } from './memberGrades'
import { myCouponsHandlers } from './myCoupons'
import { userProfileHandlers } from './userProfile'
import { userpointsHandlers } from './userpoints'
import { welfareOfficerHandlers } from './welfareOfficer'

export const handlers = [
  networkProbeHandler,
  ...myCouponsHandlers,
  ...memberGradesHandlers,
  ...buddyPhoneHandlers,
  ...noticeHandlers,
  ...chatMessageHandlers,
  ...couponCategoryHandlers,
  ...couponGiftHandlers,
  ...checkinHandlers,
  ...exchangeHandlers,
  // 两者匹配同一个 settings/detail URL，专用 key 要在通用 fallback 前命中。
  ...welfareOfficerHandlers,
  ...homeHandlers,
  ...userProfileHandlers,
  ...userpointsHandlers,
]

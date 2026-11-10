export const H014_BUDDY_PHONE_SCENARIOS = {
  success: '13900000000',
  incoming: '13800000004',
  alreadyBuddies: '13800000005',
  self: '13800000006',
  empty: '13800000000',
  invited: '13800000001',
  businessError: '13800000002',
  slow: '13800000003',
  http4xx: '13800000400',
  http5xx: '13800000500',
  networkFailure: '13800000999',
} as const

export const H014_SLOW_RESPONSE_MS = 1_500


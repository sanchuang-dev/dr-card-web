import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  fetchUserProfile,
  fetchUserProfileDetail,
  updateUserProfile,
  USER_GENDER_MALE,
} from './userProfile'

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
}))

vi.mock('./http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./http')>()
  return { ...actual, httpClient: { request: mocks.request } }
})

vi.mock('./auth/session', () => ({ getAuthSession: () => undefined }))

const PROFILE_DATA = {
  couponsCount: 2,
  grade: '普通会员',
  grade_id: 1,
  nextGrade: { id: 2, name: '白银会员', min_exp_number: 100 },
  nick_name: '用户28123456',
  avatar_img: 'https://app.kbscloud.com/statics/icons/user_default_icon.png',
  country: '中国',
  city: '南宁',
  province: '广西',
  mobile: '151****2709',
  real_name: '',
  points: 128,
  kbs_id: 'K016998956',
  identify_code: '123e4567-e89b-42d3-a456-426614174000',
}

describe('live user detail contract', () => {
  beforeEach(() => mocks.request.mockReset())

  it('maps current DB identity and grade, without treating numeric avatar zero as a real photo', async () => {
    mocks.request.mockResolvedValue({
      code: 0, data: { nick_name: '新昵称', grade: '大二', avatar_img: 0 },
    })
    await expect(fetchUserProfileDetail()).resolves.toEqual({
      nickname: '新昵称', grade: '大二', avatar: undefined,
    })
  })

  it('exposes the optional account ID for a PIN mask without returning the password', async () => {
    mocks.request.mockResolvedValue({
      code: 0, data: { id: 5, nick_name: '示例', student_grade: '研一', birthday: null },
    })
    const detail = await fetchUserProfileDetail()
    expect(detail.userId).toBe(5)
    expect(detail).not.toHaveProperty('consume_password')
  })

  it('prefers the persisted student_grade when membership grade differs', async () => {
    mocks.request.mockResolvedValue({
      code: 0,
      data: {
        nick_name: '已更新用户',
        grade: '普通会员',
        student_grade: '研二',
        avatar_img: '',
      },
    })
    await expect(fetchUserProfileDetail()).resolves.toEqual({
      nickname: '已更新用户',
      grade: '研二',
      avatar: undefined,
    })
    expect(mocks.request).toHaveBeenCalledWith({
      method: 'GET',
      url: '/api/user/detail',
      headers: undefined,
    })
  })

  it('treats explicitly empty student_grade as unselected, never as membership grade', async () => {
    mocks.request.mockResolvedValue({
      code: 0,
      data: { nick_name: '未设置年级', grade: '钻石会员', student_grade: '' },
    })
    await expect(fetchUserProfileDetail()).resolves.toMatchObject({ grade: '' })
  })

  it('treats nullable student_grade as unset, not a reason to select a membership tier', async () => {
    mocks.request.mockResolvedValue({
      code: 0,
      data: { nick_name: '未填写', grade: '大一', student_grade: null },
    })
    await expect(fetchUserProfileDetail()).resolves.toMatchObject({ grade: '' })
  })

  it('uses legacy grade only when student_grade is absent', async () => {
    mocks.request.mockResolvedValue({
      code: 0,
      data: { nick_name: '旧接口', grade: '大三' },
    })
    await expect(fetchUserProfileDetail()).resolves.toMatchObject({ grade: '大三' })
  })

  it('uses a real avatar URL from the detail response', async () => {
    mocks.request.mockResolvedValue({
      code: 0, data: { nick_name: '小明', grade: '研二', avatar_img: 'https://cdn.example.com/user.png' },
    })
    await expect(fetchUserProfileDetail()).resolves.toMatchObject({
      nickname: '小明', avatar: 'https://cdn.example.com/user.png',
    })
  })

  it('does not silently accept an API business failure', async () => {
    mocks.request.mockResolvedValue({ code: 401, message: '请先登录', data: [] })
    await expect(fetchUserProfileDetail()).rejects.toThrow('请先登录')
  })
})

describe('user profile contract', () => {
  beforeEach(() => {
    mocks.request.mockReset()
  })

  it('maps the envelope into a page-ready view model', async () => {
    mocks.request.mockResolvedValue({ code: 0, msg: 'success', status: 'succ', data: PROFILE_DATA })

    const profile = await fetchUserProfile()

    expect(mocks.request).toHaveBeenCalledWith({ method: 'GET', url: '/api/user/profile' })
    expect(profile).toEqual({
      couponsCount: 2,
      grade: '普通会员',
      gradeId: 1,
      nextGrade: { id: 2, name: '白银会员', min_exp_number: 100 },
      nickname: '用户28123456',
      avatar: 'https://app.kbscloud.com/statics/icons/user_default_icon.png',
      country: '中国',
      province: '广西',
      city: '南宁',
      mobile: '151****2709',
      realName: undefined,
      points: 128,
      kbsId: 'K016998956',
      identifyCode: '123e4567-e89b-42d3-a456-426614174000',
    })
  })

  it('treats nextGrade "" as no next level instead of throwing', async () => {
    mocks.request.mockResolvedValue({
      code: 0,
      msg: 'success',
      data: { ...PROFILE_DATA, grade: '钻石会员', grade_id: 5, nextGrade: '' },
    })

    await expect(fetchUserProfile()).resolves.toMatchObject({ nextGrade: undefined, grade: '钻石会员' })
  })

  it('keeps profile visible when no default membership grade is configured', async () => {
    const { grade: _grade, grade_id: _gradeId, ...withoutGrade } = PROFILE_DATA
    mocks.request.mockResolvedValue({
      code: 0, msg: 'success',
      data: { ...withoutGrade, nextGrade: { id: 2, name: '白银会员', min_exp_number: 100 } },
    })
    const profile = await fetchUserProfile()
    expect(profile).toMatchObject({
      nickname: '用户28123456',
      grade: '',
      gradeId: undefined,
      nextGrade: undefined,
      points: 128,
    })
  })

  it('rejects inconsistent grade name and ID instead of silently guessing', async () => {
    mocks.request.mockResolvedValue({ code: 0, data: { ...PROFILE_DATA, grade_id: undefined } })
    await expect(fetchUserProfile()).rejects.toThrow()
  })

  it('keeps couponsCount 0 and points 0 as real values', async () => {
    mocks.request.mockResolvedValue({
      code: 0,
      msg: 'success',
      data: { ...PROFILE_DATA, couponsCount: 0, points: 0, avatar_img: '', kbs_id: '' },
    })

    await expect(fetchUserProfile()).resolves.toMatchObject({
      couponsCount: 0,
      points: 0,
      avatar: undefined,
      kbsId: undefined,
    })
  })

  it('throws a business error on failure so the page can degrade', async () => {
    mocks.request.mockResolvedValue({ code: 401, message: '请先登录', data: [] })

    await expect(fetchUserProfile()).rejects.toMatchObject({ kind: 'business', message: '请先登录' })
  })
})

describe('profile identify_code parsing', () => {
  beforeEach(() => mocks.request.mockReset())

  it('returns absent code as undefined and rejects a malformed UUID', async () => {
    const { identify_code: _code, ...withoutCode } = PROFILE_DATA
    mocks.request.mockResolvedValue({ code: 0, data: withoutCode })
    await expect(fetchUserProfile()).resolves.toMatchObject({ identifyCode: undefined })
    mocks.request.mockResolvedValue({ code: 0, data: { ...PROFILE_DATA, identify_code: 'invalid' } })
    await expect(fetchUserProfile()).rejects.toThrow()
  })
})

describe('user update contract', () => {
  beforeEach(() => {
    mocks.request.mockReset()
  })

  it('posts only the changed fields and parses the returned user entity', async () => {
    mocks.request.mockResolvedValue({
      code: 0,
      msg: 'success',
      data: { id: 5, nick_name: '小明', gender: '1', avatar_img: '', points: 128, grade_id: 1, student_grade: '初二' },
    })

    await expect(updateUserProfile({ nick_name: '小明', gender: USER_GENDER_MALE })).resolves.toMatchObject({
      nick_name: '小明',
      gender: '1',
    })
    expect(mocks.request).toHaveBeenCalledWith({
      method: 'POST',
      url: '/api/user/update',
      data: { nick_name: '小明', gender: '1' },
    })
  })

  it('reads optional extended profile fields without treating absent flags as unset', async () => {
    mocks.request.mockResolvedValueOnce({
      code: 0, data: { nick_name: '示例', student_grade: '大一', birthday: '2001-02-03', consume_password_set: true },
    }).mockResolvedValueOnce({ code: 0, data: { nick_name: '示例', student_grade: '大一' } })
    await expect(fetchUserProfileDetail()).resolves.toMatchObject({ birthday: '2001-02-03', pinConfigured: true })
    const absent = await fetchUserProfileDetail()
    expect(absent.birthday).toBeUndefined()
    expect(absent.pinConfigured).toBeUndefined()
  })

  it('preserves a null birthday as an editable empty date, without inventing PIN support', async () => {
    mocks.request.mockResolvedValue({ code: 0, data: { nick_name: '会员', student_grade: '', birthday: null } })
    await expect(fetchUserProfileDetail()).resolves.toMatchObject({ birthday: '' })
    const result = await fetchUserProfileDetail()
    expect(result.pinConfigured).toBeUndefined()
  })

  it('rejects success-code responses that silently discard a birthday edit', async () => {
    mocks.request.mockResolvedValue({
      code: 0, data: { id: 5, nick_name: '示例', gender: '1', points: 0 },
    })
    await expect(updateUserProfile({ birthday: '2001-02-03' })).rejects.toThrow('生日未保存')
  })

  it('sends a PIN to the existing update endpoint when status is omitted', async () => {
    mocks.request.mockResolvedValue({
      code: 0, data: { id: 5, nick_name: '示例', gender: '1', points: 0 },
    })
    await expect(updateUserProfile({ consume_password: '123456' })).resolves.toMatchObject({ id: 5 })
    expect(mocks.request).toHaveBeenCalledWith({
      method: 'POST', url: '/api/user/update', data: { consume_password: '123456' },
    })
  })

  it('treats a code-zero response as successful without a second PIN-status gate', async () => {
    mocks.request.mockResolvedValue({
      code: 0, data: { id: 5, nick_name: '示例', gender: '1', points: 0, consume_password_set: false },
    })
    await expect(updateUserProfile({ consume_password: '123456' })).resolves.toMatchObject({ id: 5 })
  })

  it('surfaces the backend message when validation fails', async () => {
    mocks.request.mockResolvedValue({ code: 500, message: '"nick_name" is required', data: [] })

    await expect(updateUserProfile({ nick_name: '' })).rejects.toMatchObject({
      kind: 'business',
      message: '"nick_name" is required',
    })
  })
})

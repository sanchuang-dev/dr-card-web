import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  takePhoto: vi.fn(),
  chooseImage: vi.fn(),
  updateProfile: vi.fn(),
  fetchUserProfileDetail: vi.fn(),
  updateUserProfile: vi.fn(),
  uploadUserAvatar: vi.fn(),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
    useBlocker: () => ({
      state: 'unblocked',
      reset: vi.fn(),
      proceed: vi.fn(),
    }),
  }
})

vi.mock('../app/fixtures/useFixture', () => ({
  useOverlay: () => ({
    overlay: null,
    close: vi.fn(),
  }),
}))

vi.mock('../app/state/memberProfile', () => ({
  useMemberProfile: () => ({
    birthday: '',
    birthdayLastModifiedAt: null,
  }),
  memberProfileActions: {
    update: mocks.updateProfile,
  },
}))

vi.mock('../services/nativeBridge', () => {
  class NativeBridgeError extends Error {
    constructor(readonly code: string) {
      super(code)
    }
  }

  return {
    NativeBridgeError,
    takePhoto: mocks.takePhoto,
    chooseImage: mocks.chooseImage,
  }
})

/* 资料读取按用例显式驱动；默认挂起，避免回填影响头像相关用例。 */
vi.mock('../services/userProfile', () => ({
  fetchUserProfileDetail: mocks.fetchUserProfileDetail,
  updateUserProfile: mocks.updateUserProfile,
}))
vi.mock('../services/userAvatarUpload', () => ({ uploadUserAvatar: mocks.uploadUserAvatar }))

import Settings from './Settings'
import { storage, STORAGE_KEYS } from '../storage'
import { clearUserIdentity } from './profile/useUserIdentity'

beforeEach(() => {
  clearUserIdentity()
  /* 默认挂起：只有显式驱动的用例才产生回填结果。 */
  mocks.fetchUserProfileDetail.mockImplementation(() => new Promise(() => {}))
})

afterEach(() => {
  mocks.navigate.mockReset()
  mocks.takePhoto.mockReset()
  mocks.chooseImage.mockReset()
  mocks.updateProfile.mockReset()
  mocks.fetchUserProfileDetail.mockReset()
  mocks.updateUserProfile.mockReset()
  mocks.uploadUserAvatar.mockReset()
  storage.remove(STORAGE_KEYS.profilePinMasks)
  clearUserIdentity()
})

function openAvatarSheet() {
  fireEvent.click(screen.getAllByRole('button', { name: '修改头像' })[0])
}

describe('Settings Native avatar integration', () => {
  it('renders a Native takePhoto result as the local avatar preview', async () => {
    mocks.takePhoto.mockResolvedValue({
      mimeType: 'image/jpeg',
      imageBase64: 'avatar-photo-base64',
    })

    render(<Settings />)
    openAvatarSheet()
    fireEvent.click(screen.getByRole('button', { name: '拍照' }))

    await waitFor(() => {
      expect(mocks.takePhoto).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect((screen.getByAltText('会员头像') as HTMLImageElement).src).toContain(
        'data:image/jpeg;base64,avatar-photo-base64',
      )
    })
    // Selection only stages the picture. No backend save has happened yet.
    expect(screen.queryByText('保存成功')).toBeNull()
  })

  it('shows confirmed Native cancellation without treating it as an unknown failure', async () => {
    const { NativeBridgeError } = await import('../services/nativeBridge')
    mocks.takePhoto.mockRejectedValue(
      new NativeBridgeError(
        'native-cancelled',
        'takePhoto',
        'confirmed Native cancellation',
      ),
    )

    render(<Settings />)
    openAvatarSheet()
    fireEvent.click(screen.getByRole('button', { name: '拍照' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('已取消图片选择')
    })
  })

  it('shows source-specific permission guidance for Native media denial', async () => {
    const { NativeBridgeError } = await import('../services/nativeBridge')
    mocks.chooseImage.mockRejectedValue(
      new NativeBridgeError(
        'native-permission-denied',
        'chooseImage',
        'confirmed Native permission denial',
      ),
    )

    render(<Settings />)
    openAvatarSheet()
    fireEvent.click(screen.getByRole('button', { name: '从相册选择' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        '请允许相册权限后重试',
      )
    })
  })

  it('uses chooseImage for the album entry', async () => {
    mocks.chooseImage.mockResolvedValue({
      mimeType: 'image/png',
      imageBase64: 'avatar-album-base64',
    })

    render(<Settings />)
    openAvatarSheet()
    fireEvent.click(screen.getByRole('button', { name: '从相册选择' }))

    await waitFor(() => {
      expect(mocks.chooseImage).toHaveBeenCalledTimes(1)
    })
    expect((screen.getByAltText('会员头像') as HTMLImageElement).src).toContain(
      'data:image/png;base64,avatar-album-base64',
    )
  })
})

describe('Settings profile backfill', () => {
  it('backfills nickname and grade from /api/user/detail', async () => {
    mocks.fetchUserProfileDetail.mockResolvedValue({ nickname: '接口昵称', grade: '大三' })

    render(<Settings />)

    await waitFor(() => {
      expect(screen.getByText('接口昵称')).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: '大三' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('selects the saved academic year again after returning to Settings', async () => {
    // These are normalized values from GET /api/user/detail. The service tests
    // separately lock student_grade precedence over membership grade.
    mocks.fetchUserProfileDetail
      .mockResolvedValueOnce({ nickname: '真实昵称', grade: '大二' })
      .mockResolvedValueOnce({ nickname: '真实昵称', grade: '研二' })

    const first = render(<Settings />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '大二' }).getAttribute('aria-pressed')).toBe('true')
    })
    first.unmount()
    render(<Settings />)
    await waitFor(() => expect(mocks.fetchUserProfileDetail).toHaveBeenCalledTimes(2))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '研二' }).getAttribute('aria-pressed')).toBe('true')
    })
    expect(screen.getByRole('button', { name: '大二' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('does not show fake user defaults and retries when the profile request fails', async () => {
    mocks.fetchUserProfileDetail
      .mockRejectedValueOnce(new Error('profile failed'))
      .mockResolvedValueOnce({ nickname: '接口昵称', grade: '' })

    render(<Settings />)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('会员资料加载失败')
    expect(screen.queryByText('会员小福')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '重试' }))

    await waitFor(() => {
      expect(screen.getByText('接口昵称')).toBeTruthy()
    })
    expect(mocks.fetchUserProfileDetail).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('H044 slow profile hydration and UX-A layout', () => {
  it('keeps an early grade selection while filling the untouched nickname on late /detail', async () => {
    let resolveDetail!: (value: { nickname: string; grade: string; avatar?: string }) => void
    mocks.fetchUserProfileDetail.mockImplementation(() => new Promise((resolve) => { resolveDetail = resolve }))
    mocks.updateUserProfile.mockResolvedValue({
      id: 5, nick_name: '服务端昵称', avatar_img: null, student_grade: '大三',
    })
    render(<Settings />)
    fireEvent.click(screen.getByRole('button', { name: '大三' }))
    await act(async () => resolveDetail({ nickname: '服务端昵称', grade: '大二' }))
    expect(await screen.findByText('服务端昵称')).toBeTruthy()
    expect(screen.getByRole('button', { name: '大三' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: '确认修改' }))
    await waitFor(() => expect(mocks.updateUserProfile).toHaveBeenCalledWith({ student_grade: '大三' }))
    expect(screen.queryByText('昵称不能为空，且不能超过 50 个字符')).toBeNull()
  })

  it('keeps a staged Native avatar while hydrating an untouched nickname and grade', async () => {
    let resolveDetail!: (value: { nickname: string; grade: string; avatar?: string }) => void
    mocks.fetchUserProfileDetail.mockImplementation(() => new Promise((resolve) => { resolveDetail = resolve }))
    mocks.takePhoto.mockResolvedValue({ mimeType: 'image/png', imageBase64: 'aGVsbG8=' })
    mocks.uploadUserAvatar.mockResolvedValue('https://cdn.example.com/new-avatar.png')
    mocks.updateUserProfile.mockResolvedValue({
      id: 5, nick_name: '服务端昵称', avatar_img: 'https://cdn.example.com/new-avatar.png', student_grade: '大二',
    })
    render(<Settings />)
    openAvatarSheet()
    fireEvent.click(screen.getByRole('button', { name: '拍照' }))
    await waitFor(() => expect((screen.getByAltText('会员头像') as HTMLImageElement).src).toContain('data:image/png;base64,aGVsbG8='))
    await act(async () => resolveDetail({
      nickname: '服务端昵称', grade: '大二', avatar: 'https://cdn.example.com/old-avatar.png',
    }))
    expect(await screen.findByText('服务端昵称')).toBeTruthy()
    expect((screen.getByAltText('会员头像') as HTMLImageElement).src).toContain('data:image/png;base64,aGVsbG8=')
    fireEvent.click(screen.getByRole('button', { name: '确认修改' }))
    await waitFor(() => expect(mocks.updateUserProfile).toHaveBeenCalledWith({
      avatar_img: 'https://cdn.example.com/new-avatar.png',
    }))
  })

  it('uses one non-wrapping label width for every identity row', () => {
    render(<Settings />)
    for (const name of ['头像', '昵称', '生日', '消费密码']) {
      const label = screen.getByText(name, { selector: 'span' })
      expect(label.className).toContain('w-20')
      expect(label.className).toContain('whitespace-nowrap')
    }
  })
})

describe('H044 birthday and PIN profile editing (#142)', () => {
  it('allows birthday entry but refuses to falsely save when backend detail omits the field', async () => {
    mocks.fetchUserProfileDetail.mockResolvedValue({ nickname: '测试用户', grade: '大一' })
    render(<Settings />)
    await screen.findByText('测试用户')
    expect(screen.getByRole('button', { name: '修改生日' }).textContent).toContain('尚未开放')
    fireEvent.click(screen.getByRole('button', { name: '修改生日' }))
    fireEvent.change(screen.getByLabelText('生日', { selector: 'input' }), {
      target: { value: '2001-05-06' },
    })
    fireEvent.click(screen.getByRole('button', { name: '完成' }))
    fireEvent.click(screen.getByRole('button', { name: '确认修改' }))
    expect(screen.getByRole('alert').textContent).toContain('生日保存暂不可用')
    expect(mocks.updateUserProfile).not.toHaveBeenCalled()
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('accepts code-zero PIN save, shows six dots on reentry, and scopes the mask to the user', async () => {
    mocks.fetchUserProfileDetail.mockResolvedValue({ userId: 5, nickname: '测试用户', grade: '大一', birthday: '' })
    mocks.updateUserProfile.mockResolvedValue({ id: 5, nick_name: '测试用户', student_grade: '大一', avatar_img: null })
    const firstMount = render(<Settings />)
    await screen.findByText('测试用户')
    const entry = screen.getByRole('button', { name: '设置消费密码' })
    fireEvent.click(entry)
    const input = screen.getByLabelText('新消费密码') as HTMLInputElement
    fireEvent.change(input, { target: { value: '1234567' } })
    fireEvent.change(screen.getByLabelText('确认消费密码'), { target: { value: '123456' } })
    expect(input.type).toBe('password')
    expect(input.value).toBe('123456')
    fireEvent.click(screen.getByRole('button', { name: '完成' }))
    expect(entry.textContent).toContain('●●●●●●')
    fireEvent.click(screen.getByRole('button', { name: '确认修改' }))
    await waitFor(() => expect(mocks.updateUserProfile).toHaveBeenCalledWith({ consume_password: '123456' }))
    await screen.findByText('保存成功')
    expect(entry.textContent).toContain('●●●●●●')
    expect(storage.read(STORAGE_KEYS.profilePinMasks)?.['5']).toBe(true)
    expect(JSON.stringify(storage.read(STORAGE_KEYS.profilePinMasks))).not.toContain('123456')
    expect(screen.queryByText('123456')).toBeNull()
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/profile'))
    firstMount.unmount()
    clearUserIdentity()
    const secondMount = render(<Settings />)
    await screen.findByText('测试用户')
    expect(screen.getByRole('button', { name: '设置消费密码' }).textContent).toContain('●●●●●●')
    secondMount.unmount()
    clearUserIdentity()
    mocks.fetchUserProfileDetail.mockResolvedValue({ userId: 6, nickname: '另一个账号', grade: '大一', birthday: '' })
    render(<Settings />)
    await screen.findByText('另一个账号')
    expect(screen.getByRole('button', { name: '设置消费密码' }).textContent).not.toContain('●●●●●●')
  })

  it('validates PIN confirmation without blocking on a missing support flag', async () => {
    mocks.fetchUserProfileDetail.mockResolvedValue({ nickname: '测试用户', grade: '大一', birthday: '' })
    render(<Settings />)
    await screen.findByText('测试用户')
    fireEvent.click(screen.getByRole('button', { name: '设置消费密码' }))
    fireEvent.change(screen.getByLabelText('新消费密码'), { target: { value: '123456' } })
    fireEvent.change(screen.getByLabelText('确认消费密码'), { target: { value: '654321' } })
    fireEvent.click(screen.getByRole('button', { name: '完成' }))
    fireEvent.click(screen.getByRole('button', { name: '确认修改' }))
    expect(screen.getByRole('alert').textContent).toContain('两次相同')
    expect(mocks.updateUserProfile).not.toHaveBeenCalled()
  })

  it('saves birthday via user/update even when PIN remains unsupported', async () => {
    mocks.fetchUserProfileDetail.mockResolvedValue({
      nickname: '测试用户', grade: '大一', birthday: '', pinConfigured: undefined,
    })
    mocks.updateUserProfile.mockResolvedValue({
      id: 5, nick_name: '测试用户', student_grade: '大一', avatar_img: null,
      birthday: '2001-05-06',
    })
    render(<Settings />)
    await screen.findByText('测试用户')
    expect(screen.getByRole('button', { name: '设置消费密码' }).textContent).toContain('设置')
    fireEvent.click(screen.getByRole('button', { name: '修改生日' }))
    fireEvent.change(screen.getByLabelText('生日', { selector: 'input' }), {
      target: { value: '2001-05-06' },
    })
    fireEvent.click(screen.getByRole('button', { name: '完成' }))
    fireEvent.click(screen.getByRole('button', { name: '确认修改' }))
    await waitFor(() => expect(mocks.updateUserProfile).toHaveBeenCalledWith({ birthday: '2001-05-06' }))
    await screen.findByText('保存成功')
    expect(screen.getByRole('button', { name: '修改生日' }).textContent).toContain('2001-05-06')
  })

  it('clears an unsaved PIN when the authentication session changes', async () => {
    mocks.fetchUserProfileDetail.mockResolvedValue({
      nickname: '账号一', grade: '大一', birthday: '', pinConfigured: false,
    })
    render(<Settings />)
    await screen.findByText('账号一')
    fireEvent.click(screen.getByRole('button', { name: '设置消费密码' }))
    fireEvent.change(screen.getByLabelText('新消费密码'), { target: { value: '123456' } })
    fireEvent.change(screen.getByLabelText('确认消费密码'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: '完成' }))
    expect(screen.getByRole('button', { name: '设置消费密码' }).textContent).toContain('●●●●●●')
    act(() => window.dispatchEvent(new Event('dr-card-ui:auth-session-cleared')))
    const entry = screen.getByRole('button', { name: '设置消费密码' }) as HTMLButtonElement
    expect(entry.textContent).not.toContain('●●●●●●')
    expect(entry.disabled).toBe(false)
    fireEvent.click(entry)
    expect((screen.getByLabelText('新消费密码') as HTMLInputElement).value).toBe('')
  })

  it('submits both staged edits through user/update when detail declares support', async () => {
    mocks.fetchUserProfileDetail.mockResolvedValue({
      nickname: '测试用户', grade: '大一', birthday: '', pinConfigured: false,
    })
    mocks.updateUserProfile.mockResolvedValue({
      id: 5, nick_name: '测试用户', student_grade: '大一', avatar_img: null,
      birthday: '2001-05-06', consume_password_set: true,
    })
    render(<Settings />)
    await screen.findByText('测试用户')
    fireEvent.click(screen.getByRole('button', { name: '修改生日' }))
    fireEvent.change(screen.getByLabelText('生日', { selector: 'input' }), {
      target: { value: '2001-05-06' },
    })
    fireEvent.click(screen.getByRole('button', { name: '完成' }))
    fireEvent.click(screen.getByRole('button', { name: '设置消费密码' }))
    fireEvent.change(screen.getByLabelText('新消费密码'), { target: { value: '123456' } })
    fireEvent.change(screen.getByLabelText('确认消费密码'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: '完成' }))
    expect(screen.getByRole('button', { name: '设置消费密码' }).textContent).toContain('●●●●●●')
    fireEvent.click(screen.getByRole('button', { name: '确认修改' }))
    await waitFor(() => expect(mocks.updateUserProfile).toHaveBeenCalledWith({
      birthday: '2001-05-06', consume_password: '123456',
    }))
    await screen.findByText('保存成功')
    expect(screen.getByRole('button', { name: '修改生日' }).textContent).toContain('2001-05-06')
    expect(screen.getByRole('button', { name: '设置消费密码' }).textContent).toContain('●●●●●●')
    expect(screen.queryByText('123456')).toBeNull()
  })
})

describe('Settings real persistence', () => {
  it('stages nickname changes and only reports success after user/update resolves', async () => {
    mocks.fetchUserProfileDetail.mockResolvedValue({ nickname: '原昵称', grade: '大二' })
    mocks.updateUserProfile.mockResolvedValue({
      id: 5, nick_name: '新昵称', avatar_img: null, student_grade: '大二',
    })
    render(<Settings />)
    await screen.findByText('原昵称')
    fireEvent.click(screen.getByRole('button', { name: '修改昵称' }))
    fireEvent.change(screen.getByPlaceholderText('请输入昵称'), { target: { value: '新昵称' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(screen.queryByText('保存成功')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '确认修改' }))
    await waitFor(() => expect(mocks.updateUserProfile).toHaveBeenCalledWith({ nick_name: '新昵称' }))
    await screen.findByText('保存成功')
  })

  it('retains staged edits and displays error when backend rejects update', async () => {
    mocks.fetchUserProfileDetail.mockResolvedValue({ nickname: '原昵称', grade: '大二' })
    mocks.updateUserProfile.mockRejectedValue(new Error('服务器保存失败'))
    render(<Settings />)
    await screen.findByText('原昵称')
    fireEvent.click(screen.getByRole('button', { name: '修改昵称' }))
    fireEvent.change(screen.getByPlaceholderText('请输入昵称'), { target: { value: '待保存' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    fireEvent.click(screen.getByRole('button', { name: '确认修改' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('服务器保存失败')
    expect(screen.getByText('待保存')).toBeTruthy()
    expect(screen.queryByText('保存成功')).toBeNull()
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('uploads staged Native photo before updating avatar URL', async () => {
    mocks.fetchUserProfileDetail.mockResolvedValue({ nickname: '原昵称', grade: '大二' })
    mocks.takePhoto.mockResolvedValue({ mimeType: 'image/png', imageBase64: 'aGVsbG8=' })
    mocks.uploadUserAvatar.mockResolvedValue('https://cdn.example.com/avatar.png')
    mocks.updateUserProfile.mockResolvedValue({
      id: 5, nick_name: '原昵称', avatar_img: 'https://cdn.example.com/avatar.png', student_grade: '大二',
    })
    render(<Settings />)
    await screen.findByText('原昵称')
    openAvatarSheet()
    fireEvent.click(screen.getByRole('button', { name: '拍照' }))
    await waitFor(() => expect(mocks.takePhoto).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: '确认修改' }))
    await waitFor(() => expect(mocks.uploadUserAvatar).toHaveBeenCalledTimes(1))
    expect(mocks.updateUserProfile).toHaveBeenCalledWith({ avatar_img: 'https://cdn.example.com/avatar.png' })
  })
})

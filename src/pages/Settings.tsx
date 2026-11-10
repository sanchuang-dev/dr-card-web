import { useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronRight,
  Image,
  X,
} from 'lucide-react'
import PageContainer from '../components/mobile/PageContainer'
import PromptOverlay from '../components/mobile/PromptOverlay'
import { Button, IconButton } from '../components/ui'
import { useOverlay } from '../app/fixtures/useFixture'
import UserAvatar from '../components/mobile/UserAvatar'
import { useUserIdentity, acceptUserIdentityUpdate } from './profile/useUserIdentity'
import { updateUserProfile, type UserUpdatePayload } from '../services/userProfile'
import { storage, STORAGE_KEYS } from '../storage'
import { uploadUserAvatar } from '../services/userAvatarUpload'
import {
  chooseImage,
  NativeBridgeError,
  takePhoto,
} from '../services/nativeBridge'

type SheetKey = 'avatar' | 'nickname' | 'birthday' | 'pin' | null

const initialProfile = { nickname: '', year: '', birthday: '' }

const yearGroups: Array<{ group: string; items: string[] }> = [
  { group: '本科', items: ['大一', '大二', '大三', '大四', '大五'] },
  { group: '研究生', items: ['研一', '研二', '研三'] },
]

const yearOptions = yearGroups.flatMap((group) => group.items)

/** 接口 `grade` 与年级芯片同名时回填，不同名（或未设置）时保持未选。 */
function matchYearOption(grade: string) {
  return yearOptions.includes(grade) ? grade : ''
}

// Persist only a per-account display flag, never the PIN, so returning to
// Settings shows the same six-dot mask even if /detail omits PIN metadata.
function hasPinMask(userId?: number) {
  if (userId === undefined) return false
  return storage.read(STORAGE_KEYS.profilePinMasks)?.[String(userId)] === true
}

function savePinMask(userId: number) {
  const saved = storage.read(STORAGE_KEYS.profilePinMasks) ?? {}
  storage.write(STORAGE_KEYS.profilePinMasks, { ...saved, [String(userId)]: true })
}

export default function Settings() {
  const navigate = useNavigate()
  const { overlay, close: closeOverlay } = useOverlay()
  const { remote: identity, reload: reloadIdentity } = useUserIdentity()
  const [sheet, setSheet] = useState<SheetKey>(null)
  const [nickname, setNickname] = useState(initialProfile.nickname)
  const [year, setYear] = useState(initialProfile.year)
  const [birthday, setBirthday] = useState(initialProfile.birthday)
  const [pin, setPin] = useState('')
  const [pinConfirmation, setPinConfirmation] = useState('')
  const [pinConfigured, setPinConfigured] = useState<boolean | undefined>()
  // The six-dot preview only reflects a submitted request until the server
  // reports a persisted PIN flag. Never retain or display the raw PIN.
  const [pinSubmitted, setPinSubmitted] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [avatarSrc, setAvatarSrc] = useState<string | undefined>()
  const [pendingImage, setPendingImage] = useState<{ mimeType: string; imageBase64: string } | null>(null)
  const [savePending, setSavePending] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [avatarPending, setAvatarPending] = useState<'photo' | 'album' | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const bypassGuard = useRef(false)
  const postSaveNavigation = useRef<number | null>(null)
  const [baseline, setBaseline] = useState(initialProfile)
  const profileLoad = identity.state === 'success' ? 'ready' : identity.state
  const dirty = nickname !== baseline.nickname || year !== baseline.year ||
    birthday !== baseline.birthday || pin.length > 0 || pendingImage !== null
  // Track which individual fields the user has touched, not just a global dirty
  // boolean: a late /detail response must fill the untouched nickname even when
  // the user picked a grade/avatar before the first request completed.
  const touchedRef = useRef({ nickname: false, year: false, avatar: false, birthday: false })

  useEffect(() => {
    if (identity.state !== 'success') return
    const next = {
      nickname: identity.data.nickname,
      year: matchYearOption(identity.data.grade),
      birthday: identity.data.birthday ?? '',
    }
    setBirthday((current) => touchedRef.current.birthday ? current : next.birthday)
    setPinConfigured(identity.data.pinConfigured ?? (hasPinMask(identity.data.userId) ? true : undefined))
    setNickname((current) => touchedRef.current.nickname ? current : next.nickname)
    setYear((current) => touchedRef.current.year ? current : next.year)
    setAvatarSrc((current) => touchedRef.current.avatar ? current : identity.data.avatar)
    setBaseline(next)
  }, [identity])

  // The success redirect belongs to the current settings mount. If the user
  // leaves before it fires, never send a later page back to /profile.
  useEffect(() => () => {
    if (postSaveNavigation.current !== null) clearTimeout(postSaveNavigation.current)
  }, [])

  // Account changes must never carry a draft PIN (or other profile edits)
  // across sessions. The identity store independently invalidates its cache.
  useEffect(() => {
    const resetDraft = () => {
      setPin('')
      setPinConfirmation('')
      setPinConfigured(undefined)
      setPinSubmitted(false)
      setBirthday('')
      setNickname('')
      setYear('')
      setAvatarSrc(undefined)
      setPendingImage(null)
      setBaseline(initialProfile)
      setSheet(null)
      touchedRef.current = { nickname: false, year: false, avatar: false, birthday: false }
    }
    window.addEventListener('dr-card-ui:auth-session-changed', resetDraft)
    window.addEventListener('dr-card-ui:auth-session-cleared', resetDraft)
    return () => {
      window.removeEventListener('dr-card-ui:auth-session-changed', resetDraft)
      window.removeEventListener('dr-card-ui:auth-session-cleared', resetDraft)
    }
  }, [])

  const blocker = useBlocker(
    ({ historyAction }) => !bypassGuard.current && dirty && historyAction !== 'REPLACE',
  )

  const discardOpen = blocker.state === 'blocked' || overlay === 'discard'

  const close = () => {
    if (sheet === 'pin') {
      setPin('')
      setPinConfirmation('')
    }
    setSheet(null)
  }

  const flashToast = (message = '保存成功') => {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }

  // Sheet changes are staged until the footer confirms a server write.
  const save = () => setSheet(null)

  const updateAvatar = async (source: 'photo' | 'album') => {
    if (avatarPending) return

    setAvatarPending(source)
    setAvatarError(null)
    try {
      const result =
        source === 'photo'
          ? await takePhoto()
          : await chooseImage()

      touchedRef.current.avatar = true
      setPendingImage(result)
      setAvatarSrc(`data:${result.mimeType};base64,${result.imageBase64}`)
      setSaveError(null)
      close()
    } catch (error) {
      if (error instanceof NativeBridgeError) {
        if (['bridge-disabled', 'bridge-unsupported', 'capability-unsupported'].includes(error.code)) {
          setAvatarError('当前 App 版本暂不支持该图片能力')
        } else if (error.code === 'native-cancelled') {
          setAvatarError('已取消图片选择')
        } else if (error.code === 'native-permission-denied') {
          setAvatarError(source === 'photo' ? '请允许相机权限后重试' : '请允许相册权限后重试')
        } else {
          setAvatarError('头像更新失败，请重试')
        }
      } else {
        setAvatarError('头像更新失败，请重试')
      }
    } finally {
      setAvatarPending(null)
    }
  }

  const confirmAll = async () => {
    if (savePending) return
    setSaveError(null)
    if (identity.state !== 'success') {
      setSaveError('用户资料尚未加载成功，请先重试')
      return
    }
    const trimmed = nickname.trim()
    if (!trimmed || trimmed.length > 50) {
      setSaveError('昵称不能为空，且不能超过 50 个字符')
      return
    }
    const payload: UserUpdatePayload = {}
    if (trimmed !== baseline.nickname) payload.nick_name = trimmed
    if (year !== baseline.year) payload.student_grade = year
    if (birthday !== baseline.birthday) {
      // Avoid a partial write to other fields on a backend that drops birthday.
      if (identity.data.birthday === undefined) {
        setSaveError('生日保存暂不可用，请联系管理员')
        return
      }
      if (birthday && (
        !/^\d{4}-\d{2}-\d{2}$/.test(birthday) ||
        Number.isNaN(Date.parse(birthday)) ||
        new Date(birthday + 'T00:00:00Z').toISOString().slice(0, 10) !== birthday ||
        birthday > new Date().toLocaleDateString('sv-SE')
      )) {
        setSaveError('请选择有效的生日日期')
        return
      }
      payload.birthday = birthday
    }
    if (pin) {
      if (!/^\d{6}$/.test(pin) || pin !== pinConfirmation) {
        setSaveError('请输入两次相同的 6 位数字消费密码')
        return
      }
      // Always send a validated six-digit PIN to the existing update endpoint.
      // Missing detail flags must not prevent the user from testing the API.
      payload.consume_password = pin
    }
    if (!Object.keys(payload).length && !pendingImage) {
      bypassGuard.current = true
      navigate('/profile')
      return
    }

    setSavePending(true)
    try {
      if (pendingImage) payload.avatar_img = await uploadUserAvatar(pendingImage)
      const updated = await updateUserProfile(payload)
      const pinAttempted = payload.consume_password !== undefined
      acceptUserIdentityUpdate(updated)
      setPendingImage(null)
      setAvatarSrc(updated.avatar_img || undefined)
      const next = {
        nickname: updated.nick_name.trim(),
        year: matchYearOption(updated.student_grade ?? ''),
        birthday: updated.birthday ?? baseline.birthday,
      }
      setNickname(next.nickname)
      setYear(next.year)
      setBirthday(next.birthday)
      setPin('')
      setPinConfirmation('')
      setPinConfigured(updated.consume_password_set ?? pinConfigured)
      if (pinAttempted) {
        setPinSubmitted(true)
        savePinMask(updated.id)
      }
      setBaseline(next)
      touchedRef.current = { nickname: false, year: false, avatar: false, birthday: false }
      bypassGuard.current = true
      flashToast('保存成功')
      close()
      postSaveNavigation.current = window.setTimeout(() => navigate('/profile'), 600)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '保存失败，请重试')
    } finally {
      setSavePending(false)
    }
  }

  const keepEditing = () => {
    if (blocker.state === 'blocked') blocker.reset()
    if (overlay === 'discard') closeOverlay()
  }

  const discardChanges = () => {
    bypassGuard.current = true
    if (blocker.state === 'blocked') {
      blocker.proceed()
      return
    }
    if (overlay === 'discard') closeOverlay()
    navigate('/profile')
  }

  return (
    <PageContainer className="pb-24">
      {profileLoad === 'error' && (
        <div
          role="alert"
          className="relative z-10 mt-2 flex items-center gap-2 rounded-control bg-surface-subtle px-4 py-2.5 text-xs text-text-secondary"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-danger-text" aria-hidden />
          <span className="min-w-0 flex-1">会员资料加载失败，无法修改资料</span>
          <button
            type="button"
            onClick={() => void reloadIdentity()}
            className="shrink-0 font-medium text-text-brand"
          >
            重试
          </button>
        </div>
      )}

      {saveError && (
        <p role="alert" className="relative z-10 mx-4 mt-2 rounded-control bg-warning-bg px-3 py-2 text-sm text-warning-text">{saveError}</p>
      )}
      <section className="relative z-10 mt-2 rounded-2xl bg-surface shadow-sm">
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
          <span className="w-20 shrink-0 whitespace-nowrap text-sm text-text-tertiary">头像</span>
          <span className="flex min-w-0 flex-1 justify-end">
            <button type="button" onClick={() => setSheet('avatar')} className="h-11 w-11 overflow-hidden rounded-full" aria-label="修改头像">
              <UserAvatar src={avatarSrc} />
            </button>
          </span>
          <button type="button" onClick={() => setSheet('avatar')} aria-label="修改头像" className="shrink-0 text-text-tertiary">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
          <span className="w-20 shrink-0 whitespace-nowrap text-sm text-text-tertiary">昵称</span>
          <span className="min-w-0 flex-1 truncate text-right text-sm text-text-primary">
            {profileLoad === 'loading' ? <span className="text-text-tertiary">加载中…</span> : nickname}
          </span>
          <button type="button" onClick={() => setSheet('nickname')} aria-label="修改昵称" className="shrink-0 text-text-tertiary">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <button type="button" onClick={() => setSheet('birthday')} aria-label="修改生日"
          className="flex w-full items-center gap-3 border-b border-border-subtle px-4 py-3 text-left">
          <span className="w-20 shrink-0 whitespace-nowrap text-sm text-text-tertiary">生日</span>
          <span className="min-w-0 flex-1 text-right text-sm text-text-primary">
            {identity.state !== 'success' ? '—' : identity.data.birthday === undefined ? '尚未开放' : birthday || '未填写'}
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-text-tertiary" aria-hidden />
        </button>
        <button type="button" onClick={() => setSheet('pin')} aria-label="设置消费密码"
          className="flex w-full items-center gap-3 px-4 py-3 text-left">
          <span className="w-20 shrink-0 whitespace-nowrap text-sm text-text-tertiary">消费密码</span>
          <span className="min-w-0 flex-1 text-right text-sm text-text-tertiary">
            {pin.length === 6 || pinSubmitted || pinConfigured === true
              ? '●●●●●●'
              : pinConfigured === false ? '未设置' : '设置'}
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-text-tertiary" aria-hidden />
        </button>
      </section>

      <section className="relative z-10 mt-6 px-4">
        <h2 className="text-base font-semibold text-text-primary">年级</h2>
        <p className="mt-1 text-sm text-text-tertiary">选择您当前的年级，将用于匹配校园活动与权益</p>
        <div className="mt-3 space-y-4">
          {yearGroups.map((group) => (
            <div key={group.group}>
              <p className="mb-2 text-xs font-medium text-text-secondary">{group.group}</p>
              <div className="grid grid-cols-5 gap-2">
                {group.items.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => { touchedRef.current.year = true; setYear(item) }}
                    aria-pressed={year === item}
                    className={`h-9 rounded-lg border text-sm ${
                      year === item ? 'border-primary bg-surface-selected text-text-brand' : 'border-border bg-surface text-text-primary'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={() => void confirmAll()}
        disabled={savePending || profileLoad !== 'ready'}
        className="relative z-10 mx-auto mt-8 flex h-12 w-full max-w-[343px] items-center justify-center rounded-2xl bg-primary text-sm font-medium text-white active:bg-primary-pressed"
      >
        {savePending ? '正在保存…' : '确认修改'}
      </button>

      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-scrim" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={{ nickname: '修改昵称', avatar: '修改头像', birthday: '修改生日', pin: '设置消费密码' }[sheet]}
            className="w-full max-w-[448px] rounded-t-overlay bg-surface px-4 pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-border" aria-hidden />
            <div className="flex items-start justify-between px-4 pb-2 pt-1">
              <h2 className="text-lg font-semibold text-text-primary">
                {sheet === 'avatar' && '修改头像'}
                {sheet === 'nickname' && '修改昵称'}
                {sheet === 'birthday' && '修改生日'}
                {sheet === 'pin' && '设置消费密码'}
              </h2>
              <button type="button" aria-label="关闭" onClick={close} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-subtle text-text-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 py-3">
              {sheet === 'avatar' && (
                <>
                  <p className="text-sm text-text-tertiary">选择一种方式更新您的会员头像</p>
                  <button
                    type="button"
                    onClick={() => void updateAvatar('photo')}
                    disabled={avatarPending !== null}
                    className="mt-4 flex w-full items-center gap-3 rounded-xl p-2.5 active:bg-surface-subtle disabled:opacity-60"
                  >
                    <Camera className="h-5 w-5 text-text-secondary" />
                    <span className="text-sm text-text-primary">
                      {avatarPending === 'photo' ? '正在调用相机…' : '拍照'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateAvatar('album')}
                    disabled={avatarPending !== null}
                    className="flex w-full items-center gap-3 rounded-xl p-2.5 active:bg-surface-subtle disabled:opacity-60"
                  >
                    <Image className="h-5 w-5 text-text-secondary" />
                    <span className="text-sm text-text-primary">
                      {avatarPending === 'album' ? '正在打开相册…' : '从相册选择'}
                    </span>
                  </button>
                  {avatarError && (
                    <p role="alert" className="mt-2 text-xs text-danger-text">
                      {avatarError}
                    </p>
                  )}
                  <div className="my-2 h-px bg-border-subtle" />
                  <button type="button" onClick={close} className="flex w-full items-center gap-3 rounded-xl p-2.5 active:bg-surface-subtle">
                    <X className="h-5 w-5 text-text-secondary" />
                    <span className="text-sm text-text-primary">取消</span>
                  </button>
                </>
              )}

              {sheet === 'birthday' && (
                <>
                  <label className="block text-sm text-text-primary">
                    生日
                    <input type="date" value={birthday}
                      onChange={(event) => { touchedRef.current.birthday = true; setBirthday(event.target.value) }}
                      className="mt-2 block h-11 w-full rounded-control border border-border bg-surface px-3 text-base" />
                  </label>
                  <button type="button" onClick={save}
                    className="mt-5 h-11 w-full rounded-control bg-primary text-sm font-medium text-text-inverse">完成</button>
                </>
              )}
              {sheet === 'pin' && (
                <>
                  <p className="text-sm text-text-tertiary">设置 6 位数字消费密码，确认修改后提交至账户服务。</p>
                  <label className="mt-4 block text-sm text-text-primary">
                    新消费密码
                    <input type="password" autoComplete="new-password" inputMode="numeric" maxLength={6}
                      value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="mt-1.5 block h-11 w-full rounded-control border border-border bg-surface px-3 text-base" />
                  </label>
                  <label className="mt-4 block text-sm text-text-primary">
                    确认消费密码
                    <input type="password" autoComplete="new-password" inputMode="numeric" maxLength={6}
                      value={pinConfirmation} onChange={(event) => setPinConfirmation(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="mt-1.5 block h-11 w-full rounded-control border border-border bg-surface px-3 text-base" />
                  </label>
                  <button type="button" onClick={save}
                    className="mt-5 h-11 w-full rounded-control bg-primary text-sm font-medium text-text-inverse">完成</button>
                </>
              )}
              {sheet === 'nickname' && (
                <>
                  <p className="text-sm text-text-tertiary">昵称将展示在您的会员主页与互动记录中</p>
                  <label className="mt-4 block text-sm text-text-primary">
                    昵称
                    <input
                      value={nickname}
                      maxLength={12}
                      onChange={(e) => { touchedRef.current.nickname = true; setNickname(e.target.value) }}
                      placeholder="请输入昵称"
                      className="mt-1.5 block h-11 w-full rounded-control border border-border bg-surface px-3 text-base outline-none focus:border-primary"
                    />
                  </label>
                  <button type="button" onClick={save} className="mt-5 h-11 w-full rounded-control bg-primary text-sm font-medium text-text-inverse active:bg-primary-pressed">
                    保存
                  </button>
                </>
              )}


            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" className="fixed inset-x-0 top-16 z-50 mx-auto flex w-fit items-center gap-2 rounded-control bg-surface-inverse px-4 py-2 text-sm text-text-inverse shadow-floating">
          <CheckCircle2 className="h-4 w-4" />
          {toast}
        </div>
      )}

      <PromptOverlay
        open={discardOpen}
        label="放弃修改确认"
        onDismiss={keepEditing}
        className="bg-surface px-5 pb-5 pt-6 text-center"
      >
        <IconButton
          icon={X}
          label="继续编辑"
          onClick={keepEditing}
          className="absolute right-3 top-3 text-text-secondary"
        />

        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning-bg text-warning-text">
          <X className="h-6 w-6" aria-hidden />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-text-primary">放弃本次修改？</h2>
        <p className="mt-2 text-sm leading-6 text-text-secondary">确认放弃刚刚的修改吗？未保存的内容将不会保留。</p>

        <div className="mt-5 flex gap-3">
          <Button variant="outline" size="large" className="flex-1 rounded-pill" onClick={keepEditing}>
            继续编辑
          </Button>
          <Button variant="destructive" size="large" className="flex-1 rounded-pill" onClick={discardChanges}>
            放弃修改
          </Button>
        </div>
      </PromptOverlay>
    </PageContainer>
  )
}

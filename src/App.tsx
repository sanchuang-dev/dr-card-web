import { useEffect, useRef, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import NewcomerDialog from './components/mobile/NewcomerDialog'
import { getAuthSession, type NewUserPopup } from './services/auth/session'
import { STORAGE_KEYS, storage } from './storage'

function getUserPopupSeenId(userInfo: unknown): string | undefined {
  if (!userInfo || typeof userInfo !== 'object') return undefined
  const user = userInfo as Record<string, unknown>
  const id = user.id ?? user.user_id ?? user.uid
  return (typeof id === 'string' || typeof id === 'number') && String(id).trim()
    ? String(id)
    : undefined
}

export default function App() {
  const [newUserPopup, setNewUserPopup] = useState<NewUserPopup | null>(null)
  const pendingSeenUserId = useRef<string | undefined>(undefined)

  useEffect(() => {
    let popupHandledThisDocument = false
    const handleSessionChanged = () => {
      const session = getAuthSession()
      if (session?.is_new_user !== true || !session.popup) {
        setNewUserPopup(null)
        pendingSeenUserId.current = undefined
        return
      }

      const seenUserId = getUserPopupSeenId(session.userInfo)
      if (seenUserId && storage.read(STORAGE_KEYS.newUserPopupSeen)?.[seenUserId]) {
        setNewUserPopup(null)
        return
      }
      if (popupHandledThisDocument) return
      popupHandledThisDocument = true
      pendingSeenUserId.current = seenUserId
      setNewUserPopup(session.popup)
    }

    window.addEventListener('dr-card-ui:auth-session-changed', handleSessionChanged)
    // Handle a login that completed just before this listener was mounted.
    handleSessionChanged()
    return () => window.removeEventListener('dr-card-ui:auth-session-changed', handleSessionChanged)
  }, [])

  const dismissPopup = () => {
    const seenUserId = pendingSeenUserId.current
    if (seenUserId) {
      const seenUsers = storage.read(STORAGE_KEYS.newUserPopupSeen) ?? {}
      storage.write(STORAGE_KEYS.newUserPopupSeen, { ...seenUsers, [seenUserId]: true })
    }
    pendingSeenUserId.current = undefined
    setNewUserPopup(null)
  }

  return (
    <>
      <RouterProvider router={router} />
      <NewcomerDialog open={newUserPopup !== null} title={newUserPopup?.title ?? ''}
        description={newUserPopup?.description ?? ''} points={newUserPopup?.points ?? ''}
        onComplete={dismissPopup} onDismiss={dismissPopup} />
    </>
  )
}

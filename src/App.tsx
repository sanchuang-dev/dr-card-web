import { useEffect, useRef, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import NewcomerDialog from './components/mobile/NewcomerDialog'
import { getAuthSession, type NewUserPopup } from './services/auth/session'

function getUserPopupSeenKey(userInfo: unknown): string | undefined {
  if (!userInfo || typeof userInfo !== 'object') return undefined
  const user = userInfo as Record<string, unknown>
  const id = user.id ?? user.user_id ?? user.uid
  return (typeof id === 'string' || typeof id === 'number') && String(id).trim()
    ? `dr-card-ui:new-user-popup-seen:${String(id)}`
    : undefined
}

export default function App() {
  const [newUserPopup, setNewUserPopup] = useState<NewUserPopup | null>(null)
  const pendingSeenKey = useRef<string | undefined>(undefined)

  useEffect(() => {
    let popupHandledThisDocument = false
    const handleSessionChanged = () => {
      const session = getAuthSession()
      if (session?.is_new_user !== true || !session.popup) {
        setNewUserPopup(null)
        pendingSeenKey.current = undefined
        return
      }

      const seenKey = getUserPopupSeenKey(session.userInfo)
      if (seenKey) {
        try {
          if (window.sessionStorage.getItem(seenKey) === '1') {
            setNewUserPopup(null)
            return
          }
        } catch {
          // Continue with in-memory deduplication if WebView storage is unavailable.
        }
      }
      if (popupHandledThisDocument) return
      popupHandledThisDocument = true
      pendingSeenKey.current = seenKey
      setNewUserPopup(session.popup)
    }

    window.addEventListener('dr-card-ui:auth-session-changed', handleSessionChanged)
    // Handle a login that completed just before this listener was mounted.
    handleSessionChanged()
    return () => window.removeEventListener('dr-card-ui:auth-session-changed', handleSessionChanged)
  }, [])

  const dismissPopup = () => {
    const seenKey = pendingSeenKey.current
    if (seenKey) {
      try {
        window.sessionStorage.setItem(seenKey, '1')
      } catch {
        // The in-memory session guard still prevents repeated display until reload.
      }
    }
    pendingSeenKey.current = undefined
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

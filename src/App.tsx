import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import { initialEntryRedirect } from './app/router/entryRedirect'
import NewcomerDialog from './components/mobile/NewcomerDialog'
import { getAuthSession, type NewUserPopup } from './services/auth/session'

export default function App() {
  const [newUserPopup, setNewUserPopup] = useState<NewUserPopup | null>(null)
  const popupHandledThisDocument = useRef(false)

  // Hide the new-user dialog only while React Router resolves the initial
  // deep-link loader. Once resolved, preserve its existing global behavior.
  const routerInitialized = useSyncExternalStore(
    router.subscribe,
    () => router.state.initialized,
  )
  const entryRedirectPending = initialEntryRedirect !== null && !routerInitialized

  useEffect(() => {
    const handleSessionChanged = () => {
      const session = getAuthSession()
      if (session?.is_new_user !== true || !session.popup) {
        setNewUserPopup(null)
        return
      }
      // The auth event can fire on multiple API/session refreshes. Show only once
      // during this page lifetime; do not add unconfirmed persistent storage keys.
      if (popupHandledThisDocument.current) return
      popupHandledThisDocument.current = true
      setNewUserPopup(session.popup)
    }

    window.addEventListener('dr-card-ui:auth-session-changed', handleSessionChanged)
    handleSessionChanged()
    return () => window.removeEventListener('dr-card-ui:auth-session-changed', handleSessionChanged)
  }, [])

  const dismissPopup = () => setNewUserPopup(null)
  return (
    <>
      <RouterProvider router={router} />
      <NewcomerDialog open={newUserPopup !== null && !entryRedirectPending} title={newUserPopup?.title ?? ''}
        description={newUserPopup?.description ?? ''} points={newUserPopup?.points ?? ''}
        onComplete={dismissPopup} onDismiss={dismissPopup} />
    </>
  )
}

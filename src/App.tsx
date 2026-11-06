import { useEffect, useRef, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import NewUserRewardDialog from './components/mobile/NewUserRewardDialog'
import { getAuthSession, getNewUserPopup } from './services/auth/session'

export default function App() {
  const [newUserPopup, setNewUserPopup] = useState<ReturnType<typeof getNewUserPopup>>(null)
  const popupHandledThisDocument = useRef(false)

  useEffect(() => {
    const handleSessionChanged = () => {
      const popup = getNewUserPopup(getAuthSession())
      if (!popup) {
        setNewUserPopup(null)
        return
      }
      if (popupHandledThisDocument.current) return
      popupHandledThisDocument.current = true
      setNewUserPopup(popup)
    }

    window.addEventListener('dr-card-ui:auth-session-changed', handleSessionChanged)
    // Cover the case where the Native login completed before App subscribed.
    handleSessionChanged()
    return () => window.removeEventListener('dr-card-ui:auth-session-changed', handleSessionChanged)
  }, [])

  const dismissPopup = () => setNewUserPopup(null)

  return (
    <>
      <RouterProvider router={router} />
      <NewUserRewardDialog
        open={newUserPopup !== null}
        title={newUserPopup?.title ?? ''}
        description={newUserPopup?.description ?? ''}
        points={newUserPopup?.points}
        onComplete={dismissPopup}
        onDismiss={dismissPopup}
      />
    </>
  )
}

import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import NewcomerDialog from './components/mobile/NewcomerDialog'
import { getAuthSession, type NewUserPopup } from './services/auth/session'

export default function App() {
  const [newUserPopup, setNewUserPopup] = useState<NewUserPopup | null>(null)

  useEffect(() => {
    const handleSessionChanged = () => {
      const session = getAuthSession()
      setNewUserPopup(session?.is_new_user === true && session.popup ? session.popup : null)
    }
    window.addEventListener('dr-card-ui:auth-session-changed', handleSessionChanged)
    return () => window.removeEventListener('dr-card-ui:auth-session-changed', handleSessionChanged)
  }, [])

  const dismissPopup = () => setNewUserPopup(null)
  return (
    <>
      <RouterProvider router={router} />
      <NewcomerDialog open={newUserPopup !== null} title={newUserPopup?.title ?? ''}
        description={newUserPopup?.description ?? ''} points={newUserPopup?.points ?? ''}
        onComplete={dismissPopup} onDismiss={dismissPopup} />
    </>
  )
}

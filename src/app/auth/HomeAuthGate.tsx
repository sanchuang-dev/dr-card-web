import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { runtimePolicy } from '../config/runtime'
import { bootstrapAuthSession, setAuthFlowEnabled } from '../../services/auth/session'
import { isAppError } from '../../services/http/appError'

export default function HomeAuthGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [ready, setReady] = useState(runtimePolicy.dataMode !== 'api')

  useEffect(() => {
    if (runtimePolicy.dataMode !== 'api') return

    let active = true
    setAuthFlowEnabled(false)
    void bootstrapAuthSession().then(
      () => {
        if (!active) return
        setAuthFlowEnabled(true)
        setReady(true)
      },
      (error) => {
        if (!active) return
        if (isAppError(error) && error.status === 401) return
        navigate('/error?reason=auth', { replace: true })
      },
    )

    return () => {
      active = false
    }
  }, [navigate])

  if (!ready) {
    return (
      <main
        className="flex min-h-[50vh] items-center justify-center px-6 text-sm text-text-secondary"
        aria-live="polite"
        data-auth-state="loading"
      >
        正在验证登录状态...
      </main>
    )
  }

  return children
}

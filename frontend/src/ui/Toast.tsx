import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

interface ToastAction {
  label: string
  onClick(): void
}
interface ToastApi {
  show(text: string, action?: ToastAction): void
}

const ToastContext = createContext<ToastApi | null>(null)
const DURATION_MS = 4000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ text: string; action?: ToastAction } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((text: string, action?: ToastAction) => {
    window.clearTimeout(timer.current)
    setToast({ text, action })
    timer.current = window.setTimeout(() => setToast(null), DURATION_MS)
  }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const api = useMemo(() => ({ show }), [show])
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast glass">
            <span>{toast.text}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  toast.action?.onClick()
                  window.clearTimeout(timer.current)
                  setToast(null)
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

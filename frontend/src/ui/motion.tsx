import { LazyMotion, m, useReducedMotion } from 'motion/react'
import type { Transition } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { fmt } from './format'

// One springy feel for every press, pop and screen change.
export const SPRING: Transition = { type: 'spring', stiffness: 520, damping: 32, mass: 0.8 }
// Under reduced motion springs give way to a short fade.
export const FADE: Transition = { duration: 0.15, ease: 'easeOut' }
// Fills (ring arc, macro bars, counting numbers) glide without overshoot.
export const FILL: Transition = { duration: 0.8, ease: [0.22, 1, 0.36, 1] }

// Loads Motion's animation features once for every `m.*` element below it
// (`m` + LazyMotion keeps the main bundle far smaller than `motion.*`).
const loadFeatures = () => import('./motionFeatures').then((r) => r.default)

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  )
}

// True when motion should be kept to a minimum. Without matchMedia (jsdom,
// very old browsers) the preference is unknown, so the calm path is taken:
// numbers and fills then show their final values straight away.
export function useReducedMotionSafe(): boolean {
  const reduced = useReducedMotion()
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  return reduced === true
}

// Whole numbers count in whole steps, fractional ones in tenths (like fmt).
const step = (n: number, target: number) => (Number.isInteger(target) ? Math.round(n) : Math.round(n * 10) / 10)

// Same feel as FILL; a hand-rolled tween because Motion's animate() alone
// would add tens of KB to the main bundle.
const COUNT_MS = 800
const easeOut = (t: number) => 1 - (1 - t) ** 4

// Counts from the previous value (0 on first show) to `value`, formatted with fmt.
export function AnimatedNumber({ value }: { value: number }) {
  const reduced = useReducedMotionSafe()
  const [shown, setShown] = useState(reduced ? value : 0)
  const from = useRef(shown)
  useEffect(() => {
    if (reduced) return
    const start = from.current
    let t0: number | null = null
    let raf = requestAnimationFrame(function tick(now) {
      t0 ??= now
      const t = Math.min((now - t0) / COUNT_MS, 1)
      from.current = start + (value - start) * easeOut(t)
      setShown(t === 1 ? value : step(from.current, value))
      if (t < 1) raf = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(raf)
  }, [value, reduced])
  return <>{fmt(reduced ? value : shown)}</>
}

// Each routed screen fades in with a slight rise when the path changes.
// The rise moves `top`, not a transform: a transformed wrapper would become the
// containing block of the screen's position: fixed parts (FAB, sheets).
export function ScreenTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const reduced = useReducedMotionSafe()
  return (
    <m.div
      key={pathname}
      className="screen"
      initial={reduced ? { opacity: 0 } : { opacity: 0, top: 14 }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, top: 0 }}
      transition={reduced ? FADE : SPRING}
    >
      {children}
    </m.div>
  )
}

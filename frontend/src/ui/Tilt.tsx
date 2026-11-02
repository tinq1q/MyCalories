import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useReducedMotionSafe } from './motion'

const MAX_DEG = 6
const clamp = (n: number) => Math.max(-1, Math.min(1, n))

// iOS asks for permission before sending orientation events; that prompt is never shown.
type OrientationCtor = { requestPermission?: unknown }
function canUseOrientation(): boolean {
  if (typeof window === 'undefined' || typeof window.DeviceOrientationEvent === 'undefined') return false
  return typeof (window.DeviceOrientationEvent as unknown as OrientationCtor).requestPermission !== 'function'
}

// Tilts its card a little and moves a glare over it: after the cursor on a
// mouse, by the gyroscope on a phone. Only transform and opacity change, and
// no pointer or touch event is consumed, so swipes and inputs keep working.
export default function Tilt({ children }: { children: ReactNode }) {
  const reduced = useReducedMotionSafe()
  const root = useRef<HTMLDivElement>(null)
  const glare = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = root.current
    const gl = glare.current
    if (reduced || !el || !gl) return
    let raf = 0
    // nx, ny in -1..1 from the card centre; null puts the card back flat.
    const apply = (nx: number | null, ny = 0) => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (nx === null) {
          el.style.transform = ''
          gl.style.opacity = '0'
          return
        }
        el.style.transform = `perspective(900px) rotateX(${(-ny * MAX_DEG).toFixed(2)}deg) rotateY(${(nx * MAX_DEG).toFixed(2)}deg)`
        gl.style.transform = `translate(${(((nx + 1) / 2) * el.offsetWidth).toFixed(1)}px, ${(((ny + 1) / 2) * el.offsetHeight).toFixed(1)}px) translate(-50%, -50%)`
        gl.style.opacity = '1'
      })
    }

    let off: () => void
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      const move = (e: PointerEvent) => {
        if (e.pointerType !== 'mouse') return
        const r = el.getBoundingClientRect()
        apply(clamp(((e.clientX - r.left) / r.width) * 2 - 1), clamp(((e.clientY - r.top) / r.height) * 2 - 1))
      }
      const leave = () => apply(null)
      el.addEventListener('pointermove', move)
      el.addEventListener('pointerleave', leave)
      off = () => {
        el.removeEventListener('pointermove', move)
        el.removeEventListener('pointerleave', leave)
      }
    } else if (canUseOrientation()) {
      // Phone held upright-ish: beta ~45° is "flat" for the card.
      const orient = (e: DeviceOrientationEvent) => {
        if (e.beta === null || e.gamma === null) return
        apply(clamp(e.gamma / 30), clamp((e.beta - 45) / 30))
      }
      window.addEventListener('deviceorientation', orient)
      off = () => window.removeEventListener('deviceorientation', orient)
    } else {
      return
    }
    return () => {
      off()
      cancelAnimationFrame(raf)
      el.style.transform = ''
    }
  }, [reduced])

  return (
    <div className="tilt" ref={root}>
      {children}
      <span className="tilt-glare-clip" aria-hidden="true">
        <span className="tilt-glare" ref={glare} />
      </span>
    </div>
  )
}

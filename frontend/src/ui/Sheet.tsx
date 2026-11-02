import { useEffect, useRef } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import { m, useDragControls } from 'motion/react'
import type { PanInfo } from 'motion/react'
import { FADE, SPRING, useReducedMotionSafe } from './motion'

// Pulling the panel down this far (px), or flicking it down this fast (px/s), closes it.
const CLOSE_OFFSET = 120
const CLOSE_VELOCITY = 500

// Fields and buttons keep their own taps and text selection; drags start elsewhere.
const NO_DRAG = 'input, textarea, select, button, a, label'

interface Props {
  label: string
  onClose(): void
  className?: string
  children: ReactNode
}

// Backdrop + bottom glass panel. Drag it down, press Escape or tap the backdrop to close.
// Until Motion's drag features have loaded the drag simply does nothing.
export default function Sheet({ label, onClose, className, children }: Props) {
  const reduced = useReducedMotionSafe()
  const controls = useDragControls()
  // A drag that ends over the backdrop must not count as a backdrop tap.
  const dragged = useRef(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const startDrag = (e: PointerEvent) => {
    if (!(e.target as Element).closest(NO_DRAG)) controls.start(e)
  }

  const dragEnd = (_: unknown, info: PanInfo) => {
    window.setTimeout(() => (dragged.current = false))
    if (info.offset.y > CLOSE_OFFSET || (info.offset.y > 0 && info.velocity.y > CLOSE_VELOCITY)) onClose()
  }

  return (
    <div
      className="sheet-backdrop"
      data-testid="sheet-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !dragged.current) onClose()
      }}
      // Keeps Today's swipe-to-change-day from reacting to gestures in the sheet.
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <m.div
        className={className ? `sheet glass ${className}` : 'sheet glass'}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        initial={reduced ? { opacity: 0 } : { y: '100%' }}
        animate={reduced ? { opacity: 1 } : { y: 0 }}
        transition={reduced ? FADE : SPRING}
        drag="y"
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 1 }}
        // Under reduced motion the panel settles back without a bounce.
        dragTransition={reduced ? { bounceStiffness: 2000, bounceDamping: 120 } : undefined}
        onPointerDown={startDrag}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={dragEnd}
      >
        <span className="sheet-grip" aria-hidden="true" />
        {children}
      </m.div>
    </div>
  )
}

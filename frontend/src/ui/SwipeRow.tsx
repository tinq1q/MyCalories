import { useRef } from 'react'
import type { ReactNode } from 'react'
import { m, useMotionValue, useTransform } from 'motion/react'
import type { PanInfo } from 'motion/react'
import { useReducedMotionSafe } from './motion'

// Share of the row's width a left swipe must cover to delete.
const DELETE_SHARE = 0.4

// Row that deletes itself when swiped left past 40% of its width.
// drag="x" leaves vertical panning to the browser, so scrolling over rows never swipes.
export default function SwipeRow({ onDelete, children }: { onDelete(): void; children: ReactNode }) {
  const reduced = useReducedMotionSafe()
  const row = useRef<HTMLDivElement>(null)
  const dragged = useRef(false)
  const x = useMotionValue(0)
  const hint = useTransform(x, [-70, -20], [1, 0])

  const dragEnd = (_: unknown, info: PanInfo) => {
    window.setTimeout(() => (dragged.current = false))
    const width = row.current?.offsetWidth ?? 0
    if (width > 0 && -info.offset.x > width * DELETE_SHARE) onDelete()
  }

  return (
    <div
      className="swipe-row"
      ref={row}
      // Keeps Today's swipe-to-change-day from reacting to a row swipe.
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <m.span className="swipe-row-hint" style={{ opacity: hint }} aria-hidden="true">
        Удалить
      </m.span>
      <m.div
        className="swipe-row-fg"
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 1, right: 0 }}
        dragTransition={reduced ? { bounceStiffness: 2000, bounceDamping: 120 } : undefined}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={dragEnd}
        // A swipe that falls short must not also open the entry.
        onClickCapture={(e) => {
          if (!dragged.current) return
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        {children}
      </m.div>
    </div>
  )
}

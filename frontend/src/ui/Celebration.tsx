import { m } from 'motion/react'
import { useEffect, useState } from 'react'
import { useReducedMotionSafe } from './motion'

// Confetti colours follow the active theme.
const COLORS = ['var(--protein)', 'var(--fat)', 'var(--carbs)', 'var(--ring-from)', 'var(--ring-to)']
const COUNT = 26
const DURATION = 1.3

interface Piece {
  x: number
  y: number
  rotate: number
  delay: number
  color: string
  round: boolean
}

function makePieces(): Piece[] {
  return Array.from({ length: COUNT }, (_, i) => {
    const angle = (i / COUNT) * Math.PI * 2 + Math.random() * 0.4
    const dist = 50 + Math.random() * 40
    return {
      // Narrower sideways: the ring sits near the screen edge and must not cause scrolling.
      x: Math.cos(angle) * dist * 0.7,
      // A little extra fall so the burst settles downwards.
      y: Math.sin(angle) * dist + 30,
      rotate: (Math.random() - 0.5) * 540,
      delay: Math.random() * 0.12,
      color: COLORS[i % COLORS.length],
      round: i % 3 === 0,
    }
  })
}

// A short burst of confetti from the centre of its positioned parent.
// Under reduced motion nothing is drawn and it finishes at once.
export default function Celebration({ onDone }: { onDone: () => void }) {
  const reduced = useReducedMotionSafe()
  const [pieces] = useState(makePieces)
  useEffect(() => {
    const t = window.setTimeout(onDone, reduced ? 0 : (DURATION + 0.15) * 1000)
    return () => window.clearTimeout(t)
  }, [onDone, reduced])
  if (reduced) return null
  return (
    <span className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <m.i
          key={i}
          className={p.round ? 'is-round' : undefined}
          style={{ background: p.color }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 0.6 }}
          animate={{ x: p.x, y: p.y, rotate: p.rotate, opacity: 0, scale: 1 }}
          transition={{ duration: DURATION, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </span>
  )
}

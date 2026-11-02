import { m } from 'motion/react'
import type { Norm } from '../domain/types'
import { fmt } from './format'
import { AnimatedNumber, FILL, useReducedMotionSafe } from './motion'

const ITEMS = [
  { key: 'protein', label: 'Белки', color: 'var(--protein)' },
  { key: 'fat', label: 'Жиры', color: 'var(--fat)' },
  { key: 'carbs', label: 'Углеводы', color: 'var(--carbs)' },
] as const

// Bars grow one after another, this far apart (seconds).
const STAGGER = 0.08

export default function MacroBars({ totals, norm }: { totals: Norm; norm: Norm | null }) {
  const reduced = useReducedMotionSafe()
  return (
    <div className="macros">
      {ITEMS.map(({ key, label, color }, i) => {
        const pct = norm && norm[key] > 0 ? Math.min((totals[key] / norm[key]) * 100, 100) : 0
        return (
          <div className="macro" key={key}>
            <span className="macro-label">{label}</span>
            <b><AnimatedNumber value={totals[key]} /> г</b>
            {norm && <span className="macro-norm">из {fmt(norm[key])}</span>}
            <div className="bar">
              <m.i
                style={{ background: color }}
                initial={reduced ? false : { width: '0%' }}
                animate={{ width: `${pct}%` }}
                transition={reduced ? { duration: 0 } : { ...FILL, delay: i * STAGGER }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

import { useId } from 'react'
import { fmt } from './format'

const R = 40
const C = 2 * Math.PI * R

interface RingProps {
  value: number
  // Without a norm there is nothing to fill: only the number is drawn.
  max: number | null
  size?: number
}

export default function Ring({ value, max, size = 104 }: RingProps) {
  const gid = useId()
  if (max === null || max <= 0) {
    return <span className="ring-number">{fmt(value)}</span>
  }
  const ratio = Math.min(Math.max(value / max, 0), 1)
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--ring-from)" />
            <stop offset="1" stopColor="var(--ring-to)" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--ring-track)" strokeWidth="11" />
        <circle
          className="ring-arc"
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - ratio)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className="ring-center">{fmt(value)}</span>
    </div>
  )
}

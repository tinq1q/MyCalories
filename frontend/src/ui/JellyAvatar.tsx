import { m } from 'motion/react'
import type { Transition } from 'motion/react'
import { useId } from 'react'
import { bmi, bodyDims, fullness, heightScale } from '../domain/avatar'
import type { BodyDims } from '../domain/avatar'
import type { Sex } from '../domain/types'
import { useReducedMotionSafe } from './motion'

// Avatar units: x is centred on 0, the feet stand on y = FOOT. A 180 cm figure
// is drawn as is; other heights stretch the body from the feet up, the head
// keeps its size and rides on top.
const FOOT = 232
const TOP = 88 // shoulders
const MID = 140 // waist
const HIP = 175
const HEAD_R = 34
const HEAD_Y = 44 // head centre at 180 cm
const VIEW = '-110 -30 220 280'
const SIZES = { large: 180, mini: 56 } as const

// Softer than SPRING: the figure flows into its new shape with a little wobble.
const JELLY: Transition = { type: 'spring', stiffness: 140, damping: 14, mass: 1 }

const r = (n: number) => Math.round(n * 100) / 100

// Every builder keeps one command structure, so Motion can morph between shapes.
function bodyPath(d: BodyDims, k: number) {
  const Y = (y: number) => r(FOOT - (FOOT - y) * k)
  const { shoulder: sh, waist: wa, hip: hp, leg: lg } = d
  return [
    `M ${r(-sh)} ${Y(TOP + 6)} Q ${r(-sh)} ${Y(TOP)} ${r(-sh + 10)} ${Y(TOP)} L ${r(sh - 10)} ${Y(TOP)} Q ${r(sh)} ${Y(TOP)} ${r(sh)} ${Y(TOP + 6)}`,
    `C ${r(sh + 2)} ${Y(TOP + 30)} ${r(wa + 4)} ${Y(MID - 12)} ${r(wa)} ${Y(MID)}`,
    `C ${r(wa + 2)} ${Y(MID + 16)} ${r(hp + 2)} ${Y(HIP - 14)} ${r(hp)} ${Y(HIP)}`,
    `C ${r(hp)} ${Y(HIP + 20)} ${r(lg + 8)} ${Y(FOOT - 30)} ${r(lg + 8)} ${Y(FOOT - 6)}`,
    `Q ${r(lg + 8)} ${FOOT} ${r(lg)} ${FOOT} L 6 ${FOOT} Q 2 ${FOOT} 2 ${Y(FOOT - 6)} L 2 ${Y(HIP + 12)}`,
    `L -2 ${Y(HIP + 12)} L -2 ${Y(FOOT - 6)} Q -2 ${FOOT} -6 ${FOOT} L ${r(-lg)} ${FOOT} Q ${r(-lg - 8)} ${FOOT} ${r(-lg - 8)} ${Y(FOOT - 6)}`,
    `C ${r(-lg - 8)} ${Y(FOOT - 30)} ${r(-hp)} ${Y(HIP + 20)} ${r(-hp)} ${Y(HIP)}`,
    `C ${r(-hp - 2)} ${Y(HIP - 14)} ${r(-wa - 2)} ${Y(MID + 16)} ${r(-wa)} ${Y(MID)}`,
    `C ${r(-wa - 4)} ${Y(MID - 12)} ${r(-sh - 2)} ${Y(TOP + 30)} ${r(-sh)} ${Y(TOP + 6)} Z`,
  ].join(' ')
}

function armPath(d: BodyDims, k: number, side: 1 | -1) {
  const Y = (y: number) => r(FOOT - (FOOT - y) * k)
  const x = side * (Math.max(d.shoulder, d.waist) + d.arm + 8)
  return `M ${r(side * (d.shoulder - 2))} ${Y(98)} Q ${r(x + side * 4)} ${Y(118)} ${r(x)} ${Y(150)}`
}

// The white streak down the left side of the torso.
function shinePath(d: BodyDims, k: number) {
  const Y = (y: number) => r(FOOT - (FOOT - y) * k)
  return `M ${r(-d.shoulder + 10)} ${Y(100)} Q ${r(-d.waist)} ${Y(130)} ${r(-d.waist + 4)} ${Y(160)}`
}

const HAIR: Record<Sex, string> = {
  female:
    'M -36 40 Q -40 -2 0 -2 Q 40 -2 36 40 Q 40 70 30 80 Q 26 50 18 30 Q 0 20 -18 30 Q -26 50 -30 80 Q -40 70 -36 40 Z',
  male: 'M -32 30 Q -34 -2 0 -2 Q 34 -2 32 30 Q 20 14 0 18 Q -20 14 -32 30 Z',
}

interface JellyAvatarProps {
  heightCm: number
  sex: Sex
  weightKg: number
  // Draws the figure at this weight as a dashed outline.
  targetKg?: number | null
  size?: 'large' | 'mini'
}

export default function JellyAvatar({ heightCm, sex, weightKg, targetKg, size = 'large' }: JellyAvatarProps) {
  const id = useId()
  const reduced = useReducedMotionSafe()
  // Keeps extreme heights inside the frame.
  const k = Math.min(Math.max(heightScale(heightCm), 0.7), 1.25)
  const d = bodyDims(sex, fullness(bmi(heightCm, weightKg)))
  const hasGoal = typeof targetKg === 'number' && Number.isFinite(targetKg)
  const goal = hasGoal ? bodyDims(sex, fullness(bmi(heightCm, targetKg))) : null
  // The head sits the same distance above the shoulders at any height.
  const headShift = r(FOOT - (FOOT - TOP) * k - TOP)
  const t = reduced ? { duration: 0 } : JELLY
  const width = SIZES[size]
  const body = `url(#${id}b)`

  return (
    <svg
      className={`jelly jelly-${size}`}
      viewBox={VIEW}
      width={width}
      height={Math.round((width * 280) / 220)}
      role="img"
      aria-label="Аватар"
    >
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--avatar-fill-from)' }} />
          <stop offset="1" style={{ stopColor: 'var(--avatar-fill-to)' }} />
        </linearGradient>
        <radialGradient id={`${id}h`} cx=".35" cy=".3" r=".7">
          <stop offset="0" className="jelly-gloss-stop" />
          <stop offset="1" style={{ stopColor: 'var(--avatar-fill-from)' }} />
        </radialGradient>
      </defs>
      {goal && (
        <m.path
          className="jelly-goal"
          data-testid="avatar-goal"
          fill="none"
          strokeWidth="2"
          strokeDasharray="5 6"
          initial={false}
          animate={{ d: bodyPath(goal, k) }}
          transition={t}
        />
      )}
      <g className="jelly-breathe">
        {([-1, 1] as const).map((side) => (
          <m.path
            key={side}
            fill="none"
            stroke={body}
            strokeLinecap="round"
            initial={false}
            animate={{ d: armPath(d, k, side), strokeWidth: r(d.arm * 2) }}
            transition={t}
          />
        ))}
        <m.path className="jelly-body" fill={body} initial={false} animate={{ d: bodyPath(d, k) }} transition={t} />
        <m.path className="jelly-shine" fill="none" initial={false} animate={{ d: shinePath(d, k) }} transition={t} />
        <m.g initial={false} animate={{ y: headShift }} transition={t}>
          <circle className="jelly-head" cx="0" cy={HEAD_Y} r={HEAD_R} fill={`url(#${id}h)`} />
          <path className="jelly-hair" d={HAIR[sex]} />
          <ellipse className="jelly-gloss" cx="-12" cy="26" rx="10" ry="6" />
          <ellipse className="jelly-eye" cx="-11" cy="46" rx="3.6" ry="4.6" />
          <ellipse className="jelly-eye" cx="11" cy="46" rx="3.6" ry="4.6" />
          <ellipse className="jelly-blush" cx="-20" cy="56" rx="6" ry="3.5" />
          <ellipse className="jelly-blush" cx="20" cy="56" rx="6" ry="3.5" />
          <path className="jelly-smile" d="M -8 57 Q 0 64 8 57" />
        </m.g>
      </g>
    </svg>
  )
}

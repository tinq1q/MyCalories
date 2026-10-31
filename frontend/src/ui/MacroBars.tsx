import type { Norm } from '../domain/types'
import { fmt } from './format'

const ITEMS = [
  { key: 'protein', label: 'Белки', color: '#5ac8fa' },
  { key: 'fat', label: 'Жиры', color: '#ffd60a' },
  { key: 'carbs', label: 'Углеводы', color: '#30d158' },
] as const

export default function MacroBars({ totals, norm }: { totals: Norm; norm: Norm | null }) {
  return (
    <div className="macros">
      {ITEMS.map(({ key, label, color }) => {
        const pct = norm && norm[key] > 0 ? Math.min((totals[key] / norm[key]) * 100, 100) : 0
        return (
          <div className="macro" key={key}>
            <span className="macro-label">{label}</span>
            <b>{fmt(totals[key])} г</b>
            {norm && <span className="macro-norm">из {fmt(norm[key])}</span>}
            <div className="bar">
              <i style={{ width: `${pct}%`, background: color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

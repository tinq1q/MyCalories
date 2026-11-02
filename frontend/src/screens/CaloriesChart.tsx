import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Glass from '../ui/Glass'

export interface DayPoint {
  day: string
  label: string
  kcal: number
  norm: number | null
}

interface Props {
  data: DayPoint[]
  range: 7 | 30
  onRangeChange(r: 7 | 30): void
}

// Colours come from the active theme (theme.css variables).
const tick = { fill: 'var(--chart-axis)', fontSize: 11 }

export default function CaloriesChart({ data, range, onRangeChange }: Props) {
  return (
    <Glass as="section" className="chart-card">
      <div className="chart-head">
        <h2>Калории</h2>
        <div className="chips" role="group" aria-label="Период">
          {([7, 30] as const).map((r) => (
            <button
              key={r}
              type="button"
              className={`chip${range === r ? ' on' : ''}`}
              aria-pressed={range === r}
              onClick={() => onRangeChange(r)}
            >
              {r} дней
            </button>
          ))}
        </div>
      </div>
      <div className="chart-box" data-testid="calories-chart">
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-bar-from)" />
                <stop offset="100%" stopColor="var(--chart-bar-to)" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={tick} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--glass-border)', borderRadius: 12 }}
              formatter={(v, name) => [`${v} ккал`, name === 'norm' ? 'Норма' : 'Съедено']}
            />
            <Bar dataKey="kcal" fill="url(#barGrad)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            {/* Step line: each day is judged against the norm in force on that day. */}
            <Line dataKey="norm" type="stepAfter" stroke="var(--chart-norm)" strokeDasharray="5 4" strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Glass>
  )
}

import { useNavigate } from 'react-router-dom'
import { toDayKey } from '../domain/dates'
import type { DayStatus } from '../domain/dayStatus'
import Glass from '../ui/Glass'

export type CalStatus = DayStatus | 'logged'

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

export interface Month {
  year: number
  month: number // 0-11
}

interface Props {
  month: Month
  today: string
  statusOf(day: string): CalStatus
  onMonthChange(m: Month): void
}

export default function Calendar({ month, today, statusOf, onMonthChange }: Props) {
  const navigate = useNavigate()
  const { year, month: m } = month
  // getDay(): 0 = Sunday; shift so Monday is column 0.
  const lead = (new Date(year, m, 1).getDay() + 6) % 7
  const count = new Date(year, m + 1, 0).getDate()
  const shift = (d: number) => {
    const t = new Date(year, m + d, 1)
    onMonthChange({ year: t.getFullYear(), month: t.getMonth() })
  }
  const atCurrent = toDayKey(new Date(year, m, 1)).slice(0, 7) >= today.slice(0, 7)

  return (
    <Glass as="section" className="calendar">
      <div className="cal-head">
        <button type="button" className="icon-btn" aria-label="Предыдущий месяц" onClick={() => shift(-1)}>‹</button>
        <h2>{MONTHS[m]} {year}</h2>
        <button type="button" className="icon-btn" aria-label="Следующий месяц" disabled={atCurrent} onClick={() => shift(1)}>›</button>
      </div>
      <div className="cal-grid">
        {WEEKDAYS.map((w) => (
          <span key={w} className="cal-wd" data-testid="weekday">{w}</span>
        ))}
        {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
        {Array.from({ length: count }, (_, i) => {
          const day = toDayKey(new Date(year, m, i + 1))
          const future = day > today
          const status = statusOf(day)
          return (
            <button
              key={day}
              type="button"
              data-testid={`day-${day}`}
              data-status={status}
              className={`cal-day${day === today ? ' today' : ''}${future ? ' future' : ''}`}
              disabled={future}
              aria-label={`${i + 1} ${MONTHS[m].toLowerCase()}`}
              onClick={() => navigate(`/?day=${day}`)}
            >
              {i + 1}
              <i className={`dot ${status}`} />
            </button>
          )
        })}
      </div>
      <ul className="legend">
        <li><i className="dot ok" /> в норме</li>
        <li><i className="dot over" /> превышение</li>
        <li><i className="dot under" /> недобор</li>
        <li><i className="dot logged" /> без нормы</li>
      </ul>
    </Glass>
  )
}

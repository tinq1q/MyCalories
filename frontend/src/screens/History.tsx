import { useMemo, useState } from 'react'
import { addDays, todayKey } from '../domain/dates'
import { dayStatus } from '../domain/dayStatus'
import { normForDate } from '../domain/norm'
import { dayTotals } from '../domain/nutrition'
import { useDiary } from '../storage/DiaryContext'
import Calendar from './Calendar'
import type { Month } from './Calendar'
import CaloriesChart from './CaloriesChart'
import type { DayPoint } from './CaloriesChart'

export default function History() {
  const { state } = useDiary()
  const today = todayKey()
  const [month, setMonth] = useState<Month>(() => ({ year: +today.slice(0, 4), month: +today.slice(5, 7) - 1 }))
  const [range, setRange] = useState<7 | 30>(7)

  const statusOf = (day: string) => {
    const kcal = dayTotals(state.entries, day).kcal
    const has = state.entries.some((e) => e.date === day)
    return dayStatus(kcal, has, normForDate(state.normHistory, day))
  }

  const data = useMemo<DayPoint[]>(
    () =>
      Array.from({ length: range }, (_, i) => {
        const day = addDays(today, i - range + 1)
        return {
          day,
          label: `${day.slice(8)}.${day.slice(5, 7)}`,
          kcal: Math.round(dayTotals(state.entries, day).kcal),
          norm: normForDate(state.normHistory, day)?.kcal ?? null,
        }
      }),
    [state.entries, state.normHistory, range, today],
  )

  return (
    <div className="history">
      <h1>История</h1>
      <Calendar month={month} today={today} statusOf={statusOf} onMonthChange={setMonth} />
      <CaloriesChart data={data} range={range} onRangeChange={setRange} />
    </div>
  )
}

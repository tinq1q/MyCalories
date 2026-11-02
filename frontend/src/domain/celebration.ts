import type { DayStatus } from './dayStatus'

// Device-local (not exported): the last day whose reaching the norm was celebrated.
export const CELEBRATED_KEY = 'sitefood:celebrated-day'

// Celebrate once a day, only for today and only inside the norm zone.
// `status` comes from dayStatus ('logged' — no norm — never celebrates).
export function shouldCelebrate(status: DayStatus | 'logged', day: string, today: string, celebratedDay: string | null): boolean {
  return day === today && status === 'ok' && celebratedDay !== today
}

const pad = (n: number) => String(n).padStart(2, '0')

// Local calendar day key (never toISOString: that is UTC).
export function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Calendar-day arithmetic. Date.UTC avoids local DST shifts (23/25-hour days).
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

export function todayKey(): string {
  return toDayKey(new Date())
}

// Valid only if the key survives a Date round trip (rejects 2025-02-31, which would roll over).
export function isValidDayKey(key: string | null): key is string {
  if (key === null || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false
  const [y, m, d] = key.split('-').map(Number)
  return toDayKey(new Date(y, m - 1, d)) === key
}

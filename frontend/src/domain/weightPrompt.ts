import { addDays, toDayKey } from './dates'
import type { DiaryState } from './types'

// Device-local (not exported): the day until which the weekly prompt stays quiet.
export const WEIGHT_PROMPT_SNOOZE_KEY = 'sitefood:weight-prompt-snoozed-until'
export const WEIGHT_PROMPT_SNOOZE_DAYS = 3

// Local day key of an ISO timestamp, or null when it does not parse.
function localDayOf(iso: string): string | null {
  const t = new Date(iso)
  return Number.isNaN(t.getTime()) ? null : toDayKey(t)
}

// Ask for a weight once a week: the latest record is a week old or more. Without
// records, the profile itself must be a week old (a fresh profile has its weight).
export function shouldPromptWeight(state: DiaryState, today: string, snoozedUntil: string | null): boolean {
  const { profile, weights } = state
  if (!profile?.trackWeight) return false
  if (snoozedUntil !== null && snoozedUntil >= today) return false
  const limit = addDays(today, -7)
  if (weights.length > 0) return weights.reduce((a, w) => (w.date > a ? w.date : a), '') <= limit
  const since = localDayOf(profile.updatedAt)
  return since !== null && since <= limit
}

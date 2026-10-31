export const ONBOARDING_SKIPPED_KEY = 'sitefood:onboarding-skipped'

// In-memory copy so skipping still works when localStorage refuses writes.
let skippedInMemory = false

export function markOnboardingSkipped() {
  skippedInMemory = true
  try {
    localStorage.setItem(ONBOARDING_SKIPPED_KEY, '1')
  } catch {
    /* in-memory flag covers this visit */
  }
}

export function isOnboardingSkipped(): boolean {
  if (skippedInMemory) return true
  try {
    return localStorage.getItem(ONBOARDING_SKIPPED_KEY) !== null
  } catch {
    return false
  }
}

export function resetOnboardingSkippedForTests() {
  skippedInMemory = false
}

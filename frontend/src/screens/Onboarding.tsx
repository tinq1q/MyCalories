import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { calcNorm } from '../domain/norm'
import { useDiary } from '../storage/DiaryContext'
import Glass from '../ui/Glass'
import NormPreview from './NormPreview'
import { markOnboardingSkipped } from './onboardingFlag'
import ProfileFields, { draftFrom, emptyDraft, profileFromDraft } from './ProfileFields'

export default function Onboarding() {
  const { state, setProfile } = useDiary()
  const navigate = useNavigate()
  // Re-taking the questionnaire starts from the current profile.
  const [base] = useState(() => (state.profile ? draftFrom(state.profile) : undefined))
  const [draft, setDraft] = useState(base ?? emptyDraft)
  const profile = profileFromDraft(draft, base)

  const skip = () => {
    markOnboardingSkipped()
    navigate('/')
  }
  const done = () => {
    if (!profile) return
    setProfile(profile)
    navigate('/')
  }

  return (
    <Glass as="section" className="onboarding card-stack">
      <h1>Давайте познакомимся</h1>
      <p className="muted">Ответы нужны, чтобы рассчитать вашу дневную норму. Данные остаются в браузере.</p>
      <ProfileFields draft={draft} base={base} onChange={setDraft} />
      {profile && <NormPreview norm={calcNorm(profile)} />}
      <div className="sheet-actions">
        <button type="button" className="btn" onClick={skip}>
          Пропустить
        </button>
        <button type="button" className="btn primary" disabled={!profile} onClick={done}>
          Готово
        </button>
      </div>
    </Glass>
  )
}

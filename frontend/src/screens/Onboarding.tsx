import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { calcNorm } from '../domain/norm'
import { useDiary } from '../storage/DiaryContext'
import Glass from '../ui/Glass'
import NormPreview from './NormPreview'
import ProfileFields, { emptyDraft, profileFromDraft } from './ProfileFields'

export const ONBOARDING_SKIPPED_KEY = 'sitefood:onboarding-skipped'

export default function Onboarding() {
  const { setProfile } = useDiary()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(emptyDraft)
  const profile = profileFromDraft(draft)

  const skip = () => {
    try {
      localStorage.setItem(ONBOARDING_SKIPPED_KEY, '1')
    } catch {
      /* without storage the questionnaire is simply offered again next visit */
    }
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
      <ProfileFields draft={draft} onChange={setDraft} />
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

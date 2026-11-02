import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useExport } from '../hooks/useExport'
import { useDiary } from '../storage/DiaryContext'
import Glass from '../ui/Glass'
import ThemePicker from '../ui/ThemePicker'
import { useToast } from '../ui/Toast'
import ImportPanel from './ImportPanel'
import NormCard from './NormCard'
import ProfileFields, { draftFrom, emptyDraft, profileFromDraft } from './ProfileFields'

function QuestionnaireCard() {
  const { state, setProfile } = useDiary()
  const toast = useToast()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(() => (state.profile ? draftFrom(state.profile) : emptyDraft))
  const profile = profileFromDraft(draft)

  return (
    <Glass as="section" className="card-stack">
      <h2>Анкета</h2>
      <ProfileFields draft={draft} onChange={setDraft} />
      <button
        type="button"
        className="btn primary"
        disabled={!profile}
        onClick={() => {
          if (!profile) return
          setProfile(profile)
          toast.show('Профиль сохранён')
        }}
      >
        Сохранить
      </button>
      <button type="button" className="btn" onClick={() => navigate('/onboarding')}>
        Пройти анкету заново
      </button>
    </Glass>
  )
}

export default function Profile() {
  const { state } = useDiary()
  const { run: exportDiary, busy } = useExport()

  return (
    <div className="profile">
      <h1>Профиль</h1>
      {/* Keyed so the form re-syncs when the stored profile changes (e.g. after an import). */}
      <QuestionnaireCard key={state.profile?.updatedAt ?? 'none'} />

      <NormCard />

      <ThemePicker />

      <Glass as="section" className="card-stack">
        <h2>Резервная копия</h2>
        <button type="button" className="btn" disabled={busy} onClick={exportDiary}>
          Скачать дневник
        </button>
      </Glass>

      <ImportPanel />
    </div>
  )
}

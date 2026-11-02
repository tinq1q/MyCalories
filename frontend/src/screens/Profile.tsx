import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { currentWeight, goalProgress, startWeight, targetOf } from '../domain/avatar'
import type { Profile as ProfileT, WeightRecord } from '../domain/types'
import { useExport } from '../hooks/useExport'
import { useDiary } from '../storage/DiaryContext'
import Glass from '../ui/Glass'
import JellyAvatar from '../ui/JellyAvatar'
import ThemePicker from '../ui/ThemePicker'
import { useToast } from '../ui/Toast'
import ImportPanel from './ImportPanel'
import NormCard from './NormCard'
import ProfileFields, { draftFrom, emptyDraft, profileFromDraft } from './ProfileFields'

// The stored profile's figure (not the unsaved draft), with its goal outline.
function MiniAvatar({ profile, weights }: { profile: ProfileT; weights: WeightRecord[] }) {
  const nowKg = currentWeight(weights, profile)
  const progress = goalProgress(profile, nowKg, startWeight(weights, profile))
  return (
    <JellyAvatar
      size="mini"
      heightCm={profile.heightCm}
      sex={profile.sex}
      weightKg={nowKg}
      targetKg={progress ? targetOf(profile) : null}
    />
  )
}

function QuestionnaireCard() {
  const { state, setProfile } = useDiary()
  const toast = useToast()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(() => (state.profile ? draftFrom(state.profile) : emptyDraft))
  const profile = profileFromDraft(draft)

  return (
    <Glass as="section" className="card-stack">
      <div className="card-head">
        <h2>Анкета</h2>
        {state.profile && <MiniAvatar profile={state.profile} weights={state.weights} />}
      </div>
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

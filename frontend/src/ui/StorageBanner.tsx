import { useState } from 'react'
import { downloadBlob, useExport } from '../hooks/useExport'
import { useDiary } from '../storage/DiaryContext'
import Glass from './Glass'

export default function StorageBanner() {
  const { warning, saveFailed, corruptRaw, confirmDiscardCorrupt } = useDiary()
  const { run, busy } = useExport()
  const [dismissed, setDismissed] = useState(false)

  if (warning === 'corrupt-no-backup' && corruptRaw !== null) {
    return (
      <Glass as="aside" className="banner blocking" role="alert">
        <span>Данные браузера повреждены, и сохранить их копию не удалось. Пока вы не решите, новые записи не сохраняются.</span>
        <span className="banner-actions">
          <button
            type="button"
            className="chip"
            onClick={() => downloadBlob(new Blob([corruptRaw], { type: 'text/plain' }), 'MyCalories-повреждённые-данные.txt')}
          >
            Скачать повреждённые данные
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => {
              if (window.confirm('Начать с чистого дневника? Повреждённые данные будут потеряны.')) confirmDiscardCorrupt()
            }}
          >
            Начать заново
          </button>
        </span>
      </Glass>
    )
  }

  if (warning === 'unavailable' || saveFailed) {
    return (
      <Glass as="aside" className="banner" role="alert">
        <span>Браузер не даёт сохранять данные — записи могут пропасть. Скачайте копию дневника.</span>
        <span className="banner-actions">
          <button type="button" className="chip" disabled={busy} onClick={run}>
            Скачать
          </button>
        </span>
      </Glass>
    )
  }

  if (warning === 'corrupt' && !dismissed) {
    return (
      <Glass as="aside" className="banner" role="status">
        <span>Данные браузера были повреждены. Мы сохранили копию и начали с чистого дневника.</span>
        <span className="banner-actions">
          <button type="button" className="chip" onClick={() => setDismissed(true)} aria-label="Закрыть">
            ✕
          </button>
        </span>
      </Glass>
    )
  }
  return null
}

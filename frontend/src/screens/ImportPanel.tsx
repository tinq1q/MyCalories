import { useRef, useState } from 'react'
import { ApiError, api } from '../api/client'
import type { ImportResult } from '../api/client'
import { useDiary } from '../storage/DiaryContext'
import Glass from '../ui/Glass'
import { useToast } from '../ui/Toast'

const MAX_ERRORS = 20

export default function ImportPanel() {
  const { applyImport } = useDiary()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setResult(null)
    setBusy(true)
    try {
      setResult(await api.importDiary(file))
    } catch (e) {
      setError(
        e instanceof ApiError && e.kind === 'bad-file'
          ? 'Не удалось прочитать файл: нужен .xlsx из «Скачать дневник».'
          : 'Не удалось связаться с сервером, попробуйте ещё раз',
      )
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const apply = (mode: 'merge' | 'replace') => {
    if (!result) return
    if (mode === 'replace' && !window.confirm('Заменить весь дневник данными из файла? Текущие записи будут потеряны.')) return
    applyImport(result.data, mode)
    setResult(null)
    toast.show(mode === 'merge' ? 'Дневник объединён с файлом' : 'Дневник заменён данными из файла')
  }

  return (
    <Glass as="section" className="card-stack">
      <h2>Загрузить дневник</h2>
      <input ref={input} type="file" hidden accept=".xlsx" aria-label="Файл дневника" onChange={(e) => pick(e.target.files?.[0])} />
      <button type="button" className="btn" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Читаем файл…' : 'Загрузить дневник'}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div className="import-confirm">
          <p>
            Найдено: {result.data.entries.length} записей, {result.data.customProducts.length} своих продуктов, {result.data.weights.length} записей веса
          </p>
          {result.errors.length > 0 && (
            <ul className="error-list">
              {result.errors.slice(0, MAX_ERRORS).map((er, i) => (
                <li key={i}>
                  Лист «{er.sheet}», строка {er.row}: {er.message}
                </li>
              ))}
              {result.errors.length > MAX_ERRORS && <li>и ещё {result.errors.length - MAX_ERRORS} ошибок</li>}
            </ul>
          )}
          <div className="sheet-actions">
            <button type="button" className="btn danger" onClick={() => apply('replace')}>
              Заменить всё
            </button>
            <button type="button" className="btn primary" onClick={() => apply('merge')}>
              Объединить
            </button>
          </div>
        </div>
      )}
    </Glass>
  )
}

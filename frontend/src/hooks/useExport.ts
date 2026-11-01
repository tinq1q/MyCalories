import { useCallback, useState } from 'react'
import { api } from '../api/client'
import { todayKey } from '../domain/dates'
import type { ExportData } from '../domain/types'
import { useDiary } from '../storage/DiaryContext'
import { useToast } from '../ui/Toast'

// Save a Blob as a file through a temporary link.
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // The download starts asynchronously; revoking the URL right away can make
  // it fail (seen in Safari/Firefox), so free the memory a bit later.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

// Export the diary to .xlsx via the server; the file name is built here
// (Content-Disposition is not readable cross-origin).
export function useExport() {
  const { state, markExported } = useDiary()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const run = useCallback(async () => {
    const data: ExportData = {
      formatVersion: state.formatVersion,
      profile: state.profile,
      normHistory: state.normHistory,
      entries: state.entries,
      customProducts: state.customProducts,
      weights: state.weights,
    }
    setBusy(true)
    try {
      const blob = await api.exportDiary(data)
      downloadBlob(blob, `MyCalories-дневник-${todayKey()}.xlsx`)
      markExported()
    } catch {
      toast.show('Не удалось связаться с сервером, попробуйте ещё раз')
    } finally {
      setBusy(false)
    }
  }, [state, markExported, toast])

  return { run, busy }
}

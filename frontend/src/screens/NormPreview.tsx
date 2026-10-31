import type { Norm } from '../domain/types'
import { fmt } from '../ui/format'

export default function NormPreview({ norm }: { norm: Norm }) {
  return (
    <div className="norm-preview" aria-label="Норма">
      <strong>{fmt(norm.kcal)} ккал</strong>
      <span className="muted">
        Б {fmt(norm.protein)} · Ж {fmt(norm.fat)} · У {fmt(norm.carbs)} г
      </span>
    </div>
  )
}

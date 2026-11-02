import { m } from 'motion/react'
import { Link } from 'react-router-dom'
import { PHOTO_ENABLED } from '../../config'
import { useProductSearch } from '../../hooks/useProductSearch'
import { MEALS, MEAL_LABELS } from '../../domain/types'
import type { Meal, Product } from '../../domain/types'
import { useDiary } from '../../storage/DiaryContext'
import Glass from '../../ui/Glass'
import { fmt } from '../../ui/format'
import { SPRING, useReducedMotionSafe } from '../../ui/motion'

interface Props {
  day: string
  meal: Meal
  query: string
  onMeal(m: Meal): void
  onQuery(q: string): void
  onPick(p: Product): void
  onCreate(): void
}

// The card morphs into the amount step's header (same layoutId there).
function ProductRow({ p, onPick }: { p: Product; onPick(p: Product): void }) {
  const reduced = useReducedMotionSafe()
  return (
    <m.button
      type="button"
      className="glass product-row"
      layoutId={reduced ? undefined : `product-${p.id}`}
      transition={SPRING}
      onClick={() => onPick(p)}
    >
      <span className="product-info">
        <span className="product-name">{p.name}</span>
        <small>{fmt(p.kcal)} ккал · 100 г</small>
      </span>
      <span className="plus" aria-hidden="true">
        +
      </span>
    </m.button>
  )
}

export default function SearchStep({ day, meal, query, onMeal, onQuery, onPick, onCreate }: Props) {
  const { state } = useDiary()
  const { local, remote, remoteState } = useProductSearch(query)
  const hasQuery = query.trim() !== ''
  // A product present in both lists is shown once, in the "own" list.
  const localIds = new Set(local.map((p) => p.id))
  const remoteShown = remote.filter((p) => !localIds.has(p.id))
  const recent = state.recentProducts.slice(0, 20)

  return (
    <div className="add-step">
      <header className="add-header">
        <h1>Добавить</h1>
        <Link className="muted" to={`/?day=${day}`}>
          Отмена
        </Link>
      </header>

      <div className="chips" role="group" aria-label="Приём пищи">
        {MEALS.map((m) => (
          <button key={m} type="button" className={m === meal ? 'chip on' : 'chip'} aria-pressed={m === meal} onClick={() => onMeal(m)}>
            {MEAL_LABELS[m]}
          </button>
        ))}
      </div>

      <Glass className="search">
        <input
          type="search"
          aria-label="Поиск продукта"
          placeholder="Поиск продукта"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          autoFocus
        />
        {hasQuery && (
          <button type="button" className="icon-btn" aria-label="Очистить поиск" onClick={() => onQuery('')}>
            ✕
          </button>
        )}
        {/* Slot for the future photo recognition button. */}
        {PHOTO_ENABLED && (
          <button type="button" className="icon-btn" aria-label="Распознать по фото">
            📷
          </button>
        )}
      </Glass>

      {!hasQuery ? (
        <>
          <h2 className="lbl">Недавние</h2>
          {recent.length === 0 && <p className="muted">Пока пусто. Начните вводить название продукта.</p>}
          {recent.map((p) => (
            <ProductRow key={p.id} p={p} onPick={onPick} />
          ))}
        </>
      ) : (
        <>
          {local.length > 0 && (
            <>
              <h2 className="lbl">Мои и частые</h2>
              {local.map((p) => (
                <ProductRow key={p.id} p={p} onPick={onPick} />
              ))}
            </>
          )}
          {(remoteShown.length > 0 || remoteState !== 'idle') && <h2 className="lbl">Большая база</h2>}
          {remoteState === 'loading' && <p className="muted">Ищем…</p>}
          {remoteState === 'slow' && <p className="muted">Будим сервер, это до минуты…</p>}
          {remoteState === 'error' && <p className="muted">Большая база сейчас недоступна</p>}
          {remoteShown.map((p) => (
            <ProductRow key={p.id} p={p} onPick={onPick} />
          ))}
          {local.length === 0 && remoteShown.length === 0 && remoteState === 'idle' && <p className="muted">Ничего не найдено</p>}
        </>
      )}

      <button type="button" className="glass product-row create-row" onClick={onCreate}>
        <span className="product-info">
          <span className="product-name">Не нашёл? Создать свой продукт</span>
          <small>ввести КБЖУ вручную</small>
        </span>
        <span className="plus" aria-hidden="true">
          +
        </span>
      </button>
    </div>
  )
}
